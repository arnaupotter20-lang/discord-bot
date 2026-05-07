require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Database = require("better-sqlite3");

const db = new Database("/data/database.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  vehicle_id INTEGER
);

CREATE TABLE IF NOT EXISTS unit_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  zone_id INTEGER NOT NULL,
  UNIQUE(unit_id, zone_id)
);

CREATE TABLE IF NOT EXISTS plantilla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT,
  message_id TEXT
);
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ---------------- FUNCIONES GENERALES ----------------

function limpiarNombre(nombre) {
  return nombre.trim().toUpperCase();
}

function getUnidad(nombre) {
  return db.prepare("SELECT * FROM units WHERE name = ?").get(limpiarNombre(nombre));
}

function getVehiculo(nombre) {
  return db.prepare("SELECT * FROM vehicles WHERE name = ?").get(limpiarNombre(nombre));
}

function getZona(nombre) {
  return db.prepare("SELECT * FROM zones WHERE name = ?").get(limpiarNombre(nombre));
}

function hora() {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ---------------- PLANTILLA ----------------

function generarPlantilla() {
  const unidades = db.prepare(`
    SELECT units.*, vehicles.name AS vehiculo
    FROM units
    LEFT JOIN vehicles ON units.vehicle_id = vehicles.id
    ORDER BY units.category, units.name
  `).all();

  let texto = `🚔 **PLANTILLA**\n🕒 Última actualización: ${hora()}\n\n`;

  for (const u of unidades) {
    const miembros = db.prepare(`
      SELECT discord_id FROM unit_members WHERE unit_id = ?
    `).all(u.id);

    const zonas = db.prepare(`
      SELECT zones.name, zones.description
      FROM unit_zones
      JOIN zones ON zones.id = unit_zones.zone_id
      WHERE unit_zones.unit_id = ?
      ORDER BY zones.name
    `).all(u.id);

    texto += `**${u.name}**\n`;

    if (miembros.length) {
      miembros.forEach(m => {
        texto += `• <@${m.discord_id}>\n`;
      });
    } else {
      texto += `• Sin miembros\n`;
    }

    texto += `🚗 ${u.vehiculo || "Sin vehículo"}\n`;

    if (zonas.length) {
      texto += `📍 Zonas: ${zonas.map(z => z.name).join(", ")}\n`;
    } else {
      texto += `📍 Zonas: Sin zonas\n`;
    }

    texto += `\n`;
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

// ---------------- READY ----------------

client.once("ready", () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

// ---------------- INTERACCIONES ----------------

client.on("interactionCreate", async interaction => {
  try {
    // ---------------- AUTOCOMPLETE ----------------

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

      if (focusedName === "zona") {
        opciones = db.prepare(`
          SELECT name FROM zones WHERE name LIKE ? ORDER BY name LIMIT 25
        `).all(`%${focused}%`).map(row => ({
          name: row.name,
          value: row.name
        }));
      }

      return interaction.respond(opciones);
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // ---------------- PING ----------------

    if (commandName === "ping") {
      return interaction.reply("Pong 🟢");
    }

    // ---------------- UNIDAD ----------------

    if (commandName === "unidad") {
      await interaction.deferReply();

      const sub = options.getSubcommand();

      if (sub === "crear") {
        const nombre = limpiarNombre(options.getString("nombre"));
        const categoria = options.getString("categoria");

        if (getUnidad(nombre)) {
          return interaction.editReply(`❌ La unidad **${nombre}** ya existe.`);
        }

        db.prepare(`
          INSERT INTO units (name, category)
          VALUES (?, ?)
        `).run(nombre, categoria);

        await actualizarPlantilla();

        return interaction.editReply(`✅ Unidad **${nombre}** creada.`);
      }

      if (sub === "eliminar") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const unidad = getUnidad(unidadNombre);

        if (!unidad) {
          return interaction.editReply("❌ Unidad no existe.");
        }

        db.prepare(`DELETE FROM unit_members WHERE unit_id = ?`).run(unidad.id);
        db.prepare(`DELETE FROM unit_zones WHERE unit_id = ?`).run(unidad.id);
        db.prepare(`DELETE FROM units WHERE id = ?`).run(unidad.id);

        await actualizarPlantilla();

        return interaction.editReply(`🗑️ Unidad **${unidadNombre}** eliminada.`);
      }

      if (sub === "asignar") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const user = options.getUser("usuario");
        const unidad = getUnidad(unidadNombre);

        if (!unidad) {
          return interaction.editReply("❌ Unidad no existe.");
        }

        db.prepare(`DELETE FROM unit_members WHERE discord_id = ?`).run(user.id);

        db.prepare(`
          INSERT INTO unit_members (unit_id, discord_id)
          VALUES (?, ?)
        `).run(unidad.id, user.id);

        await actualizarPlantilla();

        return interaction.editReply(`✅ ${user} asignado a **${unidadNombre}**.`);
      }

      if (sub === "quitar") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const user = options.getUser("usuario");
        const unidad = getUnidad(unidadNombre);

        if (!unidad) {
          return interaction.editReply("❌ Unidad no existe.");
        }

        db.prepare(`
          DELETE FROM unit_members
          WHERE unit_id = ? AND discord_id = ?
        `).run(unidad.id, user.id);

        await actualizarPlantilla();

        return interaction.editReply(`❌ ${user} quitado de **${unidadNombre}**.`);
      }

      if (sub === "vehiculo") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const vehiculoNombre = limpiarNombre(options.getString("vehiculo"));

        const unidad = getUnidad(unidadNombre);
        const vehiculo = getVehiculo(vehiculoNombre);

        if (!unidad) {
          return interaction.editReply("❌ Unidad no existe.");
        }

        if (!vehiculo) {
          return interaction.editReply("❌ Vehículo no existe.");
        }

        db.prepare(`
          UPDATE units SET vehicle_id = ?
          WHERE id = ?
        `).run(vehiculo.id, unidad.id);

        await actualizarPlantilla();

        return interaction.editReply(`🚗 Vehículo **${vehiculoNombre}** asignado a **${unidadNombre}**.`);
      }

      if (sub === "vehiculo-quitar") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const unidad = getUnidad(unidadNombre);

        if (!unidad) {
          return interaction.editReply("❌ Unidad no existe.");
        }

        db.prepare(`
          UPDATE units SET vehicle_id = NULL
          WHERE id = ?
        `).run(unidad.id);

        await actualizarPlantilla();

        return interaction.editReply(`🚗 Vehículo quitado de **${unidadNombre}**.`);
      }

      if (sub === "zona-añadir") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const zonaNombre = limpiarNombre(options.getString("zona"));

        const unidad = getUnidad(unidadNombre);
        const zona = getZona(zonaNombre);

        if (!unidad) {
          return interaction.editReply("❌ Unidad no existe.");
        }

        if (!zona) {
          return interaction.editReply("❌ Zona no existe.");
        }

        db.prepare(`
          INSERT OR IGNORE INTO unit_zones (unit_id, zone_id)
          VALUES (?, ?)
        `).run(unidad.id, zona.id);

        await actualizarPlantilla();

        return interaction.editReply(`📍 Zona **${zonaNombre}** añadida a **${unidadNombre}**.`);
      }

      if (sub === "zona-quitar") {
        const unidadNombre = limpiarNombre(options.getString("unidad"));
        const zonaNombre = limpiarNombre(options.getString("zona"));

        const unidad = getUnidad(unidadNombre);
        const zona = getZona(zonaNombre);

        if (!unidad || !zona) {
          return interaction.editReply("❌ Datos incorrectos.");
        }

        db.prepare(`
          DELETE FROM unit_zones
          WHERE unit_id = ? AND zone_id = ?
        `).run(unidad.id, zona.id);

        await actualizarPlantilla();

        return interaction.editReply(`📍 Zona **${zonaNombre}** quitada de **${unidadNombre}**.`);
      }
    }

    // ---------------- VEHICULO ----------------

    if (commandName === "vehiculo") {
      await interaction.deferReply();

      const sub = options.getSubcommand();

      if (sub === "crear") {
        const nombre = limpiarNombre(options.getString("nombre"));
        const descripcion = options.getString("descripcion");

        if (getVehiculo(nombre)) {
          return interaction.editReply(`❌ El vehículo **${nombre}** ya existe.`);
        }

        db.prepare(`
          INSERT INTO vehicles (name, description)
          VALUES (?, ?)
        `).run(nombre, descripcion);

        return interaction.editReply(`🚗 Vehículo **${nombre}** creado.`);
      }

      if (sub === "ver") {
        const nombre = limpiarNombre(options.getString("vehiculo"));
        const vehiculo = getVehiculo(nombre);

        if (!vehiculo) {
          return interaction.editReply("❌ Vehículo no existe.");
        }

        return interaction.editReply(`🚗 **${vehiculo.name}**\n\n${vehiculo.description}`);
      }

      if (sub === "eliminar") {
        const nombre = limpiarNombre(options.getString("vehiculo"));
        const vehiculo = getVehiculo(nombre);

        if (!vehiculo) {
          return interaction.editReply("❌ Vehículo no existe.");
        }

        db.prepare(`UPDATE units SET vehicle_id = NULL WHERE vehicle_id = ?`).run(vehiculo.id);
        db.prepare(`DELETE FROM vehicles WHERE id = ?`).run(vehiculo.id);

        await actualizarPlantilla();

        return interaction.editReply(`🗑️ Vehículo **${nombre}** eliminado.`);
      }
    }

    // ---------------- ZONA ----------------

    if (commandName === "zona") {
      await interaction.deferReply();

      const sub = options.getSubcommand();

      const nombre = limpiarNombre(
        options.getString("nombre") || options.getString("zona")
      );

      if (sub === "crear") {
        const descripcion = options.getString("descripcion");

        if (getZona(nombre)) {
          return interaction.editReply(`❌ La zona **${nombre}** ya existe.`);
        }

        db.prepare(`
          INSERT INTO zones (name, description)
          VALUES (?, ?)
        `).run(nombre, descripcion);

        return interaction.editReply(`📍 Zona **${nombre}** creada.`);
      }

      if (sub === "ver") {
        const zona = getZona(nombre);

        if (!zona) {
          return interaction.editReply("❌ Zona no existe.");
        }

        return interaction.editReply(`📍 **${zona.name}**\n\n${zona.description}`);
      }

      if (sub === "eliminar") {
        const zona = getZona(nombre);

        if (!zona) {
          return interaction.editReply("❌ Zona no existe.");
        }

        db.prepare(`DELETE FROM unit_zones WHERE zone_id = ?`).run(zona.id);
        db.prepare(`DELETE FROM zones WHERE id = ?`).run(zona.id);

        await actualizarPlantilla();

        return interaction.editReply(`🗑️ Zona **${nombre}** eliminada.`);
      }
    }

    // ---------------- PLANTILLA ----------------

    if (commandName === "plantilla") {
      await interaction.deferReply();

      const sub = options.getSubcommand();

      if (sub === "crear") {
        const msg = await interaction.channel.send(generarPlantilla());

        db.prepare(`DELETE FROM plantilla`).run();

        db.prepare(`
          INSERT INTO plantilla (channel_id, message_id)
          VALUES (?, ?)
        `).run(interaction.channel.id, msg.id);

        return interaction.editReply("✅ Plantilla creada.");
      }

      if (sub === "actualizar") {
        await actualizarPlantilla();
        return interaction.editReply("🔄 Plantilla actualizada.");
      }

      if (sub === "limpiar") {
        db.prepare(`DELETE FROM unit_members`).run();
        db.prepare(`DELETE FROM unit_zones`).run();
        db.prepare(`UPDATE units SET vehicle_id = NULL`).run();

        await actualizarPlantilla();

        return interaction.editReply("🧹 Plantilla limpiada.");
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
  console.error("Falta TOKEN.");
  process.exit(1);
}

client.login(process.env.TOKEN);
