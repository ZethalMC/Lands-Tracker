import "dotenv/config";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

export const DISCORD_TOKEN = requireEnv("DISCORD_TOKEN");
export const CLIENT_ID = requireEnv("CLIENT_ID");
export const GUILD_ID = process.env.GUILD_ID || null;
export const OWNER_ID = process.env.OWNER_ID || null;
