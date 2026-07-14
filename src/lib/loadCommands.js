import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const COMMANDS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "commands");

/** Dynamically imports every command module in src/commands, keyed by command name. */
export async function loadCommands() {
  const commands = new Map();
  const files = readdirSync(COMMANDS_DIR).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(COMMANDS_DIR, file);
    const command = await import(pathToFileURL(filePath).href);
    if (!command.data || !command.execute) {
      console.warn(`[commands] skipping ${file}: missing "data" or "execute" export`);
      continue;
    }
    commands.set(command.data.name, command);
  }

  return commands;
}
