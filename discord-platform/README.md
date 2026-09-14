# Project Eclipse — Discord Bot Platform
**Basic Ghost Labs**

Beta build: a real, single-process Discord bot with the module lifecycle
system live and testable, backed by Postgres. No dashboard, no OAuth, no
Redis — those come after the beta proves the module system out.

See `docs/ARCHITECTURE.md` for the full design writeup and
`docs/PROGRESS.md` for a plain-language progress summary with code.

## What's live in this build

- **Moderation module**: `/warn`, `/kick`, `/ban` — logged per-guild.
- **Welcome module**: `/welcome-config` to set a channel + message,
  posts on new member join.
- **`/module list | enable | disable`** — admin-only, lets you turn a
  module on/off for a server **live, without restarting the bot.** This is
  the actual thing the beta is testing: does enabling/disabling a module
  cleanly init/destroy it without breaking anything else running.
- **test-module** (`/ping`) — kept in so the lifecycle has a zero-risk
  module to exercise first.

## Setup

1. Create a Discord application at discord.com/developers/applications,
   add a Bot user, copy the **bot token** and the **application (client) ID**.
   Under OAuth2 > URL Generator, check `bot` and `applications.commands`
   scopes, and at least `Send Messages`, `Kick Members`, `Ban Members`,
   `Manage Guild` permissions — use the generated URL to invite it to your
   test server.

2. Install dependencies and start Postgres:
   ```bash
   npm install
   docker compose up -d
   cp packages/database/.env.example packages/database/.env
   npm run db:generate
   npm run db:migrate
   ```

3. Run the bot:
   ```bash
   DISCORD_TOKEN=your-bot-token npm run dev:core
   ```
   Commands are registered per-guild on startup (near-instant), so they
   should show up in your test server within seconds.

4. In Discord, as a server admin:
   ```
   /module list
   /module enable name:moderation
   /module enable name:welcome
   /welcome-config channel:#general message:Welcome {user}!
   ```

## Deploying without installing anything locally

Push this repo to GitHub, connect it to Railway, add a Postgres plugin,
set `DATABASE_URL` and `DISCORD_TOKEN` as environment variables, and set
the start command to `npm run build --workspace=@platform/core && node packages/core/dist/bot.js`.
Railway runs it continuously — nothing runs on your machine.

## Known limitations in this build (by design, for beta speed)

- Module updates roll out immediately to every guild using that module,
  with automatic per-guild rollback if `init`/`update` throws — no staged
  rollout or admin approval step yet.
- Permissions are checked via native Discord role permissions on each
  command, not the custom per-permission-key system in the SDK — that
  wires up once the dashboard exists.
- Modules are a fixed list in `packages/core/src/modules.ts`, not
  dynamically installed — add a module by adding it here and redeploying.
- The Discord API fairness queue (`DiscordApiManager`) exists but isn't
  wired into module calls yet; modules call discord.js directly, which is
  still correctly rate-limited, just without our added fairness layer.

## Status

- [x] Module SDK, lifecycle, fairness queue, DB schema
- [x] Real Postgres-backed `ModuleContext`
- [x] Live `/module enable|disable` exercising the lifecycle in production
- [x] Moderation + Welcome modules
- [ ] Dashboard, OAuth (post-beta)
- [ ] Update backups + binary rollback (post-beta)
- [ ] Marketplace + untrusted-module security model (long-term)
