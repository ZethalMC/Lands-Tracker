import { SlashCommandBuilder } from "discord.js";
import { canUseStaffCommand } from "../lib/permissions.js";
import { parseUserDate, monthDateRange } from "../lib/archive.js";
import { buildTownGif } from "../lib/gifBuilder.js";
import { buildRenderResponse, buildTextResponse } from "../lib/responseComponents.js";
import { DEFAULT_SOURCE_ID, mapSourceChoices } from "../lib/mapSources.js";

export const data = new SlashCommandBuilder()
  .setName("gif")
  .setDescription("Render a 14-day (or up-to-today) animated GIF of a town's boundary from a start date.")
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt.setName("towns").setDescription("Space-separated town name(s), case sensitive").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("start_date").setDescription("Start date as D.M.YY, e.g. 23.12.22").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("map").setDescription("Which server's map to use (default: EarthMC)").addChoices(...mapSourceChoices())
  );

export async function execute(interaction) {
  if (!(await canUseStaffCommand(interaction))) {
    await interaction.reply(buildTextResponse("You don't have permission to use this command.", { ephemeral: true }));
    return;
  }

  const towns = interaction.options.getString("towns", true).split(/\s+/).filter(Boolean);
  const startDateToken = interaction.options.getString("start_date", true);
  const sourceId = interaction.options.getString("map") ?? DEFAULT_SOURCE_ID;

  const startIso = parseUserDate(startDateToken);
  if (!startIso) {
    await interaction.reply(
      buildTextResponse(`Invalid date: \`${startDateToken}\`. Use D.M.YY, e.g. 23.12.22.`, { ephemeral: true })
    );
    return;
  }

  await interaction.deferReply();

  const isoDates = monthDateRange(startIso);
  const gif = await buildTownGif(towns, sourceId, isoDates);
  if (!gif) {
    await interaction.editReply(
      buildTextResponse("Town or date not found. Town names are case sensitive — check with `/townsearch`.")
    );
    return;
  }
  await interaction.editReply(
    buildRenderResponse({ title: towns.join(", "), imageBuffer: gif, imageExtension: "gif" })
  );
}
