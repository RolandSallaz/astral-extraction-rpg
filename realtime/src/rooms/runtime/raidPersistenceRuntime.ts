import type { RaidRuntimeState } from "@mmorpg/shared";
import { type MapSchema } from "@colyseus/schema";
import { ChestState } from "../schema/ChestState.js";
import { GroundEffectState } from "../schema/GroundEffectState.js";
import { MobState } from "../schema/MobState.js";

function createMobState(serialized: RaidRuntimeState["mobs"][number]) {
  const mob = new MobState();
  mob.id = serialized.id;
  mob.kind = serialized.kind as MobState["kind"];
  mob.name = serialized.name;
  mob.texture = serialized.texture;
  mob.aggroTargetId = serialized.aggroTargetId;
  mob.aggroLockedUntil = serialized.aggroLockedUntil;
  mob.spawnX = serialized.spawnX;
  mob.spawnY = serialized.spawnY;
  mob.x = serialized.x;
  mob.y = serialized.y;
  mob.targetX = serialized.targetX;
  mob.targetY = serialized.targetY;
  mob.patrolMinX = serialized.patrolMinX;
  mob.patrolMaxX = serialized.patrolMaxX;
  mob.patrolY = serialized.patrolY;
  mob.patrolRadiusY = serialized.patrolRadiusY;
  mob.patrolPhase = serialized.patrolPhase;
  mob.moveSpeed = serialized.moveSpeed;
  mob.aggroRange = serialized.aggroRange;
  mob.leashRange = serialized.leashRange;
  mob.attackRange = serialized.attackRange;
  mob.attackDamage = serialized.attackDamage;
  mob.attackCooldownMs = serialized.attackCooldownMs;
  mob.attackCooldownEndsAt = serialized.attackCooldownEndsAt;
  mob.castingSkillId = serialized.castingSkillId;
  mob.castStartedAt = serialized.castStartedAt;
  mob.castEndsAt = serialized.castEndsAt;
  mob.skillLungeStartedAt = serialized.skillLungeStartedAt;
  mob.skillLungeEndsAt = serialized.skillLungeEndsAt;
  mob.skillLungeFromX = serialized.skillLungeFromX;
  mob.skillLungeFromY = serialized.skillLungeFromY;
  mob.skillLungeToX = serialized.skillLungeToX;
  mob.skillLungeToY = serialized.skillLungeToY;
  mob.experienceReward = serialized.experienceReward;
  mob.health = serialized.health;
  mob.maxHealth = serialized.maxHealth;
  mob.burnTicksRemaining = serialized.burnTicksRemaining;
  mob.burnEndsAt = serialized.burnEndsAt;
  mob.poisonTicksRemaining = serialized.poisonTicksRemaining;
  mob.poisonEndsAt = serialized.poisonEndsAt;
  mob.dead = serialized.dead;
  mob.respawnAt = serialized.respawnAt;
  return mob;
}

function createChestState(serialized: RaidRuntimeState["chests"][number]) {
  const chest = new ChestState();
  chest.id = serialized.id;
  chest.title = serialized.title;
  chest.subtitle = serialized.subtitle;
  chest.columns = serialized.columns;
  chest.rows = serialized.rows;
  chest.x = serialized.x;
  chest.y = serialized.y;
  serialized.slots.forEach((slot) => chest.slots.push(slot));
  return chest;
}

function createGroundEffectState(serialized: RaidRuntimeState["groundEffects"][number]) {
  const effect = new GroundEffectState();
  effect.id = serialized.id;
  effect.ownerId = serialized.ownerId;
  effect.skillId = serialized.skillId;
  effect.tileX = serialized.tileX;
  effect.tileY = serialized.tileY;
  effect.x = serialized.x;
  effect.y = serialized.y;
  effect.expiresAt = serialized.expiresAt;
  effect.nextTickAt = serialized.nextTickAt;
  return effect;
}

export function serializeRaidRuntimeState(options: {
  status: string;
  expiresAt: number;
  mobs: Iterable<MobState>;
  chests: Iterable<ChestState>;
  groundEffects: Iterable<GroundEffectState>;
}) {
  return {
    status: options.status,
    expiresAt: options.expiresAt,
    updatedAt: new Date().toISOString(),
    mobs: Array.from(options.mobs, (mob) => ({
      id: mob.id,
      kind: mob.kind,
      name: mob.name,
      texture: mob.texture,
      aggroTargetId: mob.aggroTargetId,
      aggroLockedUntil: mob.aggroLockedUntil,
      spawnX: mob.spawnX,
      spawnY: mob.spawnY,
      x: mob.x,
      y: mob.y,
      targetX: mob.targetX,
      targetY: mob.targetY,
      patrolMinX: mob.patrolMinX,
      patrolMaxX: mob.patrolMaxX,
      patrolY: mob.patrolY,
      patrolRadiusY: mob.patrolRadiusY,
      patrolPhase: mob.patrolPhase,
      moveSpeed: mob.moveSpeed,
      aggroRange: mob.aggroRange,
      leashRange: mob.leashRange,
      attackRange: mob.attackRange,
      attackDamage: mob.attackDamage,
      attackCooldownMs: mob.attackCooldownMs,
      attackCooldownEndsAt: mob.attackCooldownEndsAt,
      castingSkillId: mob.castingSkillId,
      castStartedAt: mob.castStartedAt,
      castEndsAt: mob.castEndsAt,
      skillLungeStartedAt: mob.skillLungeStartedAt,
      skillLungeEndsAt: mob.skillLungeEndsAt,
      skillLungeFromX: mob.skillLungeFromX,
      skillLungeFromY: mob.skillLungeFromY,
      skillLungeToX: mob.skillLungeToX,
      skillLungeToY: mob.skillLungeToY,
      experienceReward: mob.experienceReward,
      health: mob.health,
      maxHealth: mob.maxHealth,
      burnTicksRemaining: mob.burnTicksRemaining,
      burnEndsAt: mob.burnEndsAt,
      poisonTicksRemaining: mob.poisonTicksRemaining,
      poisonEndsAt: mob.poisonEndsAt,
      dead: mob.dead,
      respawnAt: mob.respawnAt,
    })),
    chests: Array.from(options.chests, (chest) => ({
      id: chest.id,
      title: chest.title,
      subtitle: chest.subtitle,
      columns: chest.columns,
      rows: chest.rows,
      x: chest.x,
      y: chest.y,
      slots: Array.from(chest.slots),
    })),
    groundEffects: Array.from(options.groundEffects, (effect) => ({
      id: effect.id,
      ownerId: effect.ownerId,
      skillId: effect.skillId,
      tileX: effect.tileX,
      tileY: effect.tileY,
      x: effect.x,
      y: effect.y,
      expiresAt: effect.expiresAt,
      nextTickAt: effect.nextTickAt,
    })),
  } satisfies RaidRuntimeState;
}

export function restoreRaidRuntimeState(options: {
  runtimeState: RaidRuntimeState;
  mobs: MapSchema<MobState>;
  chests: MapSchema<ChestState>;
  groundEffects: MapSchema<GroundEffectState>;
  chestBlockedTiles: Uint8Array;
  width: number;
}) {
  options.mobs.clear();
  options.chests.clear();
  options.groundEffects.clear();
  options.chestBlockedTiles.fill(0);

  options.runtimeState.mobs.forEach((serializedMob) => {
    const mob = createMobState(serializedMob);
    options.mobs.set(mob.id, mob);
  });

  options.runtimeState.chests.forEach((serializedChest) => {
    const chest = createChestState(serializedChest);
    options.chests.set(chest.id, chest);
    options.chestBlockedTiles[chest.y * options.width + chest.x] = 1;
  });

  options.runtimeState.groundEffects.forEach((serializedEffect) => {
    const effect = createGroundEffectState(serializedEffect);
    options.groundEffects.set(effect.id, effect);
  });
}
