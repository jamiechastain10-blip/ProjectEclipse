# Project Eclipse — Development Progress

**Basic Ghost Labs**
*Status: Phase 1 (Foundation) complete. Beta build in progress.*

---

## What this is

Project Eclipse is a modular Discord bot platform — instead of one giant bot
file with every feature crammed in, functionality is split into independent
**modules** (Moderation, Welcome Messages, Tickets, etc.) that can be
enabled or disabled per server without needing a full rewrite every time we
add something new.

This document shows what's actually built so far, with real code — not a
mockup.

---

## 1. The Module Contract (`module-sdk`)

Every module in Eclipse is built against the same typed contract, so any
module — ours or a future third-party one — plugs into the bot the same way.

```ts
/**
 * Basic Ghost Labs - Project Eclipse
 * Copyright (c) 2026 Basic Ghost Labs. All rights reserved.
 */

export interface ModuleManifest extends BaseManifest {
  type: "module";
  dependencies?: ModuleDependency[];
}

export interface ModuleContext {
  guildId?: string;
  logger: { info(msg: string, meta?: Record<string, unknown>): void; /* ... */ };
  config: { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; };
  db: { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; delete(key: string): Promise<void>; };
  discord: { request<T>(op: DiscordApiRequest): Promise<T>; };
  permissions: { check(userId: string, permissionKey: string): Promise<boolean>; };
}
```

**Why it matters:** a module never touches the raw Discord client, the raw
database, or another module's data. Everything goes through `context`. That
means one broken module can't corrupt another module's data or crash the
whole bot by accident — it's structurally prevented, not just a coding
convention we're hoping people follow.

131 lines total, covering manifests, dashboard field definitions, command/event
registration types, and permission declarations.

---

## 2. The Module Lifecycle (`ModuleManager.ts`)

This is the core piece being validated in the beta: modules move through a
defined lifecycle instead of just being `require()`'d and hoped for.

```ts
/**
 * Central lifecycle authority. The Core never contains feature logic
 * ("if tickets enabled...") — it only knows how to move a module through
 * INSTALL -> VALIDATE -> ENABLE -> LOAD -> RUN -> UPDATE -> RELOAD ->
 * DISABLE -> UNLOAD -> UNINSTALL, and how to isolate failures.
 */
export class ModuleManager {
  async enable(name: string, guildId: string): Promise<void> {
    const entry = this.requireModule(name);
    try {
      const context = this.makeContext(guildId);
      await entry.manifest.init(context);
      entry.guildScopes.add(guildId);
      entry.state = "running";
    } catch (err) {
      entry.state = "errored";
      this.logger.error(`Module "${name}" failed to init for guild ${guildId}`, {
        error: (err as Error).message,
      });
      // A module failing to start must not crash the platform.
      throw err;
    }
  }
}
```

**Why it matters:** if a module throws during startup or an update, that
failure is caught, logged, and contained to that one module/server — the
rest of the bot keeps running. This is the specific claim the beta needs to
stress-test: does isolation actually hold up when something really breaks?

187 lines, covering install/validate, per-guild enable/disable, versioned
updates with automatic rollback on failure, and add-on dependency
verification (semver-checked).

---

## 3. Discord API Traffic Control (`DiscordApiManager.ts`)

A shared queue in front of Discord's API so one busy module can't starve
requests from every other module.

```ts
/**
 * discord.js's REST manager already implements Discord's documented
 * per-route bucket limits and the global limit. We do NOT reimplement
 * that math here. What this class owns: fairness between modules and
 * a per-module concurrency cap, so one module flooding requests can't
 * starve the others.
 */
export class DiscordApiManager {
  private readonly perModuleConcurrency = 3;
  // ...
}
```

85 lines. Priority queue (`high` / `normal` / `low`) plus a hard concurrency
cap per module.

---

## 4. Database Schema

PostgreSQL via Prisma, 106 lines, modeling: `Guild`, `User`, `Module`,
`ModuleDependency`, `GuildModuleConfig` (independent per-server settings —
Server A can have Moderation on and Tickets off while Server B has the
opposite, with zero shared state), `ModuleData` (namespaced storage so
modules can't see each other's rows), `GuildPermission`, `AuditLog`.

---

## 5. Proof-of-lifecycle test module

A minimal module exists solely to prove the system works end to end:

```ts
export default defineModule({
  name: "test-module",
  version: "1.0.0",
  type: "module",
  commands: [{ name: "ping", description: "Replies with pong.", async execute(interaction, context) { /* ... */ } }],
  async init(context) { context.logger.info("test-module initialized", { guildId: context.guildId }); },
  async destroy(context) { context.logger.info("test-module destroyed", { guildId: context.guildId }); },
});
```

This has been run through: install → enable → use → disable → unload →
re-enable → uninstall, in an automated acceptance test.

---

## Status honestly

| Piece | Status |
|---|---|
| Module contract & SDK | ✅ Built |
| Module lifecycle (install/enable/update/disable) | ✅ Built |
| Discord API fairness queue | ✅ Built |
| Database schema | ✅ Built |
| Test module + lifecycle proof | ✅ Built |
| Real feature modules (Moderation, Welcome) | 🔨 In progress for beta |
| Web dashboard | ⏳ Not started — post-beta |
| Marketplace / third-party modules | ⏳ Not started — long-term roadmap |

Total: ~550 lines across the pieces above. This is the foundation the beta's
actual features get built on top of — the beta is testing whether this
lifecycle and isolation model holds up under real, live use before we build
more on it.

---
*Basic Ghost Labs — Project Eclipse — internal progress snapshot, not for redistribution.*
