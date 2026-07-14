import { SlashCommandBuilder } from "discord.js";
import { canUseStaffCommand } from "../lib/permissions.js";
import { parseUserDate } from "../lib/archive.js";
import { findTownPolygons } from "../lib/townData.js";
import { renderTownPng } from "../lib/render.js";
import { buildTownGif } from "../lib/gifBuilder.js";
import { buildRenderResponse, buildTextResponse } from "../lib/responseComponents.js";
import { DEFAULT_SOURCE_ID, mapSourceChoices } from "../lib/mapSources.js";

export const data = new SlashCommandBuilder()
  .setName("townrender")
  .setDescription("Render one or more towns' boundary for one date (image) or several dates (GIF).")
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt.setName("towns").setDescription("Space-separated town name(s), case sensitive").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("dates")
      .setDescription("Space-separated date(s) as D.M.YY, e.g. 1.12.21. One date = image, 2+ = GIF.")
      .setRequired(true)
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
  const dateTokens = interaction.options.getString("dates", true).split(/\s+/).filter(Boolean);
  const sourceId = interaction.options.getString("map") ?? DEFAULT_SOURCE_ID;

  const isoDates = dateTokens.map(parseUserDate);
  const invalidIndex = isoDates.indexOf(null);
  if (invalidIndex !== -1) {
    await interaction.reply(
      buildTextResponse(`Invalid date: \`${dateTokens[invalidIndex]}\`. Use D.M.YY, e.g. 1.12.21.`, {
        ephemeral: true,
      })
    );
    return;
  }

  await interaction.deferReply();

  if (isoDates.length === 1) {
    const polygons = await findTownPolygons(towns, sourceId, isoDates[0]);
    if (!polygons) {
      await interaction.editReply(
        buildTextResponse("Invalid date or town. Town names are case sensitive — check with `/townsearch`.")
      );
      return;
    }
    const png = await renderTownPng(sourceId, polygons, isoDates[0]);
    await interaction.editReply(
      buildRenderResponse({ title: towns.join(", "), imageBuffer: png, imageExtension: "png" })
    );
    return;
  }

  const gif = await buildTownGif(towns, sourceId, isoDates);
  if (!gif) {
    await interaction.editReply(
      buildTextResponse("Invalid date(s) or town. Town names are case sensitive — check with `/townsearch`.")
    );
    return;
  }
  await interaction.editReply(
    buildRenderResponse({ title: towns.join(", "), imageBuffer: gif, imageExtension: "gif" })
  );
}
