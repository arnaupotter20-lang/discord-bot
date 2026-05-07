require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Database = require("better-sqlite3");

const db = new Database("database.sqlite");

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

function generarPlantilla() {
  const unidades = db.prepare(`
    SELECT units.*, vehicles.name AS vehiculo
    FROM units
    LEFT JOIN vehicles ON units.vehicle_id = vehicles.id
  `).all();

  let texto = `🚔 PLANTILLA\n🕒 ${hora()}\n\n`;

  for (const u of unidades) {
    const miembros = db.prepare(`
      SELECT discord_id FROM unit_members WHERE unit_id = ?
    `).all(u.id);

    const zonas = db.prepare(`
      SELECT zones.name FROM unit_zones
      JOIN zones ON zones.id = unit_zones.zone_id
      WHERE unit_zones.unit_id = ?
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
      texto += `📍 ${zonas.map(z => z.name).join(", ")}\n`;
    }

    texto += `\n`;
  }

  return texto;
}

async function actualizarPlantilla() {
  const data = db.prepare("SELECT * FROM plantilla LIMIT 1").get();
  if (!data) return;

  const canal = await client.channels.fetch(data.channel_id);
  const mensaje = await canal.messages.fetch(data.message_id);

  await mensaje.edit(generarPlantilla());
}

client.once("ready", () => {
  console.log("Bot listo");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  // ---------------- UNIDAD ----------------
  if (commandName === "unidad") {
    await interaction.deferReply();
    const sub = options.getSubcommand();

    const nombre = limpiarNombre(options.getString("unidad") || options.getString("nombre"));

    if (sub === "crear") {
      const categoria = options.getString("categoria");

      db.prepare(`
        INSERT INTO units (name, category)
        VALUES (?, ?)
      `).run(nombre, categoria);

      return interaction.editReply("Unidad creada");
    }

    if (sub === "asignar") {
      const user = options.getUser("usuario");
      const unidad = getUnidad(nombre);

      // SOLO 1 UNIDAD
      db.prepare(`DELETE FROM unit_members WHERE discord_id = ?`).run(user.id);

      db.prepare(`
        INSERT INTO unit_members (unit_id, discord_id)
        VALUES (?, ?)
      `).run(unidad.id, user.id);

      await actualizarPlantilla();

      return interaction.editReply("Asignado");
    }

    if (sub === "vehiculo") {
      const vehiculo = getVehiculo(options.getString("vehiculo"));
      const unidad = getUnidad(nombre);

      db.prepare(`
        UPDATE units SET vehicle_id = ?
        WHERE id = ?
      `).run(vehiculo.id, unidad.id);

      await actualizarPlantilla();

      return interaction.editReply("Vehículo asignado");
    }

    if (sub === "vehiculo-quitar") {
      const unidad = getUnidad(nombre);

      db.prepare(`
        UPDATE units SET vehicle_id = NULL
        WHERE id = ?
      `).run(unidad.id);

      await actualizarPlantilla();

      return interaction.editReply("Vehículo quitado");
    }

    if (sub === "zona-añadir") {

  const unidadNombre = limpiarNombre(
    interaction.options.getString("unidad")
  );

  const zonaNombre = limpiarNombre(
    interaction.options.getString("zona")
  );

  const unidad = getUnidad(unidadNombre);
  const zona = getZona(zonaNombre);

  if (!unidad) {
    return interaction.editReply(`❌ Unidad no existe`);
  }

  if (!zona) {
    return interaction.editReply(`❌ Zona no existe`);
  }

  db.prepare(`
    INSERT OR IGNORE INTO unit_zones (unit_id, zone_id)
    VALUES (?, ?)
  `).run(unidad.id, zona.id);

  await actualizarPlantilla();

  return interaction.editReply(`📍 Zona añadida`);
}
    }

 if (sub === "zona-quitar") {

  const unidadNombre = limpiarNombre(
    interaction.options.getString("unidad")
  );

  const zonaNombre = limpiarNombre(
    interaction.options.getString("zona")
  );

  const unidad = getUnidad(unidadNombre);
  const zona = getZona(zonaNombre);

  if (!unidad || !zona) {
    return interaction.editReply(`❌ Datos incorrectos`);
  }

  db.prepare(`
    DELETE FROM unit_zones
    WHERE unit_id = ? AND zone_id = ?
  `).run(unidad.id, zona.id);

  await actualizarPlantilla();

  return interaction.editReply(`📍 Zona quitada`);
}
    }
  }

  // 🔹 ZONA
if (interaction.commandName === "zona") {
  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();

  const nombre = limpiarNombre(
    interaction.options.getString("nombre")
  );

  // ---------------- CREAR ----------------
  if (sub === "crear") {

    if (getZona(nombre)) {
      return interaction.editReply(
        `❌ La zona **${nombre}** ya existe`
      );
    }

    const descripcion =
      interaction.options.getString("descripcion");

    db.prepare(`
      INSERT INTO zones (name, description)
      VALUES (?, ?)
    `).run(nombre, descripcion);

    return interaction.editReply(
      `📍 Zona **${nombre}** creada`
    );
  }

  // ---------------- ELIMINAR ----------------
  if (sub === "eliminar") {

    const zona = getZona(nombre);

    if (!zona) {
      return interaction.editReply(
        `❌ Zona no existe`
      );
    }

    db.prepare(`
      DELETE FROM unit_zones
      WHERE zone_id = ?
    `).run(zona.id);

    db.prepare(`
      DELETE FROM zones
      WHERE id = ?
    `).run(zona.id);

    await actualizarPlantilla();

    return interaction.editReply(
      `🗑️ Zona eliminada`
    );
  }

  // ---------------- VER ----------------
  if (sub === "ver") {

    const zona = getZona(nombre);

    if (!zona) {
      return interaction.editReply(
        `❌ Zona no existe`
      );
    }

    return interaction.editReply(
      `📍 **${zona.name}**\n\n${zona.description}`
    );
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

      return interaction.editReply("Plantilla creada");
    }

    if (sub === "limpiar") {
      db.prepare(`DELETE FROM unit_members`).run();
      db.prepare(`DELETE FROM unit_zones`).run();
      db.prepare(`UPDATE units SET vehicle_id = NULL`).run();

      await actualizarPlantilla();

      return interaction.editReply("Plantilla limpiada");
    }
  }
});

client.login(process.env.TOKEN);
