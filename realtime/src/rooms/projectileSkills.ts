import { getArmorGemConfig, type ArmorGemCarrier } from "./armorGems.js";
import {
  FIREBALL_SPLIT_SKILL_ID,
  getFireballCastTimeMs,
  type ProjectileGemConfig,
  type WeaponGemCarrier,
} from "./fireballGems.js";
import { getFireDamageTakenMultiplier } from "@mmorpg/shared";

export type DamageType = "physical" | "fire" | "ice" | "lightning";

export type CombatGemPlayer = WeaponGemCarrier & ArmorGemCarrier & {
  bodyItem?: string;
};

export type BurstSpawnRequest = {
  ownerId: string;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  spawnAt: number;
};

export type ProjectileSpawnRequest = {
  ownerId: string;
  skillId: string;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  lifetime: number;
  damageScale?: number;
  sizeScale?: number;
};

export type PendingAftershock = {
  ownerId: string;
  x: number;
  y: number;
  damageScale: number;
  triggerAt: number;
};

import type { ProjectileServerData } from "./schema/ProjectileState.js";

/**
 * Union of schema (visual) fields and server-only combat fields.
 * Used by functions that need to read/write the full projectile state
 * (e.g. applyGemConfigToProjectile, updateProjectilesShared).
 */
export type MutableProjectile = {
  ownerId: string;
  skillId: string;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  lifetime: number;
  originX: number;
  originY: number;
  returning: boolean;
  bouncesRemaining: number;
  sizeScale: number;
  speed: number;
  spiralAmplitude: number;
  spiralFrequency: number;
  spiralPhase: number;
} & ProjectileServerData;

export function getSharedFireballCastTimeMs(
  player: CombatGemPlayer | undefined,
  fireTrailCastPenaltyMs: number,
) {
  const weaponCastTimeMs = getFireballCastTimeMs(player, fireTrailCastPenaltyMs);
  return Math.round(weaponCastTimeMs * getArmorGemConfig(player).castTimeMultiplier);
}

export function getSharedDamageTakenMultiplier(
  player: CombatGemPlayer | undefined,
  damageType: DamageType,
  itemFireResistance: Map<string, number>,
) {
  const armorGemConfig = getArmorGemConfig(player);
  if (damageType === "fire") {
    return getFireDamageTakenMultiplier(player?.bodyItem, itemFireResistance) * armorGemConfig.damageTakenMultiplier;
  }

  return armorGemConfig.damageTakenMultiplier;
}

export function applyHealingMultiplier(amount: number, player: CombatGemPlayer | undefined) {
  return Math.max(0, Math.round(amount * getArmorGemConfig(player).healingReceivedMultiplier));
}

export function shouldProjectileDealDirectDamage(skillId: string) {
  return skillId === "fireball" || skillId === FIREBALL_SPLIT_SKILL_ID || skillId === "fireNova";
}

export function buildFireballCastPlan(options: {
  ownerId: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  now: number;
  fireballLifetime: number;
  splitAngleOffsetRad: number;
  splitProjectile: boolean;
  gemConfig: ProjectileGemConfig;
}): { immediateSpawns: ProjectileSpawnRequest[]; delayedSpawns: BurstSpawnRequest[]; postCastLockMs: number } {
  const emptyPlan: { immediateSpawns: ProjectileSpawnRequest[]; delayedSpawns: BurstSpawnRequest[]; postCastLockMs: number } = {
    immediateSpawns: [],
    delayedSpawns: [],
    postCastLockMs: 0,
  };
  const deltaX = options.targetX - options.startX;
  const deltaY = options.targetY - options.startY;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 0.001) {
    return emptyPlan;
  }

  const baseDirectionX = deltaX / distance;
  const baseDirectionY = deltaY / distance;
  const baseAngle = Math.atan2(baseDirectionY, baseDirectionX);
  const spreadSpawnDirections =
    options.gemConfig.spreadCount > 0
      ? (() => {
          const halfSpread = ((options.gemConfig.spreadCount - 1) * options.gemConfig.spreadAngleDeg * Math.PI) / 180 / 2;
          const step = options.gemConfig.spreadCount > 1 ? (2 * halfSpread) / (options.gemConfig.spreadCount - 1) : 0;
          return Array.from({ length: options.gemConfig.spreadCount }, (_, index) => {
            const angle = baseAngle - halfSpread + step * index;
            return {
              directionX: Math.cos(angle),
              directionY: Math.sin(angle),
            };
          });
        })()
      : [{
          directionX: baseDirectionX,
          directionY: baseDirectionY,
        }];
  const splitSpawnDirections = options.splitProjectile
    ? options.gemConfig.spreadCount > 0
      ? (() => {
          const combinedCount = options.gemConfig.spreadCount * 2;
          const spreadHalfAngle = ((options.gemConfig.spreadCount - 1) * options.gemConfig.spreadAngleDeg * Math.PI) / 180 / 2;
          const combinedHalfSpread = spreadHalfAngle + options.splitAngleOffsetRad;
          const step = combinedCount > 1 ? (2 * combinedHalfSpread) / (combinedCount - 1) : 0;
          return Array.from({ length: combinedCount }, (_, index) => {
            const angle = baseAngle - combinedHalfSpread + step * index;
            return {
              directionX: Math.cos(angle),
              directionY: Math.sin(angle),
              skillId: FIREBALL_SPLIT_SKILL_ID,
              damageScale: 0.5,
              sizeScale: 0.8,
            };
          });
        })()
      : spreadSpawnDirections.flatMap(({ directionX, directionY }) => {
          const angle = Math.atan2(directionY, directionX);
          return [-options.splitAngleOffsetRad, options.splitAngleOffsetRad].map((angleOffset) => ({
            directionX: Math.cos(angle + angleOffset),
            directionY: Math.sin(angle + angleOffset),
            skillId: FIREBALL_SPLIT_SKILL_ID,
            damageScale: 0.5,
            sizeScale: 0.8,
          }));
        })
    : spreadSpawnDirections.map(({ directionX, directionY }) => ({
        directionX,
        directionY,
        skillId: "fireball",
        damageScale: 1,
        sizeScale: 1,
      }));

  if (options.gemConfig.burstCount > 0) {
    return {
      immediateSpawns: [] as ProjectileSpawnRequest[],
      delayedSpawns: Array.from({ length: options.gemConfig.burstCount }, (_, burstIndex) =>
        splitSpawnDirections.map(({ directionX, directionY }) => ({
          ownerId: options.ownerId,
          x: options.startX,
          y: options.startY,
          directionX,
          directionY,
          spawnAt: options.now + burstIndex * options.gemConfig.burstDelayMs,
        })),
      ).flat(),
      postCastLockMs: Math.max(0, (options.gemConfig.burstCount - 1) * options.gemConfig.burstDelayMs),
    };
  }

  return {
    immediateSpawns: splitSpawnDirections.map(({ directionX, directionY, skillId, damageScale, sizeScale }) => ({
      ownerId: options.ownerId,
      skillId,
      x: options.startX,
      y: options.startY,
      directionX,
      directionY,
      lifetime: options.fireballLifetime,
      damageScale,
      sizeScale,
    })),
    delayedSpawns: [] as BurstSpawnRequest[],
    postCastLockMs: 0,
  };
}

export function applyGemConfigToProjectile(
  schema: { lifetime: number; returning: boolean; bouncesRemaining: number; sizeScale: number; speed: number; spiralAmplitude: number; spiralFrequency: number },
  serverData: ProjectileServerData,
  gemConfig: ProjectileGemConfig,
  options: {
    bounceCount: number;
    rangeMultiplier: number;
    fireballSpeed: number;
    selfHitGraceMs: number;
    now: number;
    lifetime: number;
    damageScale?: number;
    sizeScale?: number;
  },
) {
  const resolvedLifetime = options.lifetime * options.rangeMultiplier;

  // Schema (client-synced) fields
  schema.lifetime = resolvedLifetime;
  schema.returning = false;
  schema.bouncesRemaining = options.bounceCount;
  schema.sizeScale = options.sizeScale ?? 1;
  schema.speed = options.fireballSpeed * gemConfig.projectileSpeedMultiplier;
  schema.spiralAmplitude = gemConfig.spiralAmplitude;
  schema.spiralFrequency = gemConfig.spiralFrequency;

  // Server-only combat fields
  serverData.piercesRemaining = gemConfig.pierceCount;
  serverData.chainRemaining = gemConfig.chainCount;
  serverData.damageScale = (options.damageScale ?? 1) * gemConfig.directDamageMultiplier;
  serverData.maxDistance = options.fireballSpeed * gemConfig.projectileSpeedMultiplier * resolvedLifetime;
  serverData.homingStrength = gemConfig.homingStrength;
  serverData.splashRadius = gemConfig.splashRadius;
  serverData.splashDamageScale = gemConfig.splashDamageScale;
  serverData.knockbackDistance = gemConfig.knockbackDistance;
  serverData.lifestealRatio = gemConfig.lifestealRatio;
  serverData.executionThreshold = gemConfig.executionThreshold;
  serverData.executionDamageMultiplier = gemConfig.executionDamageMultiplier;
  serverData.criticalChance = gemConfig.criticalChance;
  serverData.criticalDamageMultiplier = gemConfig.criticalDamageMultiplier;
  serverData.fork = gemConfig.fork;
  serverData.forkDamageScale = gemConfig.forkDamageScale;
  serverData.orbitTimeRemaining = gemConfig.orbitDurationMs;
  serverData.orbitRadius = gemConfig.orbitRadius;
  serverData.aftershockDelayMs = gemConfig.aftershockDelayMs;
  serverData.aftershockDamageScale = gemConfig.aftershockDamageScale;
  serverData.novaImpactCount = gemConfig.novaImpactCount;
  serverData.novaImpactDamageScale = gemConfig.novaImpactDamageScale;
  serverData.cloneOnHit = gemConfig.cloneOnHit;
  serverData.cloneDamageScale = gemConfig.cloneDamageScale;
  serverData.selfHitGraceEndsAt = options.now + options.selfHitGraceMs;
}

export function advanceProjectilePosition(
  projectile: MutableProjectile,
  deltaSeconds: number,
  defaultSpeed: number,
  ownerPosition?: { x: number; y: number } | null,
) {
  if (projectile.orbitTimeRemaining > 0) {
    if (ownerPosition) {
      const elapsed = projectile.orbitTimeRemaining > deltaSeconds * 1000
        ? deltaSeconds * 1000
        : projectile.orbitTimeRemaining;
      projectile.orbitTimeRemaining -= elapsed;
      const angle = (Date.now() / 1000) * Math.PI * 4;
      projectile.x = ownerPosition.x + Math.cos(angle) * projectile.orbitRadius;
      projectile.y = ownerPosition.y + Math.sin(angle) * projectile.orbitRadius;
      projectile.originX = ownerPosition.x;
      projectile.originY = ownerPosition.y;
      return { continuedOrbit: true };
    }

    projectile.orbitTimeRemaining = 0;
  }

  const previousX = projectile.x;
  const previousY = projectile.y;
  const speed = projectile.speed > 0 ? projectile.speed : defaultSpeed;

  if (projectile.spiralAmplitude > 0 && projectile.spiralFrequency > 0) {
    const previousPhase = projectile.spiralPhase;
    const previousOffset = Math.sin(previousPhase) * projectile.spiralAmplitude;
    projectile.spiralPhase += speed * deltaSeconds * projectile.spiralFrequency * 0.01;
    const nextOffset = Math.sin(projectile.spiralPhase) * projectile.spiralAmplitude;
    const offsetDelta = nextOffset - previousOffset;
    projectile.distanceTraveled += speed * deltaSeconds;
    const perpX = -projectile.directionY;
    const perpY = projectile.directionX;
    projectile.x += projectile.directionX * speed * deltaSeconds + perpX * offsetDelta;
    projectile.y += projectile.directionY * speed * deltaSeconds + perpY * offsetDelta;
  } else {
    projectile.x += projectile.directionX * speed * deltaSeconds;
    projectile.y += projectile.directionY * speed * deltaSeconds;
  }

  projectile.lifetime -= deltaSeconds;
  return { continuedOrbit: false, previousX, previousY };
}

export function buildOnHitProjectileEffects(
  projectile: { ownerId: string; skillId: string; x: number; y: number; directionX: number; directionY: number },
  serverData: ProjectileServerData,
  options: {
    fireballLifetime: number;
    fireballShardLifetime: number;
    shardSkillId: string;
  },
) {
  const spawns: ProjectileSpawnRequest[] = [];
  let aftershock: PendingAftershock | null = null;

  if (serverData.fork) {
    const baseAngle = Math.atan2(projectile.directionY, projectile.directionX);
    for (const offset of [-Math.PI / 6, Math.PI / 6]) {
      const angle = baseAngle + offset;
      spawns.push({
        ownerId: projectile.ownerId,
        skillId: projectile.skillId,
        x: projectile.x,
        y: projectile.y,
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        lifetime: options.fireballLifetime * 0.5,
        damageScale: serverData.forkDamageScale,
        sizeScale: 0.7,
      });
    }
  }

  if (serverData.novaImpactCount > 0) {
    for (let i = 0; i < serverData.novaImpactCount; i++) {
      const angle = (Math.PI * 2 * i) / serverData.novaImpactCount;
      spawns.push({
        ownerId: projectile.ownerId,
        skillId: options.shardSkillId,
        x: projectile.x + Math.cos(angle) * 6,
        y: projectile.y + Math.sin(angle) * 6,
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        lifetime: options.fireballShardLifetime,
        damageScale: serverData.novaImpactDamageScale,
        sizeScale: 0.5,
      });
    }
  }

  if (serverData.cloneOnHit) {
    spawns.push({
      ownerId: projectile.ownerId,
      skillId: projectile.skillId,
      x: projectile.x,
      y: projectile.y,
      directionX: projectile.directionX,
      directionY: projectile.directionY,
      lifetime: options.fireballLifetime * 0.5,
      damageScale: serverData.cloneDamageScale,
      sizeScale: 0.8,
    });
  }

  if (serverData.aftershockDelayMs > 0) {
    aftershock = {
      ownerId: projectile.ownerId,
      x: projectile.x,
      y: projectile.y,
      damageScale: serverData.aftershockDamageScale,
      triggerAt: Date.now() + serverData.aftershockDelayMs,
    };
  }

  return { spawns, aftershock };
}
