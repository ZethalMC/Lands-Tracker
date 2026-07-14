import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import {
  getGuildConfig,
  setStaffRoles,
  setBackupChannel,
  setClaimAlertChannel,
  setClaimAlertMessage,
  setClaimAlertPingRoles,
} from "../lib/guildConfig.js";

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Open the server configuration panel (staff roles, backups, claim-deletion alerts).")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

// Every interactive component below is routed here by custom_id prefix — see index.js.
export const CUSTOM_ID_PREFIX = "config:";
const IDS = {
  staffRoles: "config:staffRoles",
  backupChannel: "config:backupChannel",
  claimChannel: "config:claimChannel",
  pingRoles: "config:pingRoles",
  editMessageButton: "config:editMessageButton",
  editMessageModal: "config:editMessageModal",
};

function formatMentions(roleIds, emptyText) {
  if (!roleIds || roleIds.length === 0) return emptyText;
  return roleIds.map((id) => `<@&${id}>`).join(", ");
}

function buildPanel(config) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents((text) => text.setContent("## Server Configuration"))
    .addTextDisplayComponents((text) =>
      text.setContent(
        [
          `**Staff roles:** ${formatMentions(config.staffRoleIds, "none — Manage Server only")}`,
          `**Archive backup channel:** ${config.backupChannelId ? `<#${config.backupChannelId}>` : "not set"}`,
          `**Claim-alert channel:** ${
            config.claimAlerts.channelId ? `<#${config.claimAlerts.channelId}>` : "not set (alerts off)"
          }`,
          `**Claim-alert ping roles:** ${formatMentions(config.claimAlerts.pingRoleIds, "none")}`,
          `**Claim-alert message:**\n${config.claimAlerts.message}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents((separator) => separator)
    .addActionRowComponents((row) =>
      row.addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(IDS.staffRoles)
          .setPlaceholder("Staff roles (who can use archive commands)")
          .setMinValues(0)
          .setMaxValues(25)
          .setDefaultRoles(config.staffRoleIds)
      )
    )
    .addActionRowComponents((row) =>
      row.addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(IDS.backupChannel)
          .setPlaceholder("Archive backup channel")
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
          .setDefaultChannels(config.backupChannelId ? [config.backupChannelId] : [])
      )
    )
    .addActionRowComponents((row) =>
      row.addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(IDS.claimChannel)
          .setPlaceholder("Claim-deletion alert channel")
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
          .setDefaultChannels(config.claimAlerts.channelId ? [config.claimAlerts.channelId] : [])
      )
    )
    .addActionRowComponents((row) =>
      row.addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(IDS.pingRoles)
          .setPlaceholder("Roles to ping on claim-deletion alerts")
          .setMinValues(0)
          .setMaxValues(25)
          .setDefaultRoles(config.claimAlerts.pingRoleIds)
      )
    )
    .addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(IDS.editMessageButton)
          .setLabel("Edit Alert Message")
          .setStyle(ButtonStyle.Secondary)
      )
    );

  return {
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [container],
  };
}

export async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  await interaction.reply(buildPanel(config));
}

/** Handles every select-menu/button interaction whose custom_id starts with "config:". */
export async function handleComponent(interaction) {
  const guildId = interaction.guildId;

  if (interaction.customId === IDS.editMessageButton) {
    const config = await getGuildConfig(guildId);
    const modal = new ModalBuilder()
      .setCustomId(IDS.editMessageModal)
      .setTitle("Claim-Alert Message Template")
      .addActionRowComponents((row) =>
        row.addComponents(
          new TextInputBuilder()
            .setCustomId("template")
            .setLabel("Message Template")
            .setPlaceholder("{town} {map} {nation} {mayor} {founded} {residentCount} {pvp} {public}")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.claimAlerts.message)
            .setMaxLength(1000)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId === IDS.staffRoles) {
    await setStaffRoles(guildId, interaction.values);
  } else if (interaction.customId === IDS.backupChannel) {
    await setBackupChannel(guildId, interaction.values[0] ?? null);
  } else if (interaction.customId === IDS.claimChannel) {
    await setClaimAlertChannel(guildId, interaction.values[0] ?? null);
  } else if (interaction.customId === IDS.pingRoles) {
    await setClaimAlertPingRoles(guildId, interaction.values);
  } else {
    return;
  }

  const updated = await getGuildConfig(guildId);
  await interaction.update(buildPanel(updated));
}

/** Handles the message-template modal submission. */
export async function handleModal(interaction) {
  if (interaction.customId !== IDS.editMessageModal) return;
  const template = interaction.fields.getTextInputValue("template");
  await setClaimAlertMessage(interaction.guildId, template);
  const updated = await getGuildConfig(interaction.guildId);
  await interaction.update(buildPanel(updated));
}
