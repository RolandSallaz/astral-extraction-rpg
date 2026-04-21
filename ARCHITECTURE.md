# Architecture Rules

This project keeps authored game content, persistent player state, and runtime simulation separate.

## Ownership Boundaries

`shared` contains contracts, DTO-like types, content schemas, validators, and pure gameplay formulas. It must not contain NestJS, Colyseus, browser UI code, or database access.

`game-data` contains authored content: item balance, mob balance, skills, world layouts, spawn placement, raid templates, encounters, and loot tables. Content changes should be made here, not in TypeScript room files or database rows.

`backend` owns persistence and application use cases: authentication, player profile state, inventory ownership, parties, raid run records, and admin/editor APIs. It must not own authoritative map layout, NPC spawn placement, static chest layout, or balance values as database tables.

`realtime` owns authoritative runtime simulation: room lifecycle, ticks, combat, movement, mobs, projectiles, effects, and room synchronization. It reads content snapshots and executes mechanics; it must not hardcode authored content.

`frontend` owns presentation and client input. It must not be authoritative for gameplay state, inventory ownership, combat results, drops, or progression.

## Database Rules

The database stores persistent facts that must survive restarts:

- player identity, auth/session state, profile/progression
- owned item ids/codes, quantities, equipment/inventory placement
- party membership and readiness
- raid run state, generated runtime snapshot references, completion state

The database must not store authored content:

- item/mob/skill balance
- map blocked tiles, spawn points, static chest placement
- static NPC placement
- raid template definitions, encounter presets, loot pools

If a chest or raid object needs persistence, store only runtime-independent state such as `instanceId`, `openedByPlayer`, `lootedAt`, or `raidRunId`. Do not store world layout in backend persistence.

## Content Loading

Backend and realtime should consume the same content format through shared loaders/validators. A file format should have one canonical type and one canonical validation path.

Realtime should load a versioned content snapshot. Long-term, polling should check only content version/cache key unless a full reload is required.

## Backend Shape

Controllers should call application use cases or queries, not repositories directly. Services may remain as domain/persistence helpers, but endpoint-level business scenarios should be named explicitly, for example `GrantItemUseCase`, `StartRaidUseCase`, or `CreatePartyUseCase`.

Entities describe persistence shape. They are not the center of the application design.

## Realtime Shape

Room classes should orchestrate lifecycle and tick ordering. Gameplay logic should live in systems such as combat, projectiles, ground effects, status effects, mobs, loot, and room sync.

`BaseGameRoom` should be a composition/orchestration layer, not the owner of every mechanic.

## Frontend Shape

`page.tsx` is the top-level game page. It should only wire together child components and manage cross-cutting state (room connection, profile, balance configs). It must not contain canvas draw logic, HUD panel implementations, or input handling.

`GameCanvas` is a canvas-rendering component. It should compose rendering hooks and forward events — not own draw routines, input parsing, or network sync inline. When a canvas concern grows, extract it into `game-canvas/` as a hook (`use*.ts`) for stateful/lifecycle logic or a helper (`*Helpers.ts`, `*Renderer.ts`) for pure functions.

`GameHud` is the React overlay layer. Each HUD panel (inventory, equipment, skill bar, quest log, party frame, inspect/socket window, trader dialog) should be its own component under `game-hud/`. `GameHud` itself should only lay out panels and route shared callbacks — not implement drag-and-drop, tooltip rendering, or slot interaction inline.

`lib/` contains non-React code: data definitions, balance lookups, storage helpers, map generation, animation configs. Code in `lib/` must not import React or component modules.

Target component size: a single `.tsx` file should not exceed 600 lines. When a file grows past this, extract a child component or hook before adding more code. This is a guideline for new code, not a demand to refactor everything at once.

Extraction axes:

- `game-canvas/use*.ts` — hooks that own refs, effects, or per-frame state (e.g. `usePlayerRenderer`, `useMobRenderer`).
- `game-canvas/*Helpers.ts` — pure functions called from hooks or the draw loop (e.g. `castHelpers`, `statusEffectHelpers`).
- `game-hud/*Panel.tsx` — self-contained HUD panels with their own local state.
- `game-hud/use*.ts` — shared interaction hooks (e.g. `useDragAndDrop`).

Use one responsibility axis for realtime gameplay code:

- `runtime/` contains room-facing gameplay entrypoints and adapters. These functions receive explicit contracts/contexts through DI and may compose multiple lower-level helpers, but they must not require passing the whole room instance.
- `systems/` contains stateful engines that own tick-based progression over time, for example cast queues, status ticking, lag history, or queued projectile bursts.
- `services/` contains stateless or infrastructure-oriented helpers that do not own room lifecycle, for example combat formulas, spatial data structures, or content polling.
- `skills/` contains skill-specific handlers that translate a cast intent into runtime actions through narrow interfaces such as `SkillCastContext`.

When a mechanic grows, prefer extracting a runtime contract and moving the logic under `runtime/` before introducing another parallel folder model.
