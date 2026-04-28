require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

function unidadOption(opt) {
  return opt
    .setName("unidad")
    .setDescription("Selecciona la unidad")
    .setRequired(true)
    .setAutocomplete(true);
}

function vehiculoOption(opt) {
  return opt
    .setName("vehiculo")
    .setDescription("Selecciona el vehículo")
    .setRequired(true)
    .setAutocomplete(true);
}

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba si el bot responde"),

  new SlashCommandBuilder()
    .setName("unidad")
    .setDescription("Gestionar unidades")
    .addSubcommand(sub =>
      sub
        .setName("crear")
        .setDescription("Crear unidad")
        .addStringOption(opt =>
          opt.setName("nombre").setDescription("Nombre, ejemplo Z-01").setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName("categoria")
            .setDescription("Categoría")
            .setRequired(true)
            .addChoices(
              { name: "H-50", value: "H50" },
              { name: "Unidades Supervisoras", value: "SUPERVISORAS" },
              { name: "Unidades G.A.C", value: "GAC" }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("ver").setDescription("Ver unidad").addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub.setName("eliminar").setDescription("Eliminar unidad").addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("asignar")
        .setDescription("Asignar persona a unidad")
        .addUserOption(opt =>
          opt.setName("usuario").setDescription("Usuario").setRequired(true)
        )
        .addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("quitar")
        .setDescription("Quitar persona de unidad")
        .addUserOption(opt =>
          opt.setName("usuario").setDescription("Usuario").setRequired(true)
        )
        .addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("vehiculo")
        .setDescription("Asignar vehículo a unidad")
        .addStringOption(unidadOption)
        .addStringOption(vehiculoOption)
    ),

  new SlashCommandBuilder()
    .setName("vehiculo")
    .setDescription("Gestionar vehículos")
    .addSubcommand(sub =>
      sub
        .setName("crear")
        .setDescription("Crear vehículo")
        .addStringOption(opt =>
          opt.setName("nombre").setDescription("Nombre del vehículo").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("descripcion").setDescription("Descripción").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("ver").setDescription("Ver vehículo").addStringOption(vehiculoOption)
    )
    .addSubcommand(sub =>
      sub.setName("eliminar").setDescription("Eliminar vehículo").addStringOption(vehiculoOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("imagen")
        .setDescription("Añadir imagen a vehículo")
        .addStringOption(vehiculoOption)
        .addAttachmentOption(opt =>
          opt.setName("imagen").setDescription("Imagen").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("plantilla")
    .setDescription("Generar plantilla de unidades")
    .addSubcommand(sub =>
      sub.setName("generar").setDescription("Generar plantilla completa")
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.Discord_Token);

(async () => {
  try {
    console.log("Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(process.env.Client_ID, process.env.Guild_ID),
      { body: commands }
    );

    console.log("Comandos registrados correctamente.");
  } catch (error) {
    console.error(error);
  }
})();
