require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require("discord.js");

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
  discord_id TEXT NOT NULL,
  UNIQUE(unit_id, discord_id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  image_url TEXT NOT NULL
);
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function cleanName(name) {
  return name.trim().toUpperCase();
}

function categoryName(category) {
  if (category === "H50") return "H-50";
  if (category === "SUPERVISORAS") return "Unidades Supervisoras";
  if (category === "GAC") return "Unidades G.A.C";
  return category;
}

function getUnitByName(name) {
  return db.prepare("SELECT * FROM units WHERE name = ?").get(cleanName(name));
}

function getVehicleByName(name) {
  return db.prepare("SELECT * FROM vehicles WHERE name = ?").get(cleanName(name));
}

client.once("clientReady", () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused().toUpperCase();
      const focusedName = interaction.options.getFocused(true).name;

      let rows = [];

      if (focusedName === "unidad") {
        rows = db.prepare("SELECT name FROM units WHERE name LIKE ? ORDER BY name LIMIT 25")
          .all(`%${focused}%`)
          .map(row => ({ name: row.name, value: row.name }));
      }

      if (focusedName === "vehiculo") {
        rows = db.prepare("SELECT name FROM vehicles WHERE name LIKE ? ORDER BY name LIMIT 25")
          .all(`%${focused}%`)
          .map(row => ({ name: row.name, value: row.name }));
      }

      return await interaction.respond(rows);
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
      return await interaction.reply("Pong ✅");
    }

    if (interaction.commandName === "unidad") {
      await interaction.deferReply();

      const sub = interaction.options.getSubcommand();

      if (sub === "crear") {
        const name = cleanName(interaction.options.getString("nombre"));
        const category = interaction.options.getString("categoria");

        const exists = getUnitByName(name);
        if (exists) return await interaction.editReply(`La unidad **${name}** ya existe.`);

        db.prepare("INSERT INTO units (name, category) VALUES (?, ?)").run(name, category);

        return await interaction.editReply(`Unidad **${name}** creada en **${categoryName(category)}** ✅`);
      }

      if (sub === "eliminar") {
        const name = cleanName(interaction.options.getString("unidad"));
        const unit = getUnitByName(name);

        if (!unit) return await interaction.editReply(`No existe la unidad **${name}**.`);

        db.prepare("DELETE FROM unit_members WHERE unit_id = ?").run(unit.id);
        db.prepare("DELETE FROM units WHERE id = ?").run(unit.id);

        return await interaction.editReply(`Unidad **${name}** eliminada ❌`);
      }

      if (sub === "asignar") {
        const name = cleanName(interaction.options.getString("unidad"));
        const user = interaction.options.getUser("usuario");
        const unit = getUnitByName(name);

        if (!unit) return await interaction.editReply(`No existe la unidad **${name}**.`);

        db.prepare(`
          INSERT OR IGNORE INTO unit_members (unit_id, discord_id)
          VALUES (?, ?)
        `).run(unit.id, user.id);

        return await interaction.editReply(`${user} asignado a **${name}** ✅`);
      }

      if (sub === "quitar") {
        const name = cleanName(interaction.options.getString("unidad"));
        const user = interaction.options.getUser("usuario");
        const unit = getUnitByName(name);

        if (!unit) return await interaction.editReply(`No existe la unidad **${name}**.`);

        db.prepare("DELETE FROM unit_members WHERE unit_id = ? AND discord_id = ?")
          .run(unit.id, user.id);

        return await interaction.editReply(`${user} quitado de **${name}** ❌`);
      }

      if (sub === "vehiculo") {
        const unitName = cleanName(interaction.options.getString("unidad"));
        const vehicleName = cleanName(interaction.options.getString("vehiculo"));

        const unit = getUnitByName(unitName);
        const vehicle = getVehicleByName(vehicleName);

        if (!unit) return await interaction.editReply(`No existe la unidad **${unitName}**.`);
        if (!vehicle) return await interaction.editReply(`No existe el vehículo **${vehicleName}**.`);

        db.prepare("UPDATE units SET vehicle_id = ? WHERE id = ?").run(vehicle.id, unit.id);

        return await interaction.editReply(`Vehículo **${vehicleName}** asignado a **${unitName}** ✅`);
      }

      if (sub === "ver") {
        const name = cleanName(interaction.options.getString("unidad"));

        const unit = db.prepare(`
          SELECT units.*, vehicles.name AS vehicle_name, vehicles.description AS vehicle_description
          FROM units
          LEFT JOIN vehicles ON units.vehicle_id = vehicles.id
          WHERE units.name = ?
        `).get(name);

        if (!unit) return await interaction.editReply(`No existe la unidad **${name}**.`);

        const members = db.prepare("SELECT discord_id FROM unit_members WHERE unit_id = ?")
          .all(unit.id);

        const image = unit.vehicle_id
          ? db.prepare("SELECT image_url FROM vehicle_images WHERE vehicle_id = ? LIMIT 1")
              .get(unit.vehicle_id)
          : null;

        const embed = new EmbedBuilder()
          .setTitle(`Unidad ${unit.name}`)
          .addFields(
            {
              name: "Categoría",
              value: categoryName(unit.category)
            },
            {
              name: "Miembros",
              value: members.length
                ? members.map(m => `<@${m.discord_id}>`).join("\n")
                : "Sin miembros"
            },
            {
              name: "Vehículo",
              value: unit.vehicle_name
                ? `**${unit.vehicle_name}**\n${unit.vehicle_description}`
                : "Sin vehículo asignado"
            }
          );

        if (image) embed.setImage(image.image_url);

        return await interaction.editReply({ embeds: [embed] });
      }
    }

    if (interaction.commandName === "vehiculo") {
      await interaction.deferReply();

      const sub = interaction.options.getSubcommand();

      if (sub === "crear") {
        const name = cleanName(interaction.options.getString("nombre"));
        const description = interaction.options.getString("descripcion");

        const exists = getVehicleByName(name);
        if (exists) return await interaction.editReply(`El vehículo **${name}** ya existe.`);

        db.prepare("INSERT INTO vehicles (name, description) VALUES (?, ?)")
          .run(name, description);

        return await interaction.editReply(`Vehículo **${name}** creado ✅`);
      }

      if (sub === "eliminar") {
        const name = cleanName(interaction.options.getString("vehiculo"));
        const vehicle = getVehicleByName(name);

        if (!vehicle) return await interaction.editReply(`No existe el vehículo **${name}**.`);

        db.prepare("UPDATE units SET vehicle_id = NULL WHERE vehicle_id = ?").run(vehicle.id);
        db.prepare("DELETE FROM vehicle_images WHERE vehicle_id = ?").run(vehicle.id);
        db.prepare("DELETE FROM vehicles WHERE id = ?").run(vehicle.id);

        return await interaction.editReply(`Vehículo **${name}** eliminado ❌`);
      }

      if (sub === "imagen") {
        const name = cleanName(interaction.options.getString("vehiculo"));
        const image = interaction.options.getAttachment("imagen");
        const vehicle = getVehicleByName(name);

        if (!vehicle) return await interaction.editReply(`No existe el vehículo **${name}**.`);

        db.prepare("INSERT INTO vehicle_images (vehicle_id, image_url) VALUES (?, ?)")
          .run(vehicle.id, image.url);

        return await interaction.editReply(`Imagen añadida a **${name}** ✅`);
      }

      if (sub === "ver") {
        const name = cleanName(interaction.options.getString("vehiculo"));
        const vehicle = getVehicleByName(name);

        if (!vehicle) return await interaction.editReply(`No existe el vehículo **${name}**.`);

        const images = db.prepare("SELECT image_url FROM vehicle_images WHERE vehicle_id = ?")
          .all(vehicle.id);

        const embed = new EmbedBuilder()
          .setTitle(vehicle.name)
          .setDescription(vehicle.description)
          .addFields({
            name: "Imágenes",
            value: images.length ? `${images.length} imagen/es guardada/s` : "Sin imágenes"
          });

        if (images.length) embed.setImage(images[0].image_url);

        return await interaction.editReply({ embeds: [embed] });
      }
    }

    if (interaction.commandName === "plantilla") {
      await interaction.deferReply();

      const sub = interaction.options.getSubcommand();
      if (sub !== "generar") return;

      const units = db.prepare(`
        SELECT units.*, vehicles.name AS vehicle_name
        FROM units
        LEFT JOIN vehicles ON units.vehicle_id = vehicles.id
        ORDER BY 
          CASE units.category
            WHEN 'H50' THEN 1
            WHEN 'SUPERVISORAS' THEN 2
            WHEN 'GAC' THEN 3
            ELSE 4
          END,
          units.name
      `).all();

      if (!units.length) {
        return await interaction.editReply("No hay unidades creadas.");
      }

      const now = new Date();
      const fecha = now.toLocaleDateString("es-ES");
      const hora = now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit"
      });

      let text = `🚔 **PLANTILLA**\n\n`;
      text += `📅 **Fecha:** ${fecha}\n`;
      text += `🕒 **Hora:** ${hora}\n\n`;

      const categories = ["H50", "SUPERVISORAS", "GAC"];

      for (const category of categories) {
        const categoryUnits = units.filter(u => u.category === category);
        if (!categoryUnits.length) continue;

        text += `**${categoryName(category)}**\n\n`;

        for (const unit of categoryUnits) {
          const members = db.prepare("SELECT discord_id FROM unit_members WHERE unit_id = ?")
            .all(unit.id);

          text += `**${unit.name}:**\n`;

          if (members.length) {
            for (const member of members) {
              text += `• <@${member.discord_id}>\n`;
            }
          } else {
            text += `• Sin miembros\n`;
          }

          text += `🚗 Vehículo: ${unit.vehicle_name || "Sin vehículo"}\n\n`;
        }
      }

      return await interaction.editReply(text);
    }
  } catch (error) {
    console.error("ERROR EN INTERACTION:", error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("Ha ocurrido un error en el bot.");
      } else {
        await interaction.reply("Ha ocurrido un error en el bot.");
      }
    } catch (replyError) {
      console.error("ERROR AL RESPONDER:", replyError);
    }
  }
});

const token = process.env.Discord_Token || process.env.DISCORD_TOKEN;

if (!token) {
  console.error("NO HAY TOKEN. Revisa las variables de Railway.");
  process.exit(1);
}

client.login(token);