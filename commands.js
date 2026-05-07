require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

// ---------------- OPCIONES AUTOCOMPLETE ----------------

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

function zonaOption(option) {
  return option
    .setName("zona")
    .setDescription("Selecciona la zona")
    .setRequired(true)
    .setAutocomplete(true);
}

// ---------------- CATEGORÍAS ----------------

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

// ---------------- COMANDOS ----------------

const commands = [

  // ---------------- PING ----------------

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba si el bot responde"),

  // ---------------- UNIDAD ----------------

  new SlashCommandBuilder()
    .setName("unidad")
    .setDescription("Gestionar unidades")

    .addSubcommand(sub =>
      sub
        .setName("crear")
        .setDescription("Crear una unidad")
        .addStringOption(option =>
          option
            .setName("nombre")
            .setDescription("Nombre de la unidad")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("categoria")
            .setDescription("Categoría")
            .setRequired(true)
            .addChoices(...categorias)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("eliminar")
        .setDescription("Eliminar una unidad")
        .addStringOption(unidadOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("asignar")
        .setDescription("Asignar usuario")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuario")
            .setRequired(true)
        )
        .addStringOption(unidadOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("quitar")
        .setDescription("Quitar usuario")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuario")
            .setRequired(true)
        )
        .addStringOption(unidadOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("vehiculo")
        .setDescription("Asignar vehículo")
        .addStringOption(unidadOption)
        .addStringOption(vehiculoOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("vehiculo-quitar")
        .setDescription("Quitar vehículo")
        .addStringOption(unidadOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("zona-añadir")
        .setDescription("Añadir zona")
        .addStringOption(unidadOption)
        .addStringOption(zonaOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("zona-quitar")
        .setDescription("Quitar zona")
        .addStringOption(unidadOption)
        .addStringOption(zonaOption)
    ),

  // ---------------- VEHICULO ----------------

  new SlashCommandBuilder()
  .setName("vehiculo")
  .setDescription("Gestionar vehículos")

  // CREAR
  .addSubcommand(sub =>
    sub
      .setName("crear")
      .setDescription("Crear vehículo")
      .addStringOption(option =>
        option.setName("nombre").setDescription("Nombre").setRequired(true)
      )
      .addStringOption(option =>
        option.setName("descripcion").setDescription("Descripción").setRequired(true)
      )
  )

  // IMAGEN
  .addSubcommand(sub =>
    sub
      .setName("imagen")
      .setDescription("Añadir/cambiar imagen del vehículo")
      .addStringOption(vehiculoOption)
      .addAttachmentOption(option =>
        option
          .setName("imagen")
          .setDescription("Imagen del vehículo")
          .setRequired(true)
      )
  )

  // VER
  .addSubcommand(sub =>
    sub
      .setName("ver")
      .setDescription("Ver vehículo")
      .addStringOption(vehiculoOption)
  )

  // ---------------- ZONA ----------------

  new SlashCommandBuilder()
    .setName("zona")
    .setDescription("Gestionar zonas")

    .addSubcommand(sub =>
      sub
        .setName("crear")
        .setDescription("Crear zona")
        .addStringOption(option =>
          option
            .setName("nombre")
            .setDescription("Nombre")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("descripcion")
            .setDescription("Descripción")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("ver")
        .setDescription("Ver zona")
        .addStringOption(zonaOption)
    )

    .addSubcommand(sub =>
      sub
        .setName("eliminar")
        .setDescription("Eliminar zona")
        .addStringOption(zonaOption)
    ),

  // ---------------- PLANTILLA ----------------

  new SlashCommandBuilder()
    .setName("plantilla")
    .setDescription("Gestionar plantilla")

    .addSubcommand(sub =>
      sub
        .setName("crear")
        .setDescription("Crear plantilla")
    )

    .addSubcommand(sub =>
      sub
        .setName("actualizar")
        .setDescription("Actualizar plantilla")
    )

    .addSubcommand(sub =>
      sub
        .setName("limpiar")
        .setDescription("Limpiar plantilla")
    )

].map(command => command.toJSON());

// ---------------- REGISTRO ----------------

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Comandos registrados correctamente.");
  } catch (error) {
    console.error(error);
  }
})();
