/**
 * Basic Ghost Labs - Project Eclipse
 * Copyright (c) 2026 Basic Ghost Labs. All rights reserved.
 */

import { defineModule } from "@platform/module-sdk";
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
} from "discord.js";

interface WelcomeConfig {
  channelId?: string;
  message?: string;
}

export default defineModule({
  name: "welcome",
  version: "1.0.0",
  type: "module",
  description: "Sends a configurable welcome message when a new member joins.",
  dashboard: {
    settings: [
      { type: "channel", key: "channelId", label: "Welcome Channel" },
      { type: "text", key: "message", label: "Welcome Message (use {user} for a mention)" },
    ],
  },
  commands: [
    {
      name: "welcome-config",
      description: "Set the welcome channel and message",
      data: new SlashCommandBuilder()
        .setName("welcome-config")
        .setDescription("Set the welcome channel and message")
        .addChannelOption((o) => o.setName("channel").setDescription("Channel to post welcomes in").setRequired(false))
        .addStringOption((o) =>
          o.setName("message").setDescription("Welcome message, use {user} for a mention").setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON(),
      async execute(rawInteraction, context) {
        const interaction = rawInteraction as ChatInputCommandInteraction;
        const channel = interaction.options.getChannel("channel");
        const message = interaction.options.getString("message");

        const update: WelcomeConfig = {};
        if (channel) update.channelId = channel.id;
        if (message) update.message = message;

        if (Object.keys(update).length > 0) {
          await context.config.set("welcomeConfig", update);
        }

        const current = (await context.config.get<WelcomeConfig>("welcomeConfig")) ?? {};
        await interaction.reply({
          content:
            `Welcome config:\n` +
            `Channel: ${current.channelId ? `<#${current.channelId}>` : "not set"}\n` +
            `Message: ${current.message ?? "not set"}`,
          ephemeral: true,
        });
      },
    },
  ],
  events: [
    {
      event: "guildMemberAdd",
      async handler(rawMember, context) {
        const member = rawMember as GuildMember;
        const config = (await context.config.get<WelcomeConfig>("welcomeConfig")) ?? {};
        if (!config.channelId || !config.message) return;

        const channel = member.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
        if (!channel?.isTextBased()) {
          context.logger.warn("Welcome channel missing or not text-based", { guildId: member.guild.id });
          return;
        }

        const text = config.message.replace("{user}", `<@${member.id}>`);
        await channel.send({ content: text });
      },
    },
  ],
  async init(context) {
    context.logger.info("welcome module initialized", { guildId: context.guildId });
  },
  async destroy(context) {
    context.logger.info("welcome module destroyed", { guildId: context.guildId });
  },
});
