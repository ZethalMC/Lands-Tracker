import { Client, GatewayIntentBits, Events, AttachmentBuilder } from "discord.js";
import { DISCORD_TOKEN, OWNER_ID } from "./config.js";
import { loadCommands } from "./lib/loadCommands.js";
import { downloadMarkers } from "./lib/download.js";
import { getAllGuildConfigs } from "./lib/guildConfig.js";
import { buildTextResponse } from "./lib/responseComponents.js";
import { MAP_SOURCES } from "./lib/mapSources.js";
import { checkForDeletedClaims } from "./lib/claimWatch.js";

const HOUR_MS = 60 * 60 * 1000;
const CLAIM_WATCH_MS = 5 * 60 * 1000;

if (!OWNER_ID) {
  console.warn("[config] OWNER_ID is not set — /shutdown will be unusable by anyone until it is.");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = await loadCommands();

async function uploadBackup(source, result) {
  const guildConfigs = await getAllGuildConfigs();
  for (const [guildId, guildConfig] of Object.entries(guildConfigs)) {
    if (!guildConfig.backupChannelId) continue;
    try {
      const channel = await client.channels.fetch(guildConfig.backupChannelId);
      if (!channel?.isTextBased()) continue;
      const attachment = new AttachmentBuilder(result.filePath, { name: `${source.label}_${result.isoDate}.json` });
      await channel.send({ files: [attachment] });
    } catch (err) {
      console.error(`[backup] failed to upload to guild ${guildId}, channel ${guildConfig.backupChannelId}:`, err);
    }
  }
}

/** Downloads today's marker data for every configured map source, uploading newly-downloaded files to configured backup channels. Mirrors Bot.py::HourCounter. */
async function runArchiveCycle() {
  for (const source of Object.values(MAP_SOURCES)) {
    const result = await downloadMarkers(source.id);
    if (result.downloaded) {
      console.log(`[archive] downloaded ${source.label} marker data for ${result.isoDate}`);
      await uploadBackup(source, result);
    }
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await runArchiveCycle();
  setInterval(runArchiveCycle, HOUR_MS);

  await checkForDeletedClaims(readyClient); // establishes the baseline; no alerts fire on this first call
  setInterval(() => checkForDeletedClaims(readyClient), CLAIM_WATCH_MS);
});

async function replyWithError(interaction) {
  const response = buildTextResponse("Something went wrong.", { ephemeral: true });
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(response).catch(() => {});
  } else {
    await interaction.reply(response).catch(() => {});
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[commands] received unknown command: ${interaction.commandName}`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[commands] error running /${interaction.commandName}:`, err);
      await replyWithError(interaction);
    }
    return;
  }

  // Interactive config panel: select menus, the "edit message" button, and its modal.
  const isConfigComponent = interaction.isMessageComponent() && interaction.customId?.startsWith("config:");
  const isConfigModal = interaction.isModalSubmit() && interaction.customId?.startsWith("config:");
  if (isConfigComponent || isConfigModal) {
    const configCommand = commands.get("config");
    try {
      if (isConfigComponent) await configCommand.handleComponent(interaction);
      else await configCommand.handleModal(interaction);
    } catch (err) {
      console.error(`[commands] error handling config component ${interaction.customId}:`, err);
      await replyWithError(interaction);
    }
  }
});

client.login(DISCORD_TOKEN);
