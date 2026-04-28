require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// UNIDADES FIJAS
const unidades = {
  GOES: { miembros: [], vehiculo: null },
  GEO: { miembros: [], vehiculo: null },
  UIP: { miembros: [], vehiculo: null },
  UPR: { miembros: [], vehiculo: null },
  FDF: { miembros: [], vehiculo: null },
  CGPJ: { miembros: [], vehiculo: null },
  CGPC: { miembros: [], vehiculo: null },
  CGI: { miembros: [], vehiculo: null },
  UAI: { miembros: [], vehiculo: null },
  UEGC: { miembros: [], vehiculo: null }
};

const vehiculos = {};

// PLANTILLA
let plantillaMsg = null;

function generarPlantilla() {
  let texto = "🚔 **PLANTILLA DE SERVICIO**\n\n";

  for (const [nombre, unidad] of Object.entries(unidades)) {
    texto += `**${nombre}**\n`;

    if (unidad.miembros.length) {
      unidad.miembros.forEach(m => {
        texto += `• ${m}\n`;
      });
    } else {
      texto += `• Sin miembros\n`;
    }

    texto += `🚗 ${unidad.vehiculo || "Sin vehículo"}\n\n`;
  }

  return texto;
}

async function actualizarPlantilla() {
  if (!plantillaMsg) return;
  await plantillaMsg.edit(generarPlantilla());
}

client.once("ready", () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  // PING
  if (commandName === "ping") {
    return interaction.reply("Pong 🟢");
  }

  // UNIDAD
  if (commandName === "unidad") {
    const sub = options.getSubcommand();
    const unidadNombre = options.getString("unidad");

    if (!unidades[unidadNombre]) {
      return interaction.reply("❌ Unidad no válida");
    }

    // ASIGNAR
    if (sub === "asignar") {
      const user = options.getUser("usuario");
      unidades[unidadNombre].miembros.push(`<@${user.id}>`);
      await actualizarPlantilla();
      return interaction.reply(`✅ ${user} asignado a ${unidadNombre}`);
    }

    // QUITAR
    if (sub === "quitar") {
      const user = options.getUser("usuario");
      unidades[unidadNombre].miembros =
        unidades[unidadNombre].miembros.filter(m => m !== `<@${user.id}>`);
      await actualizarPlantilla();
      return interaction.reply(`❌ ${user} quitado de ${unidadNombre}`);
    }

    // VEHICULO
    if (sub === "vehiculo") {
      const vehiculo = options.getString("vehiculo");

      if (!vehiculos[vehiculo]) {
        return interaction.reply("❌ Vehículo no existe");
      }

      unidades[unidadNombre].vehiculo = vehiculo;
      await actualizarPlantilla();
      return interaction.reply(`🚗 Vehículo asignado a ${unidadNombre}`);
    }

    // VER
    if (sub === "ver") {
      const u = unidades[unidadNombre];
      return interaction.reply(
        `📋 ${unidadNombre}\n👥 ${u.miembros.join(", ") || "Nadie"}\n🚗 ${u.vehiculo || "Ninguno"}`
      );
    }
  }

  // VEHICULO
  if (commandName === "vehiculo") {
    const sub = options.getSubcommand();

    if (sub === "crear") {
      const nombre = options.getString("nombre");
      const desc = options.getString("descripcion");

      vehiculos[nombre] = desc;
      return interaction.reply(`🚗 Vehículo ${nombre} creado`);
    }

    if (sub === "eliminar") {
      const nombre = options.getString("vehiculo");
      delete vehiculos[nombre];
      return interaction.reply(`🗑️ Vehículo eliminado`);
    }

    if (sub === "ver") {
      const nombre = options.getString("vehiculo");
      return interaction.reply(`🚗 ${nombre}: ${vehiculos[nombre] || "No existe"}`);
    }
  }

  // PLANTILLA
  if (commandName === "plantilla") {
    const sub = options.getSubcommand();

    if (sub === "crear") {
      plantillaMsg = await interaction.channel.send(generarPlantilla());
      return interaction.reply("✅ Plantilla creada");
    }

    if (sub === "actualizar") {
      await actualizarPlantilla();
      return interaction.reply("🔄 Actualizada");
    }

    if (sub === "limpiar") {
      for (const unidad of Object.values(unidades)) {
        unidad.miembros = [];
        unidad.vehiculo = null;
      }

      await actualizarPlantilla();
      return interaction.reply("🧹 Plantilla limpiada");
    }
  }
});

client.login(process.env.TOKEN);
