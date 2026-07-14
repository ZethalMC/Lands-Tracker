import { PermissionFlagsBits } from "discord.js";
import { getGuildConfig } from "./guildConfig.js";

/**
 * A user may run the archive/render commands if they have Manage Server, or
 * hold one of this guild's configured staff roles (set via /config role).
 * Replaces the original's hardcoded, always-true role-ID check — if no
 * staff roles are configured yet, this safely defaults to Manage Server only.
 */
export async function canUseStaffCommand(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (!interaction.guildId) return false;

  const config = await getGuildConfig(interaction.guildId);
  if (config.staffRoleIds.length === 0) return false;

  const memberRoleIds = interaction.member?.roles?.cache
    ? [...interaction.member.roles.cache.keys()]
    : [];
  return config.staffRoleIds.some((roleId) => memberRoleIds.includes(roleId));
}
