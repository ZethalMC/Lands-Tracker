import { REST, Routes } from "discord.js";
import { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } from "./config.js";
import { loadCommands } from "./lib/loadCommands.js";

const commands = await loadCommands();
const body = [...commands.values()].map((command) => command.data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);

const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

console.log(
  GUILD_ID
    ? `Registering ${body.length} command(s) to guild ${GUILD_ID} (instant, dev mode)...`
    : `Registering ${body.length} command(s) globally (production, ~1hr to propagate)...`
);

const result = await rest.put(route, { body });
console.log(`Registered ${result.length} command(s): ${result.map((c) => c.name).join(", ")}`);
