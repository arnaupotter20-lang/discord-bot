require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

function unidadOption(option) {
  return option
    .setName("unidad")
    .setDescription("Selecciona la unidad")
    .setRequired(true)
    .setAutocomplete(true);
}

function vehiculoOption(option) {
  return option
    .setName("vehiculo")
    .setDescription("Selecciona el vehículo")
    .setRequired(true)
    .setAutocomplete(true);
}

const categorias = [
  { name: "H-50", value: "H-50" },
  { name: "Supervisora", value: "SUPERVISORA" },
  { name: "GAC", value: "GAC" },
  { name: "UPR", value: "UPR" },
  { name: "GOES", value: "GOES" },
  { name: "GEO", value: "GEO" },
  { name: "UIP", value: "UIP" },
  { name: "FDF", value: "FDF" },
  { name: "CGPJ", value: "CGPJ" },
  { name: "CGPC", value: "CGPC" },
  { name: "CGI", value: "CGI" },
  { name: "UAI", value: "UAI" },
  { name: "UEGC", value: "UEGC" }
];

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
        .setDescription("Crear una unidad")
        .addStringOption(option =>
          option.setName("nombre").setDescription("Nombre de la unidad").setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("categoria")
            .setDescription("Categoría de la unidad")
            .setRequired(true)
            .addChoices(...categorias)
        )
    )
    .addSubcommand(sub =>
      sub.setName("eliminar").setDescription("Eliminar una unidad").addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub.setName("ver").setDescription("Ver una unidad").addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("asignar")
        .setDescription("Asignar persona a una unidad")
        .addUserOption(option =>
          option.setName("usuario").setDescription("Usuario").setRequired(true)
        )
        .addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("quitar")
        .setDescription("Quitar persona de una unidad")
        .addUserOption(option =>
          option.setName("usuario").setDescription("Usuario").setRequired(true)
        )
        .addStringOption(unidadOption)
    )
    .addSubcommand(sub =>
      sub
        .setName("quitar vehiculo")
        .setDescription("Quitar vehículo de una unidad")
        .addStringOption(unidadOption)
        )
    .addSubcommand(sub =>
      sub
        .setName("zona")
        .setDescription("Asignar zona a unidad")
        .addStringOption(unidadOption)
        .addStringOption(option =>
          option.setName("zona").setRequired(true).setAutocomplete(true)
        )
    )
  
    .addSubcommand(sub =>
      sub
        .setName("vehiculo")
        .setDescription("Asignar vehículo a una unidad")
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
        .addStringOption(option =>
          option.setName("nombre").setDescription("Nombre del vehículo").setRequired(true)
        )
        .addStringOption(option =>
          option.setName("descripcion").setDescription("Descripción").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("eliminar").setDescription("Eliminar vehículo").addStringOption(vehiculoOption)
    )
    .addSubcommand(sub =>
      sub.setName("ver").setDescription("Ver vehículo").addStringOption(vehiculoOption)
    ),
  
new SlashCommandBuilder()
  .setName("zona")
  .setDescription("Gestionar zonas")
  .addSubcommand(sub =>
    sub
      .setName("crear")
      .setDescription("Crear zona")
      .addStringOption(option =>
        option.setName("nombre").setRequired(true)
      )
      .addStringOption(option =>
        option.setName("descripcion").setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("eliminar")
      .setDescription("Eliminar zona")
      .addStringOption(option =>
        option.setName("zona").setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("ver")
      .setDescription("Ver zona")
      .addStringOption(option =>
        option.setName("zona").setRequired(true).setAutocomplete(true)
      )
  ),
  
  new SlashCommandBuilder()
    .setName("plantilla")
    .setDescription("Gestionar plantilla")
    .addSubcommand(sub =>
      sub.setName("crear").setDescription("Crear plantilla fija")
    )
    .addSubcommand(sub =>
      sub.setName("actualizar").setDescription("Actualizar plantilla")
    )
    .addSubcommand(sub =>
      sub.setName("limpiar").setDescription("Limpiar personas y vehículos")
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log("Comandos registrados correctamente.");
  } catch (error) {
    console.error(error);
  }
})();
