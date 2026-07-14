import { readFileSync } from "node:fs";
import path from "node:path";
import { AttachmentBuilder, ContainerBuilder, MessageFlags } from "discord.js";

const LOGO_PATH = path.join(process.cwd(), "assets", "towny1k.png");
const LOGO_BUFFER = readFileSync(LOGO_PATH);

/** Builds the Components V2 message for a rendered town PNG/GIF. */
export function buildRenderResponse({ title, imageBuffer, imageExtension }) {
  const imageFileName = `image.${imageExtension}`;
  const imageAttachment = new AttachmentBuilder(imageBuffer, { name: imageFileName });
  const logoAttachment = new AttachmentBuilder(LOGO_BUFFER, { name: "logo.png" });

  const container = new ContainerBuilder()
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) => text.setContent(`**${title}**\nEarthMC Towny Archive`))
        .setThumbnailAccessory((thumbnail) => thumbnail.setURL("attachment://logo.png"))
    )
    .addSeparatorComponents((separator) => separator)
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL(`attachment://${imageFileName}`))
    )
    .addTextDisplayComponents((text) => text.setContent("-# Archive updated daily"));

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files: [imageAttachment, logoAttachment],
  };
}

/** Builds the Components V2 message for a /townsearch result list. */
export function buildSearchResponse({ query, results }) {
  const list = results.length > 0 ? results.map((label) => `- ${label}`).join("\n") : "*No matches found.*";
  const container = new ContainerBuilder().addTextDisplayComponents((text) =>
    text.setContent(`**Town search: "${query}"**\n${list}`)
  );

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

/** Builds a plain Components V2 text message (errors, status text, etc.). */
export function buildTextResponse(content, { ephemeral = false } = {}) {
  const container = new ContainerBuilder().addTextDisplayComponents((text) => text.setContent(content));
  return {
    flags: ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function titledContainer(title, accentColor) {
  const container = new ContainerBuilder().addTextDisplayComponents((text) => text.setContent(`## ${title}`));
  if (accentColor != null) container.setAccentColor(accentColor);
  return container;
}

/**
 * Builds the Components V2 message for a claim-deletion alert. `blocks` is
 * one already-templated text entry per deleted town (joined with blank
 * lines); `pingRoleIds` are mentioned above the list and set in
 * allowedMentions so they actually notify.
 */
export function buildClaimAlertResponse({ source, blocks, pingRoleIds = [], count }) {
  const container = titledContainer(`🏚️ Claim Deletion${count === 1 ? "" : "s"} — ${source.label}`, 0xaa4444);
  if (pingRoleIds.length > 0) {
    container.addTextDisplayComponents((text) => text.setContent(pingRoleIds.map((id) => `<@&${id}>`).join(" ")));
  }
  container.addSeparatorComponents((separator) => separator).addTextDisplayComponents((text) =>
    text.setContent(blocks.join("\n\n"))
  );

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: { roles: pingRoleIds },
  };
}
