import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { buildTextResponse } from "../lib/responseComponents.js";

export const data = new SlashCommandBuilder()
  .setName("shutdown")
  .setDescription("Shuts the bot down. Bot owner only.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (interaction.user.id !== process.env.OWNER_ID) {
    await interaction.reply(buildTextResponse("Only the bot owner can run this command.", { ephemeral: true }));
    return;
  }
  await interaction.reply(buildTextResponse("Shutting down.", { ephemeral: true }));
  await interaction.client.destroy();
  process.exit(0);
}
