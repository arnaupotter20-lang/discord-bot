require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Database = require("better-sqlite3");

const db = new Database("database.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  category TEXT,
  vehicle_id INTEGER,
  zone_id INTEGER
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  unit_id INTEGER,
  discord_id TEXT
);

CREATE TABLE IF NOT EXISTS plantilla (
  channel_id TEXT,
  message_id TEXT
);
`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function limpiar(t){return t.trim().toUpperCase();}

function hora(){
  return new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
}

function plantilla(){
  const data = db.prepare(`
  SELECT units.*, vehicles.name v, zones.name z
  FROM units
  LEFT JOIN vehicles ON units.vehicle_id=vehicles.id
  LEFT JOIN zones ON units.zone_id=zones.id
  `).all();

  let txt = `🚔 PLANTILLA\n🕒 ${hora()}\n\n`;

  for(const u of data){
    const miembros = db.prepare("SELECT discord_id FROM members WHERE unit_id=?").all(u.id);
    txt += `**${u.name}** (${u.category})\n`;
    txt += miembros.length ? miembros.map(m=>`• <@${m.discord_id}>`).join("\n")+"\n" : "• Sin miembros\n";
    txt += `🚗 ${u.v || "Sin vehículo"}\n`;
    txt += `📍 ${u.z || "Sin zona"}\n\n`;
  }

  return txt;
}

async function actualizar(){
  const p = db.prepare("SELECT * FROM plantilla").get();
  if(!p) return;

  const ch = await client.channels.fetch(p.channel_id);
  const msg = await ch.messages.fetch(p.message_id);

  await msg.edit(plantilla());
}

client.on("interactionCreate", async i=>{
  try{

  if(i.isAutocomplete()){
    const f=i.options.getFocused().toUpperCase();
    const n=i.options.getFocused(true).name;

    let rows=[];

    if(n==="unidad") rows=db.prepare("SELECT name FROM units").all();
    if(n==="vehiculo") rows=db.prepare("SELECT name FROM vehicles").all();
    if(n==="zona") rows=db.prepare("SELECT name FROM zones").all();

    return i.respond(rows.map(r=>({name:r.name,value:r.name})));
  }

  if(!i.isChatInputCommand()) return;

  if(i.commandName==="unidad"){
    await i.deferReply();
    const sub=i.options.getSubcommand();

    if(sub==="crear"){
      const n=limpiar(i.options.getString("nombre"));
      const c=i.options.getString("categoria");

      db.prepare("INSERT INTO units (name,category) VALUES (?,?)").run(n,c);
      await actualizar();
      return i.editReply("Unidad creada");
    }

    if(sub==="asignar"){
      const u=db.prepare("SELECT * FROM units WHERE name=?").get(limpiar(i.options.getString("unidad")));
      const user=i.options.getUser("usuario");
      db.prepare("INSERT INTO members (unit_id,discord_id) VALUES (?,?)").run(u.id,user.id);
      await actualizar();
      return i.editReply("Asignado");
    }

    if(sub==="quitar"){
      const u=db.prepare("SELECT * FROM units WHERE name=?").get(limpiar(i.options.getString("unidad")));
      const user=i.options.getUser("usuario");
      db.prepare("DELETE FROM members WHERE unit_id=? AND discord_id=?").run(u.id,user.id);
      await actualizar();
      return i.editReply("Quitado");
    }

    if(sub==="vehiculo"){
      const u=db.prepare("SELECT * FROM units WHERE name=?").get(limpiar(i.options.getString("unidad")));
      const v=db.prepare("SELECT * FROM vehicles WHERE name=?").get(limpiar(i.options.getString("vehiculo")));
      db.prepare("UPDATE units SET vehicle_id=? WHERE id=?").run(v.id,u.id);
      await actualizar();
      return i.editReply("Vehículo asignado");
    }

    if(sub==="quitarvehiculo"){
      const u=db.prepare("SELECT * FROM units WHERE name=?").get(limpiar(i.options.getString("unidad")));
      db.prepare("UPDATE units SET vehicle_id=NULL WHERE id=?").run(u.id);
      await actualizar();
      return i.editReply("Vehículo quitado");
    }

    if(sub==="zona"){
      const u=db.prepare("SELECT * FROM units WHERE name=?").get(limpiar(i.options.getString("unidad")));
      const z=db.prepare("SELECT * FROM zones WHERE name=?").get(limpiar(i.options.getString("zona")));
      db.prepare("UPDATE units SET zone_id=? WHERE id=?").run(z.id,u.id);
      await actualizar();
      return i.editReply("Zona asignada");
    }
  }

  if(i.commandName==="vehiculo"){
    await i.deferReply();
    const sub=i.options.getSubcommand();

    if(sub==="crear"){
      db.prepare("INSERT INTO vehicles (name,description) VALUES (?,?)")
      .run(limpiar(i.options.getString("nombre")),i.options.getString("descripcion"));
      return i.editReply("Vehículo creado");
    }

    if(sub==="eliminar"){
      db.prepare("DELETE FROM vehicles WHERE name=?")
      .run(limpiar(i.options.getString("vehiculo")));
      await actualizar();
      return i.editReply("Vehículo eliminado");
    }
  }

  if(i.commandName==="zona"){
    await i.deferReply();
    const sub=i.options.getSubcommand();

    if(sub==="crear"){
      db.prepare("INSERT INTO zones (name,description) VALUES (?,?)")
      .run(limpiar(i.options.getString("nombre")),i.options.getString("descripcion"));
      return i.editReply("Zona creada");
    }

    if(sub==="eliminar"){
      db.prepare("DELETE FROM zones WHERE name=?")
      .run(limpiar(i.options.getString("zona")));
      await actualizar();
      return i.editReply("Zona eliminada");
    }
  }

  if(i.commandName==="plantilla"){
    await i.deferReply();
    const sub=i.options.getSubcommand();

    if(sub==="crear"){
      const msg=await i.channel.send(plantilla());
      db.prepare("DELETE FROM plantilla").run();
      db.prepare("INSERT INTO plantilla VALUES (?,?)").run(i.channel.id,msg.id);
      return i.editReply("Plantilla creada");
    }

    if(sub==="limpiar"){
      db.prepare("DELETE FROM members").run();
      db.prepare("UPDATE units SET vehicle_id=NULL, zone_id=NULL").run();
      await actualizar();
      return i.editReply("Plantilla limpiada");
    }
  }

  }catch(e){
    console.error(e);
    return i.reply("Error");
  }
});

client.login(process.env.TOKEN);
