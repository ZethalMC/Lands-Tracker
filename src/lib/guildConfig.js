import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CONFIG_PATH = path.join(process.cwd(), "data", "config", "guilds.json");

export const DEFAULT_CLAIM_ALERT_MESSAGE =
  "🏚️ **{town}** has been deleted on {map}.\n" +
  "Nation: {nation} | Mayor: {mayor} | Founded: {founded}\n" +
  "Residents: {residentCount} | PVP: {pvp} | Public: {public}";

const DEFAULT_CONFIG = {
  staffRoleIds: [],
  backupChannelId: null,
  claimAlerts: { channelId: null, message: DEFAULT_CLAIM_ALERT_MESSAGE, pingRoleIds: [] },
};

function withDefaults(stored) {
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    claimAlerts: { ...DEFAULT_CONFIG.claimAlerts, ...stored?.claimAlerts },
  };
}

async function readStore() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeStore(store) {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(store, null, 2));
}

export async function getGuildConfig(guildId) {
  const store = await readStore();
  return withDefaults(store[guildId]);
}

/** Returns { guildId: config } for every guild with a stored config — used for backup/alert fan-out. */
export async function getAllGuildConfigs() {
  const store = await readStore();
  return Object.fromEntries(Object.entries(store).map(([guildId, config]) => [guildId, withDefaults(config)]));
}

async function updateGuildConfig(guildId, mutate) {
  const store = await readStore();
  const config = withDefaults(store[guildId]);
  mutate(config);
  store[guildId] = config;
  await writeStore(store);
  return config;
}

/** Each setter below replaces the whole value — matches how a select menu reports its full current selection, not an incremental add/remove. */

export function setStaffRoles(guildId, roleIds) {
  return updateGuildConfig(guildId, (config) => {
    config.staffRoleIds = roleIds;
  });
}

export function setBackupChannel(guildId, channelId) {
  return updateGuildConfig(guildId, (config) => {
    config.backupChannelId = channelId;
  });
}

export function setClaimAlertChannel(guildId, channelId) {
  return updateGuildConfig(guildId, (config) => {
    config.claimAlerts.channelId = channelId;
  });
}

export function setClaimAlertMessage(guildId, message) {
  return updateGuildConfig(guildId, (config) => {
    config.claimAlerts.message = message;
  });
}

export function setClaimAlertPingRoles(guildId, roleIds) {
  return updateGuildConfig(guildId, (config) => {
    config.claimAlerts.pingRoleIds = roleIds;
  });
}
