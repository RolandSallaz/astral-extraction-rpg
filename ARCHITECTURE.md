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
