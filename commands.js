require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

function unidadOption(option) {
  return option.setName("unidad").setRequired(true).setAutocomplete(true);
}

function vehiculoOption(option) {
  return option.setName("vehiculo").setRequired(true).setAutocomplete(true);
}

function zonaOption(option) {
  return option.setName("zona").setRequired(true).setAutocomplete(true);
}

const categorias = [
  { name: "H-50", value: "H50" },
  { name: "Supervisora", value: "SUPERVISORA" },
  { name: "GAC", value: "GAC" },
  { name: "UPR", value: "UPR" }
];

const commands = [

new SlashCommandBuilder()
  .setName("unidad")
  .setDescription("Gestión unidades")
  .addSubcommand(sub =>
    sub.setName("crear")
      .addStringOption(o => o.setName("nombre").setRequired(true))
      .addStringOption(o => o.setName("categoria").setRequired(true).addChoices(...categorias))
  )
  .addSubcommand(sub =>
    sub.setName("eliminar").addStringOption(unidadOption)
  )
  .addSubcommand(sub =>
    sub.setName("ver").addStringOption(unidadOption)
  )
  .addSubcommand(sub =>
    sub.setName("asignar")
      .addUserOption(o => o.setName("usuario").setRequired(true))
      .addStringOption(unidadOption)
  )
  .addSubcommand(sub =>
    sub.setName("quitar")
      .addUserOption(o => o.setName("usuario").setRequired(true))
      .addStringOption(unidadOption)
  )
  .addSubcommand(sub =>
    sub.setName("vehiculo")
      .addStringOption(unidadOption)
      .addStringOption(vehiculoOption)
  )
  .addSubcommand(sub =>
    sub.setName("quitarvehiculo")
      .addStringOption(unidadOption)
  )
  .addSubcommand(sub =>
    sub.setName("zona")
      .addStringOption(unidadOption)
      .addStringOption(zonaOption)
  ),

new SlashCommandBuilder()
  .setName("vehiculo")
  .setDescription("Gestión vehículos")
  .addSubcommand(sub =>
    sub.setName("crear")
      .addStringOption(o => o.setName("nombre").setRequired(true))
      .addStringOption(o => o.setName("descripcion").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("eliminar").addStringOption(vehiculoOption)
  ),

new SlashCommandBuilder()
  .setName("zona")
  .setDescription("Gestión zonas")
  .addSubcommand(sub =>
    sub.setName("crear")
      .addStringOption(o => o.setName("nombre").setRequired(true))
      .addStringOption(o => o.setName("descripcion").setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName("eliminar").addStringOption(zonaOption)
  ),

new SlashCommandBuilder()
  .setName("plantilla")
  .setDescription("Plantilla")
  .addSubcommand(sub => sub.setName("crear"))
  .addSubcommand(sub => sub.setName("limpiar"))
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
})();
