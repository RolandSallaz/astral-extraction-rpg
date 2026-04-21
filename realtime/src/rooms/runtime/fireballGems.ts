import { FIREBALL_BASE_CAST_TIME_MS } from "@mmorpg/shared/skills/fireball";
import { GEMS_ENABLED } from "@mmorpg/shared/items/catalog";
import {
  AREA_GEM_ID,
  CAST_SPEED_GEM_ID,
  CHAIN_GEM_ID,
  CRITICAL_GEM_ID,
  DURATION_GEM_ID,
  EXECUTION_GEM_ID,
  FIRE_AFTERSHOCK_GEM_ID,
  FIRE_BOUNCE_GEM_ID,
  FIRE_BURST_GEM_ID,
  FIRE_CLONE_GEM_ID,
  FIRE_FORK_GEM_ID,
  FIRE_LONGSHOT_GEM_ID,
  FIRE_NOVA_IMPACT_GEM_ID,
  FIRE_ORBIT_GEM_ID,
  FIRE_RANGE_GEM_ID,
  FIRE_RETURN_GEM_ID,
  FIRE_SHATTER_GEM_ID,
  FIRE_SPIRAL_GEM_ID,
  FIRE_SPREAD_GEM_ID,
  FIRE_SPLIT_GEM_ID,
  FIRE_TRAIL_GEM_ID,
  FIREBALL_SHARD_SKILL_ID,
  FIREBALL_SPLIT_SKILL_ID,
  GEM_EFFECT_DESCRIPTORS,
  HOMING_GEM_ID,
  KNOCKBACK_GEM_ID,
  LIFESTEAL_GEM_ID,
  PIERCE_GEM_ID,
  PROJECTILE_SKILL_IDS,
} from "@mmorpg/shared/skills/gemEffects";

export type WeaponGemCarrier = {
  weaponGemItem1?: string;
  weaponGemItem2?: string;
  weaponGemItem3?: string;
};

export {
  AREA_GEM_ID,
  CAST_SPEED_GEM_ID,
  CHAIN_GEM_ID,
  CRITICAL_GEM_ID,
  DURATION_GEM_ID,
  EXECUTION_GEM_ID,
  FIRE_AFTERSHOCK_GEM_ID,
  FIRE_BOUNCE_GEM_ID,
  FIRE_BURST_GEM_ID,
  FIRE_CLONE_GEM_ID,
  FIRE_FORK_GEM_ID,
  FIRE_LONGSHOT_GEM_ID,
  FIRE_NOVA_IMPACT_GEM_ID,
  FIRE_ORBIT_GEM_ID,
  FIRE_RANGE_GEM_ID,
  FIRE_RETURN_GEM_ID,
  FIRE_SHATTER_GEM_ID,
  FIRE_SPIRAL_GEM_ID,
  FIRE_SPREAD_GEM_ID,
  FIRE_SPLIT_GEM_ID,
  FIRE_TRAIL_GEM_ID,
  FIREBALL_SHARD_SKILL_ID,
  FIREBALL_SPLIT_SKILL_ID,
  HOMING_GEM_ID,
  KNOCKBACK_GEM_ID,
  LIFESTEAL_GEM_ID,
  PIERCE_GEM_ID,
};

export type ProjectileGemConfig = {
  castTimeMultiplier: number;
  castTimeFlatMs: number;
  castRangeMultiplier: number;
  cooldownMultiplier: number;
  projectileRangeMultiplier: number;
  directDamageMultiplier: number;
  projectileSpeedMultiplier: number;
  splitProjectile: boolean;
  shatter: boolean;
  trail: boolean;
  returnOnMiss: boolean;
  bounceCount: number;
  pierceCount: number;
  chainCount: number;
  homingStrength: number;
  splashRadius: number;
  splashDamageScale: number;
  durationMultiplier: number;
  knockbackDistance: number;
  lifestealRatio: number;
  executionThreshold: number;
  executionDamageMultiplier: number;
  criticalChance: number;
  criticalDamageMultiplier: number;
  spreadCount: number;
  spreadAngleDeg: number;
  burstCount: number;
  burstDelayMs: number;
  novaImpactCount: number;
  novaImpactDamageScale: number;
  spiralAmplitude: number;
  spiralFrequency: number;
  fork: boolean;
  forkDamageScale: number;
  orbitDurationMs: number;
  orbitRadius: number;
  aftershockDelayMs: number;
  aftershockDamageScale: number;
  cloneOnHit: boolean;
  cloneDamageScale: number;
};

export function hasWeaponGem(player: WeaponGemCarrier | undefined, gemItemId: string) {
  if (!GEMS_ENABLED) {
    return false;
  }

  return countWeaponGems(player, gemItemId) > 0;
}

export function countWeaponGems(player: WeaponGemCarrier | undefined, gemItemId: string) {
  if (!GEMS_ENABLED) {
    return 0;
  }

  let count = 0;
  if (player?.weaponGemItem1 === gemItemId) {
    count += 1;
  }

  if (player?.weaponGemItem2 === gemItemId) {
    count += 1;
  }

  if (player?.weaponGemItem3 === gemItemId) {
    count += 1;
  }

  return count;
}

export function hasAnyWeaponGem(player: WeaponGemCarrier | undefined, gemItemId: string) {
  if (!GEMS_ENABLED) {
    return false;
  }

  return (
    player?.weaponGemItem1 === gemItemId ||
    player?.weaponGemItem2 === gemItemId ||
    player?.weaponGemItem3 === gemItemId
  );
}

function isProjectileSkill(skillId: string) {
  return PROJECTILE_SKILL_IDS.includes(skillId as typeof PROJECTILE_SKILL_IDS[number]);
}

export function getProjectileGemConfig(
  skillId: string,
  player: WeaponGemCarrier | undefined,
  options?: {
    fireTrailCastPenaltyMs?: number;
    longshotRangeMultiplier?: number;
    bounceCount?: number;
  },
): ProjectileGemConfig {
  const config: ProjectileGemConfig = {
    castTimeMultiplier: 1,
    castTimeFlatMs: 0,
    castRangeMultiplier: 1,
    cooldownMultiplier: 1,
    projectileRangeMultiplier: 1,
    directDamageMultiplier: 1,
    projectileSpeedMultiplier: 1,
    splitProjectile: false,
    shatter: false,
    trail: false,
    returnOnMiss: false,
    bounceCount: 0,
    pierceCount: 0,
    chainCount: 0,
    homingStrength: 0,
    splashRadius: 0,
    splashDamageScale: 0,
    durationMultiplier: 1,
    knockbackDistance: 0,
    lifestealRatio: 0,
    executionThreshold: 0,
    executionDamageMultiplier: 1,
    criticalChance: 0,
    criticalDamageMultiplier: 1,
    spreadCount: 0,
    spreadAngleDeg: 0,
    burstCount: 0,
    burstDelayMs: 0,
    novaImpactCount: 0,
    novaImpactDamageScale: 0,
    spiralAmplitude: 0,
    spiralFrequency: 0,
    fork: false,
    forkDamageScale: 1,
    orbitDurationMs: 0,
    orbitRadius: 0,
    aftershockDelayMs: 0,
    aftershockDamageScale: 0,
    cloneOnHit: false,
    cloneDamageScale: 0,
  };

  const fireTrailRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_TRAIL_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_TRAIL_GEM_ID)) {
    config.trail = isProjectileSkill(skillId) && Boolean(fireTrailRuntime?.trail);
    config.castTimeFlatMs += options?.fireTrailCastPenaltyMs ?? fireTrailRuntime?.castTimeFlatMs ?? 0;
  }

  const shatterRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_SHATTER_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_SHATTER_GEM_ID)) {
    config.shatter = Boolean(shatterRuntime?.shatter) && (skillId === "fireball" || skillId === FIREBALL_SPLIT_SKILL_ID);
  }

  const returnRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_RETURN_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_RETURN_GEM_ID)) {
    config.returnOnMiss = isProjectileSkill(skillId) && Boolean(returnRuntime?.returnOnMiss);
  }

  const bounceRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_BOUNCE_GEM_ID].runtime;
  const bounceGemCount = countWeaponGems(player, FIRE_BOUNCE_GEM_ID);
  if (bounceGemCount > 0) {
    config.bounceCount = isProjectileSkill(skillId)
      ? (options?.bounceCount ?? 0) * (bounceRuntime?.bounceCountMultiplier ?? 1) * bounceGemCount
      : 0;
  }

  const longshotRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_LONGSHOT_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_LONGSHOT_GEM_ID)) {
    config.projectileRangeMultiplier = isProjectileSkill(skillId)
      ? options?.longshotRangeMultiplier ?? longshotRuntime?.projectileRangeMultiplier ?? 1
      : 1;
  }

  const splitRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_SPLIT_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_SPLIT_GEM_ID) && skillId === "fireball") {
    config.splitProjectile = Boolean(splitRuntime?.splitProjectile);
  }

  const rangeRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_RANGE_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_RANGE_GEM_ID)) {
    config.castRangeMultiplier *= rangeRuntime?.castRangeMultiplier ?? 1;
    config.cooldownMultiplier *= rangeRuntime?.cooldownMultiplier ?? 1;
  }

  const castSpeedRuntime = GEM_EFFECT_DESCRIPTORS[CAST_SPEED_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, CAST_SPEED_GEM_ID)) {
    config.castTimeMultiplier *= castSpeedRuntime?.castTimeMultiplier ?? 1;
    config.directDamageMultiplier *= castSpeedRuntime?.directDamageMultiplier ?? 1;
  }

  const pierceRuntime = GEM_EFFECT_DESCRIPTORS[PIERCE_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, PIERCE_GEM_ID) && isProjectileSkill(skillId)) {
    config.pierceCount += pierceRuntime?.pierceCount ?? 0;
    config.directDamageMultiplier *= pierceRuntime?.directDamageMultiplier ?? 1;
  }

  const chainRuntime = GEM_EFFECT_DESCRIPTORS[CHAIN_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, CHAIN_GEM_ID) && isProjectileSkill(skillId)) {
    config.chainCount += chainRuntime?.chainCount ?? 0;
    config.directDamageMultiplier *= chainRuntime?.directDamageMultiplier ?? 1;
  }

  const homingRuntime = GEM_EFFECT_DESCRIPTORS[HOMING_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, HOMING_GEM_ID) && isProjectileSkill(skillId)) {
    config.homingStrength += homingRuntime?.homingStrength ?? 0;
    config.projectileSpeedMultiplier *= homingRuntime?.projectileSpeedMultiplier ?? 1;
  }

  const areaRuntime = GEM_EFFECT_DESCRIPTORS[AREA_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, AREA_GEM_ID) && isProjectileSkill(skillId)) {
    config.splashRadius = Math.max(config.splashRadius, areaRuntime?.splashRadius ?? 0);
    config.splashDamageScale = Math.max(config.splashDamageScale, areaRuntime?.splashDamageScale ?? 0);
    config.directDamageMultiplier *= areaRuntime?.directDamageMultiplier ?? 1;
  }

  const durationRuntime = GEM_EFFECT_DESCRIPTORS[DURATION_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, DURATION_GEM_ID)) {
    config.durationMultiplier *= durationRuntime?.durationMultiplier ?? 1;
  }

  const knockbackRuntime = GEM_EFFECT_DESCRIPTORS[KNOCKBACK_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, KNOCKBACK_GEM_ID) && isProjectileSkill(skillId)) {
    config.knockbackDistance = Math.max(config.knockbackDistance, knockbackRuntime?.knockbackDistance ?? 0);
  }

  const lifestealRuntime = GEM_EFFECT_DESCRIPTORS[LIFESTEAL_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, LIFESTEAL_GEM_ID) && isProjectileSkill(skillId)) {
    config.lifestealRatio = Math.max(config.lifestealRatio, lifestealRuntime?.lifestealRatio ?? 0);
  }

  const executionRuntime = GEM_EFFECT_DESCRIPTORS[EXECUTION_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, EXECUTION_GEM_ID) && isProjectileSkill(skillId)) {
    config.executionThreshold = Math.max(config.executionThreshold, executionRuntime?.executionThreshold ?? 0);
    config.executionDamageMultiplier = Math.max(
      config.executionDamageMultiplier,
      executionRuntime?.executionDamageMultiplier ?? 1,
    );
  }

  const criticalRuntime = GEM_EFFECT_DESCRIPTORS[CRITICAL_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, CRITICAL_GEM_ID) && isProjectileSkill(skillId)) {
    config.criticalChance = Math.max(config.criticalChance, criticalRuntime?.criticalChance ?? 0);
    config.criticalDamageMultiplier = Math.max(
      config.criticalDamageMultiplier,
      criticalRuntime?.criticalDamageMultiplier ?? 1,
    );
  }

  const spreadRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_SPREAD_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_SPREAD_GEM_ID) && skillId === "fireball") {
    config.spreadCount = spreadRuntime?.spreadCount ?? 0;
    config.spreadAngleDeg = spreadRuntime?.spreadAngleDeg ?? 0;
    config.directDamageMultiplier *= spreadRuntime?.directDamageMultiplier ?? 1;
  }

  const burstRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_BURST_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_BURST_GEM_ID) && skillId === "fireball") {
    config.burstCount = burstRuntime?.burstCount ?? 0;
    config.burstDelayMs = burstRuntime?.burstDelayMs ?? 0;
    config.directDamageMultiplier *= burstRuntime?.directDamageMultiplier ?? 1;
    config.cooldownMultiplier *= burstRuntime?.cooldownMultiplier ?? 1;
  }

  const novaImpactRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_NOVA_IMPACT_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_NOVA_IMPACT_GEM_ID) && isProjectileSkill(skillId)) {
    config.novaImpactCount = novaImpactRuntime?.novaImpactCount ?? 0;
    config.novaImpactDamageScale = novaImpactRuntime?.novaImpactDamageScale ?? 0;
    config.directDamageMultiplier *= novaImpactRuntime?.directDamageMultiplier ?? 1;
  }

  const spiralRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_SPIRAL_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_SPIRAL_GEM_ID) && isProjectileSkill(skillId)) {
    config.spiralAmplitude = spiralRuntime?.spiralAmplitude ?? 0;
    config.spiralFrequency = spiralRuntime?.spiralFrequency ?? 0;
    config.projectileSpeedMultiplier *= spiralRuntime?.projectileSpeedMultiplier ?? 1;
  }

  const forkRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_FORK_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_FORK_GEM_ID) && isProjectileSkill(skillId)) {
    config.fork = Boolean(forkRuntime?.fork);
    config.forkDamageScale = forkRuntime?.forkDamageScale ?? 1;
  }

  const orbitRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_ORBIT_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_ORBIT_GEM_ID) && skillId === "fireball") {
    config.orbitDurationMs = orbitRuntime?.orbitDurationMs ?? 0;
    config.orbitRadius = orbitRuntime?.orbitRadius ?? 0;
  }

  const aftershockRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_AFTERSHOCK_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_AFTERSHOCK_GEM_ID) && isProjectileSkill(skillId)) {
    config.aftershockDelayMs = aftershockRuntime?.aftershockDelayMs ?? 0;
    config.aftershockDamageScale = aftershockRuntime?.aftershockDamageScale ?? 0;
    config.directDamageMultiplier *= aftershockRuntime?.directDamageMultiplier ?? 1;
  }

  const cloneRuntime = GEM_EFFECT_DESCRIPTORS[FIRE_CLONE_GEM_ID].runtime;
  if (hasAnyWeaponGem(player, FIRE_CLONE_GEM_ID) && isProjectileSkill(skillId)) {
    config.cloneOnHit = Boolean(cloneRuntime?.cloneOnHit);
    config.cloneDamageScale = cloneRuntime?.cloneDamageScale ?? 0;
    config.directDamageMultiplier *= cloneRuntime?.directDamageMultiplier ?? 1;
  }

  return config;
}

export function getFireballCastTimeMs(player: WeaponGemCarrier | undefined, fireTrailCastPenaltyMs: number) {
  const config = getProjectileGemConfig("fireball", player, { fireTrailCastPenaltyMs });
  return Math.round((FIREBALL_BASE_CAST_TIME_MS + config.castTimeFlatMs) * config.castTimeMultiplier);
}

export function getFireballCastRange(baseCastRange: number, player: WeaponGemCarrier | undefined) {
  return Math.round(baseCastRange * getProjectileGemConfig("fireball", player).castRangeMultiplier);
}

export function getFireballCooldownMs(baseCooldownMs: number, player: WeaponGemCarrier | undefined) {
  return Math.round(baseCooldownMs * getProjectileGemConfig("fireball", player).cooldownMultiplier);
}

export function canProjectileLeaveTrail(skillId: string, player: WeaponGemCarrier | undefined) {
  return getProjectileGemConfig(skillId, player).trail;
}

export function canProjectileShatter(skillId: string, player: WeaponGemCarrier | undefined) {
  return getProjectileGemConfig(skillId, player).shatter;
}

export function getProjectileBounceCount(
  skillId: string,
  player: WeaponGemCarrier | undefined,
  bounceCount: number,
) {
  return getProjectileGemConfig(skillId, player, { bounceCount }).bounceCount;
}

export function isProjectileReturningEnabled(skillId: string, player: WeaponGemCarrier | undefined) {
  return getProjectileGemConfig(skillId, player).returnOnMiss;
}

export function getProjectileRangeMultiplier(
  skillId: string,
  player: WeaponGemCarrier | undefined,
  longshotMultiplier: number,
) {
  return getProjectileGemConfig(skillId, player, { longshotRangeMultiplier: longshotMultiplier })
    .projectileRangeMultiplier;
}

export function hasSplitProjectileGem(player: WeaponGemCarrier | undefined) {
  return getProjectileGemConfig("fireball", player).splitProjectile;
}
