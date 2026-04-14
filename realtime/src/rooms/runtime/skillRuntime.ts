import { type ArmorGemCarrier } from "../armorGems.js";
import {
  canProjectileLeaveTrail as getCanProjectileLeaveTrail,
  canProjectileShatter as getCanProjectileShatter,
  getProjectileGemConfig,
  getProjectileBounceCount as getBaseProjectileBounceCount,
  getProjectileRangeMultiplier as getBaseProjectileRangeMultiplier,
  hasSplitProjectileGem as getHasSplitProjectileGem,
  hasWeaponGem,
  isProjectileReturningEnabled as getIsProjectileReturningEnabled,
  type ProjectileGemConfig,
  type WeaponGemCarrier,
} from "../fireballGems.js";
import {
  applyHealingMultiplier,
  getSharedFireballCastTimeMs,
} from "../projectileSkills.js";
import { type ProjectileState, type ProjectileServerData } from "../schema/ProjectileState.js";
import { type SkillBalanceConfig } from "../skillBalance.js";
import {
  getProjectileDamageScale as getSharedProjectileDamageScale,
  getProjectileDirectDamage as getSharedProjectileDirectDamage,
} from "../sharedGameplay.js";

export type ProjectileRuntimePlayer = WeaponGemCarrier &
  ArmorGemCarrier & {
    id: string;
    health: number;
    maxHealth: number;
    dead: boolean;
  };

type PlayerLookup<TPlayer> = (playerId: string) => TPlayer | undefined;

export function getRoomPlayerCastTimeMs<TPlayer extends ArmorGemCarrier>(
  player: TPlayer | undefined,
  fireTrailCastPenaltyMs: number,
) {
  return getSharedFireballCastTimeMs(player, fireTrailCastPenaltyMs);
}

export function playerHasRoomWeaponGem<TPlayer extends WeaponGemCarrier>(
  player: TPlayer | undefined,
  gemItemId: string,
) {
  return hasWeaponGem(player, gemItemId);
}

export function canRoomProjectileLeaveTrail<TPlayer extends WeaponGemCarrier>(
  projectile: ProjectileState,
  getPlayerById: PlayerLookup<TPlayer>,
) {
  return getCanProjectileLeaveTrail(projectile.skillId, getPlayerById(projectile.ownerId));
}

export function canRoomProjectileShatter<TPlayer extends WeaponGemCarrier>(
  projectile: ProjectileState,
  getPlayerById: PlayerLookup<TPlayer>,
) {
  return getCanProjectileShatter(projectile.skillId, getPlayerById(projectile.ownerId));
}

export function getRoomProjectileBounceCount<TPlayer extends WeaponGemCarrier>(
  ownerId: string,
  skillId: string,
  getPlayerById: PlayerLookup<TPlayer>,
  baseBounceCount: number,
) {
  return getBaseProjectileBounceCount(skillId, getPlayerById(ownerId), baseBounceCount);
}

export function isRoomProjectileReturningEnabled<TPlayer extends WeaponGemCarrier>(
  projectile: ProjectileState,
  getPlayerById: PlayerLookup<TPlayer>,
) {
  return getIsProjectileReturningEnabled(projectile.skillId, getPlayerById(projectile.ownerId));
}

export function getRoomProjectileRangeMultiplier<TPlayer extends WeaponGemCarrier>(
  ownerId: string,
  skillId: string,
  getPlayerById: PlayerLookup<TPlayer>,
  longshotRangeMultiplier: number,
) {
  return getBaseProjectileRangeMultiplier(
    skillId,
    getPlayerById(ownerId),
    longshotRangeMultiplier,
  );
}

export function hasRoomSplitProjectileGem<TPlayer extends WeaponGemCarrier>(
  ownerId: string,
  getPlayerById: PlayerLookup<TPlayer>,
) {
  return getHasSplitProjectileGem(getPlayerById(ownerId));
}

export function getRoomOwnerProjectileGemConfig<TPlayer extends WeaponGemCarrier>(
  ownerId: string,
  skillId: string,
  getPlayerById: PlayerLookup<TPlayer>,
  options: {
    fireTrailCastPenaltyMs: number;
    longshotRangeMultiplier: number;
    bounceCount: number;
  },
) {
  return getProjectileGemConfig(skillId, getPlayerById(ownerId), options);
}

export function getRoomSkillBalanceKey(skillId: string): keyof SkillBalanceConfig {
  if (skillId === "fireNova") {
    return "fireNova";
  }

  if (skillId === "fireField") {
    return "fireField";
  }

  return "fireball";
}

export function getRoomSkillDirectDamage(
  skillBalance: SkillBalanceConfig,
  skillId: string,
) {
  return skillBalance[getRoomSkillBalanceKey(skillId)].damage;
}

export function getRoomSkillBurnDamage(
  skillBalance: SkillBalanceConfig,
  skillId: string,
) {
  return skillBalance[getRoomSkillBalanceKey(skillId)].burnDamage;
}

export function getRoomProjectileDamageScale(projectile: ProjectileState, serverData: ProjectileServerData) {
  return getSharedProjectileDamageScale(projectile, serverData);
}

export function getRoomProjectileDirectDamage(
  skillBalance: SkillBalanceConfig,
  projectile: ProjectileState,
  serverData: ProjectileServerData,
  targetHealth: number,
  targetMaxHealth: number,
) {
  return getSharedProjectileDirectDamage(
    projectile,
    serverData,
    getRoomSkillDirectDamage(skillBalance, projectile.skillId),
    targetHealth,
    targetMaxHealth,
  );
}

export function applyRoomProjectileLifesteal<TPlayer extends ProjectileRuntimePlayer>(
  ownerId: string,
  resolvedDamage: number,
  targetPlayerId: string | undefined,
  getPlayerById: PlayerLookup<TPlayer>,
  getGemConfig: (ownerId: string, skillId: string) => ProjectileGemConfig,
) {
  if (resolvedDamage <= 0 || targetPlayerId === ownerId) {
    return 0;
  }

  const owner = getPlayerById(ownerId);
  if (!owner || owner.dead) {
    return 0;
  }

  const lifestealRatio = getGemConfig(ownerId, "fireball").lifestealRatio;
  if (lifestealRatio <= 0) {
    return 0;
  }

  const previousHealth = owner.health;
  const healAmount = applyHealingMultiplier(
    resolvedDamage * lifestealRatio,
    owner,
  );
  owner.health = Math.min(owner.maxHealth, owner.health + healAmount);
  return Math.max(0, owner.health - previousHealth);
}
