/**
 * Basic Ghost Labs - Project Eclipse
 * Copyright (c) 2026 Basic Ghost Labs. All rights reserved.
 */

import { defineModule } from "@platform/module-sdk";
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";

async function logAction(context: any, type: string, targetId: string, moderatorId: string, reason: string) {
  await context.db.set(`log:${Date.now()}`, { type, targetId, moderatorId, reason });
}

export default defineModule({
  name: "moderation",
  version: "1.0.0",
  type: "module",
  description: "Warn, kick, and ban members, with per-server action logging.",
  permissions: [
    { key: "moderation.warn", label: "Warn members", defaultRoles: "admin" },
    { key: "moderation.kick", label: "Kick members", defaultRoles: "admin" },
    { key: "moderation.ban", label: "Ban members", defaultRoles: "admin" },
  ],
  commands: [
    {
      name: "warn",
      description: "Warn a member",
      data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member")
        .addUserOption((o) => o.setName("user").setDescription("User to warn").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for the warning").setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .toJSON(),
      async execute(rawInteraction, context) {
        const interaction = rawInteraction as ChatInputCommandInteraction;
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";

        await logAction(context, "warn", target.id, interaction.user.id, reason);
        context.logger.info("Member warned", { targetId: target.id, moderatorId: interaction.user.id });
        await interaction.reply({ content: `⚠️ ${target.tag} has been warned. Reason: ${reason}` });
      },
    },
    {
      name: "kick",
      description: "Kick a member",
      data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member")
        .addUserOption((o) => o.setName("user").setDescription("User to kick").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for the kick").setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .toJSON(),
      async execute(rawInteraction, context) {
        const interaction = rawInteraction as ChatInputCommandInteraction;
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
          await interaction.reply({ content: "You don't have permission to kick members.", ephemeral: true });
          return;
        }

        try {
          await interaction.guild?.members.kick(target.id, reason);
          await logAction(context, "kick", target.id, interaction.user.id, reason);
          await interaction.reply({ content: `👢 ${target.tag} was kicked. Reason: ${reason}` });
        } catch (err) {
          context.logger.error("Kick failed", { error: (err as Error).message });
          await interaction.reply({ content: "Couldn't kick that member — check my role permissions.", ephemeral: true });
        }
      },
    },
    {
      name: "ban",
      description: "Ban a member",
      data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member")
        .addUserOption((o) => o.setName("user").setDescription("User to ban").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for the ban").setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .toJSON(),
      async execute(rawInteraction, context) {
        const interaction = rawInteraction as ChatInputCommandInteraction;
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
          await interaction.reply({ content: "You don't have permission to ban members.", ephemeral: true });
          return;
        }

        try {
          await interaction.guild?.members.ban(target.id, { reason });
          await logAction(context, "ban", target.id, interaction.user.id, reason);
          await interaction.reply({ content: `🔨 ${target.tag} was banned. Reason: ${reason}` });
        } catch (err) {
          context.logger.error("Ban failed", { error: (err as Error).message });
          await interaction.reply({ content: "Couldn't ban that member — check my role permissions.", ephemeral: true });
        }
      },
    },
  ],
  async init(context) {
    context.logger.info("moderation module initialized", { guildId: context.guildId });
  },
  async destroy(context) {
    context.logger.info("moderation module destroyed", { guildId: context.guildId });
  },
});
