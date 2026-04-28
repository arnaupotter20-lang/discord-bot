require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const Database = require("better-sqlite3");

const db = new Database("database.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  vehicle_id INTEGER
);

CREATE TABLE IF NOT EXISTS unit_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  UNIQUE(unit_id, discord_id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plantilla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL
);
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const UNIDADES_INICIALES = [
  "GOES",
  "GEO",
  "UIP",
  "UPR",
  "FDF",
  "CGPJ",
  "CGPC",
  "CGI",
  "UAI",
  "UEGC"
];

function limpiarNombre(nombre) {
  return nombre.trim().toUpperCase();
}

function crearUnidadesIniciales() {
  const stmt = db.prepare("INSERT OR IGNORE INTO units (name) VALUES (?)");

  for (const unidad of UNIDADES_INICIALES) {
    stmt.run(unidad);
  }
}

function getUnidad(nombre) {
  return db.prepare("SELECT * FROM units WHERE name = ?").get(limpiarNombre(nombre));
}

function getVehiculo(nombre) {
  return db.prepare("SELECT * FROM vehicles WHERE name = ?").get(limpiarNombre(nombre));
}

function generarPlantilla() {
  const unidades = db.prepare(`
    SELECT units.*, vehicles.name AS vehicle_name
    FROM units
    LEFT JOIN vehicles ON units.vehicle_id = vehicles.id
    ORDER BY units.name
  `).all();

  let texto = "🚔 **PLANTILLA DE SERVICIO**\n\n";

  for (const unidad of unidades) {
    const miembros = db.prepare(`
      SELECT discord_id FROM unit_members WHERE unit_id = ?
    `).all(unidad.id);

    texto += `**${unidad.name}**\n`;

    if (miembros.length) {
      for (const miembro of miembros) {
        texto += `• <@${miembro.discord_id}>\n`;
      }
    } else {
      texto += "• Sin miembros\n";
    }

    texto += `🚗 Vehículo: ${unidad.vehicle_name || "Sin vehículo"}\n\n`;
  }

  return texto;
}

async function actualizarPlantilla() {
  const data = db.prepare("SELECT * FROM plantilla LIMIT 1").get();
  if (!data) return;

  try {
    const canal = await client.channels.fetch(data.channel_id);
    const mensaje = await canal.messages.fetch(data.message_id);

    await mensaje.edit(generarPlantilla());
  } catch (error) {
    console.error("Error actualizando plantilla:", error);
  }
}

client.once("ready", () => {
  crearUnidadesIniciales();
  console.log(`Bot listo como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused().toUpperCase();
      const focusedName = interaction.options.getFocused(true).name;

      let opciones = [];

      if (focusedName === "unidad") {
        opciones = db.prepare(`
          SELECT name FROM units WHERE name LIKE ? ORDER BY name LIMIT 25
        `).all(`%${focused}%`).map(row => ({
          name: row.name,
          value: row.name
        }));
      }

      if (focusedName === "vehiculo") {
        opciones = db.prepare(`
          SELECT name FROM vehicles WHERE name LIKE ? ORDER BY name LIMIT 25
        `).all(`%${focused}%`).map(row => ({
          name: row.name,
          value: row.name
        }));
      }

      return interaction.respond(opciones);
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
      return interaction.reply("Pong 🟢");
    }

    if (interaction.commandName === "unidad") {
      await interaction.deferReply();

      const sub = interaction.options.getSubcommand();

      if (sub === "crear") {
        const nombre = limpiarNombre(interaction.options.getString("nombre"));

        if (getUnidad(nombre)) {
          return interaction.editReply(`❌ La unidad **${nombre}** ya existe.`);
        }

        db.prepare("INSERT INTO units (name) VALUES (?)").run(nombre);
        await actualizarPlantilla();

        return interaction.editReply(`✅ Unidad **${nombre}** creada.`);
      }

      if (sub === "eliminar") {
        const nombre = limpiarNombre(interaction.options.getString("unidad"));
        const unidad = getUnidad(nombre);

        if (!unidad) {
          return interaction.editReply(`❌ No existe la unidad **${nombre}**.`);
        }

        db.prepare("DELETE FROM unit_members WHERE unit_id = ?").run(unidad.id);
        db.prepare("DELETE FROM units WHERE id = ?").run(unidad.id);

        await actualizarPlantilla();

        return interaction.editReply(`🗑️ Unidad **${nombre}** eliminada.`);
      }

      if (sub === "ver") {
        const nombre = limpiarNombre(interaction.options.getString("unidad"));

        const unidad = db.prepare(`
          SELECT units.*, vehicles.name AS vehicle_name, vehicles.description AS vehicle_description
          FROM units
          LEFT JOIN vehicles ON units.vehicle_id = vehicles.id
          WHERE units.name = ?
        `).get(nombre);

        if (!unidad) {
          return interaction.editReply(`❌ No existe la unidad **${nombre}**.`);
        }

        const miembros = db.prepare(`
          SELECT discord_id FROM unit_members WHERE unit_id = ?
        `).all(unidad.id);

        const textoMiembros = miembros.length
          ? miembros.map(m => `<@${m.discord_id}>`).join("\n")
          : "Sin miembros";

        return interaction.editReply(
          `📋 **${unidad.name}**\n\n` +
          `👥 **Miembros:**\n${textoMiembros}\n\n` +
          `🚗 **Vehículo:** ${unidad.vehicle_name || "Sin vehículo"}`
        );
      }

      if (sub === "asignar") {
        const nombre = limpiarNombre(interaction.options.getString("unidad"));
        const usuario = interaction.options.getUser("usuario");
        const unidad = getUnidad(nombre);

        if (!unidad) {
          return interaction.editReply(`❌ No existe la unidad **${nombre}**.`);
        }

        db.prepare(`
          INSERT OR IGNORE INTO unit_members (unit_id, discord_id)
          VALUES (?, ?)
        `).run(unidad.id, usuario.id);

        await actualizarPlantilla();

        return interaction.editReply(`✅ ${usuario} asignado a **${nombre}**.`);
      }

      if (sub === "quitar") {
        const nombre = limpiarNombre(interaction.options.getString("unidad"));
        const usuario = interaction.options.getUser("usuario");
        const unidad = getUnidad(nombre);

        if (!unidad) {
          return interaction.editReply(`❌ No existe la unidad **${nombre}**.`);
        }

        db.prepare(`
          DELETE FROM unit_members WHERE unit_id = ? AND discord_id = ?
        `).run(unidad.id, usuario.id);

        await actualizarPlantilla();

        return interaction.editReply(`❌ ${usuario} quitado de **${nombre}**.`);
      }

      if (sub === "vehiculo") {
        const unidadNombre = limpiarNombre(interaction.options.getString("unidad"));
        const vehiculoNombre = limpiarNombre(interaction.options.getString("vehiculo"));

        const unidad = getUnidad(unidadNombre);
        const vehiculo = getVehiculo(vehiculoNombre);

        if (!unidad) {
          return interaction.editReply(`❌ No existe la unidad **${unidadNombre}**.`);
        }

        if (!vehiculo) {
          return interaction.editReply(`❌ No existe el vehículo **${vehiculoNombre}**.`);
        }

        db.prepare(`
          UPDATE units SET vehicle_id = ? WHERE id = ?
        `).run(vehiculo.id, unidad.id);

        await actualizarPlantilla();

        return interaction.editReply(`🚗 Vehículo **${vehiculoNombre}** asignado a **${unidadNombre}**.`);
      }
    }

    if (interaction.commandName === "vehiculo") {
      await interaction.deferReply();

      const sub = interaction.options.getSubcommand();

      if (sub === "crear") {
        const nombre = limpiarNombre(interaction.options.getString("nombre"));
        const descripcion = interaction.options.getString("descripcion");

        if (getVehiculo(nombre)) {
          return interaction.editReply(`❌ El vehículo **${nombre}** ya existe.`);
        }

        db.prepare(`
          INSERT INTO vehicles (name, description)
          VALUES (?, ?)
        `).run(nombre, descripcion);

        return interaction.editReply(`🚗 Vehículo **${nombre}** creado.`);
      }

      if (sub === "eliminar") {
        const nombre = limpiarNombre(interaction.options.getString("vehiculo"));
        const vehiculo = getVehiculo(nombre);

        if (!vehiculo) {
          return interaction.editReply(`❌ No existe el vehículo **${nombre}**.`);
        }

        db.prepare("UPDATE units SET vehicle_id = NULL WHERE vehicle_id = ?").run(vehiculo.id);
        db.prepare("DELETE FROM vehicles WHERE id = ?").run(vehiculo.id);

        await actualizarPlantilla();

        return interaction.editReply(`🗑️ Vehículo **${nombre}** eliminado.`);
      }

      if (sub === "ver") {
        const nombre = limpiarNombre(interaction.options.getString("vehiculo"));
        const vehiculo = getVehiculo(nombre);

        if (!vehiculo) {
          return interaction.editReply(`❌ No existe el vehículo **${nombre}**.`);
        }

        return interaction.editReply(
          `🚗 **${vehiculo.name}**\n\n${vehiculo.description}`
        );
      }
    }

    if (interaction.commandName === "plantilla") {
      await interaction.deferReply();

      const sub = interaction.options.getSubcommand();

      if (sub === "crear") {
        const msg = await interaction.channel.send(generarPlantilla());

        db.prepare("DELETE FROM plantilla").run();
        db.prepare(`
          INSERT INTO plantilla (channel_id, message_id)
          VALUES (?, ?)
        `).run(interaction.channel.id, msg.id);

        return interaction.editReply("✅ Plantilla fija creada.");
      }

      if (sub === "actualizar") {
        await actualizarPlantilla();
        return interaction.editReply("🔄 Plantilla actualizada.");
      }

      if (sub === "limpiar") {
        db.prepare("DELETE FROM unit_members").run();
        db.prepare("UPDATE units SET vehicle_id = NULL").run();

        await actualizarPlantilla();

        return interaction.editReply("🧹 Plantilla limpiada: personas y vehículos eliminados.");
      }
    }
  } catch (error) {
    console.error("ERROR:", error);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ Ha ocurrido un error.");
    }

    return interaction.reply("❌ Ha ocurrido un error.");
  }
});

if (!process.env.TOKEN) {
  console.error("Falta TOKEN en Railway Variables.");
  process.exit(1);
}

client.login(process.env.TOKEN);
