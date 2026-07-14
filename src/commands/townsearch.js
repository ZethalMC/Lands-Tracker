import { SlashCommandBuilder } from "discord.js";
import { canUseStaffCommand } from "../lib/permissions.js";
import { parseUserDate } from "../lib/archive.js";
import { searchTownLabels } from "../lib/townData.js";
import { buildSearchResponse, buildTextResponse } from "../lib/responseComponents.js";
import { DEFAULT_SOURCE_ID, mapSourceChoices } from "../lib/mapSources.js";

export const data = new SlashCommandBuilder()
  .setName("townsearch")
  .setDescription("List archived town names starting with a search string for a given date.")
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt.setName("query").setDescription("Prefix to search for, case sensitive").setRequired(true)
  )
  .addStringOption((opt) => opt.setName("date").setDescription("Date as D.M.YY, e.g. 1.1.23").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("map").setDescription("Which server's map to use (default: EarthMC)").addChoices(...mapSourceChoices())
  );

export async function execute(interaction) {
  if (!(await canUseStaffCommand(interaction))) {
    await interaction.reply(buildTextResponse("You don't have permission to use this command.", { ephemeral: true }));
    return;
  }

  const query = interaction.options.getString("query", true);
  const dateToken = interaction.options.getString("date", true);
  const sourceId = interaction.options.getString("map") ?? DEFAULT_SOURCE_ID;

  const isoDate = parseUserDate(dateToken);
  if (!isoDate) {
    await interaction.reply(
      buildTextResponse(`Invalid date: \`${dateToken}\`. Use D.M.YY, e.g. 1.1.23.`, { ephemeral: true })
    );
    return;
  }

  await interaction.deferReply();
  const results = await searchTownLabels([query], sourceId, isoDate);
  await interaction.editReply(buildSearchResponse({ query, results }));
}
