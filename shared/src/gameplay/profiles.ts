/**
 * Gameplay profiles — the source of truth for game-loop constants
 * shared by realtime server, frontend predictions, and tooling.
 *
 * Previously these lived exclusively in realtime/sharedGameplay.ts
 * and were inaccessible to the frontend.
 */

export type RoomGameplayProfile = {
  tileSize: number;
  networkTickRate: number;
  remoteInterpolationDelayMs: number;
  lagCompensationMaxRewindMs: number;
  positionHistoryDurationMs: number;
  playerMoveSpeed: number;
  projectileBoundsPadding: number;
  fireballSpeed: number;
  fireballLifetime: number;
  fireballBaseDamage: number;
  fireballSpawnOffsetY: number;
  fireballSelfHitArmDistance: number;
  fireballSelfHitGraceMs: number;
  staffCastRange: number;
  fireTrailCastPenaltyMs: number;
  fireballBurnTickMs: number;
  playerHitRadius: number;
  mobHitRadius: number;
  playerMobCollisionRadius: number;
  meleeStrikeDamage: number;
  meleeStrikeRange: number;
  meleeStrikeCooldownMs: number;
  meleeStrikeArcHalfAngleRad: number;
  fireballCooldownMs: number;
  fireNovaProjectileCount: number;
  fireNovaCooldownMs: number;
  fireFieldCooldownMs: number;
  fireFieldDurationMs: number;
  fireFieldTickMs: number;
  fireFieldRadiusTiles: number;
  fireTrailDurationMs: number;
  fireTrailTickMs: number;
  fireballShardCount: number;
  fireballShardLifetime: number;
  fireBounceCount: number;
  fireLongshotRangeMultiplier: number;
  fireSplitDamageScale: number;
  fireSplitAngleOffsetRad: number;
  mobRespawnMs: number;
  healingPotionTotalHeal: number;
  healingPotionDurationMs: number;
  healingPotionTickMs: number;
  healingPotionCooldownMs: number;
  teleportScrollCastMs: number;
  teleportScrollRandomAttempts: number;
};

const COMMON_GAMEPLAY: Omit<
  RoomGameplayProfile,
  | "playerMoveSpeed"
  | "fireballSpeed"
  | "fireballLifetime"
  | "fireballSpawnOffsetY"
  | "mobRespawnMs"
  | "teleportScrollRandomAttempts"
> = {
  tileSize: 32,
  networkTickRate: 40,
  remoteInterpolationDelayMs: 100,
  lagCompensationMaxRewindMs: 180,
  positionHistoryDurationMs: 1000,
  projectileBoundsPadding: 32,
  fireballBaseDamage: 8,
  fireballSelfHitArmDistance: 52,
  fireballSelfHitGraceMs: 240,
  staffCastRange: 32 * 6,
  fireTrailCastPenaltyMs: 200,
  fireballBurnTickMs: 1000,
  playerHitRadius: 18,
  mobHitRadius: 18,
  playerMobCollisionRadius: 22,
  meleeStrikeDamage: 2,
  meleeStrikeRange: 46,
  meleeStrikeCooldownMs: 450,
  meleeStrikeArcHalfAngleRad: Math.PI * 0.5,
  fireballCooldownMs: 1000,
  fireNovaProjectileCount: 12,
  fireNovaCooldownMs: 10000,
  fireFieldCooldownMs: 12000,
  fireFieldDurationMs: 10000,
  fireFieldTickMs: 1000,
  fireFieldRadiusTiles: 1,
  fireTrailDurationMs: 5000,
  fireTrailTickMs: 1000,
  fireballShardCount: 9,
  fireballShardLifetime: 0.45,
  fireBounceCount: 2,
  fireLongshotRangeMultiplier: 3,
  fireSplitDamageScale: 0.5,
  fireSplitAngleOffsetRad: 0.14,
  healingPotionTotalHeal: 20,
  healingPotionDurationMs: 10000,
  healingPotionTickMs: 1000,
  healingPotionCooldownMs: 20000,
  teleportScrollCastMs: 3000,
};

export const WORLD_GAMEPLAY_PROFILE: RoomGameplayProfile = {
  ...COMMON_GAMEPLAY,
  playerMoveSpeed: 120,
  fireballSpeed: 360,
  fireballLifetime: 0.8,
  fireballSpawnOffsetY: -8,
  mobRespawnMs: 15000,
  teleportScrollRandomAttempts: 192,
};

export const RAID_GAMEPLAY_PROFILE: RoomGameplayProfile = {
  ...COMMON_GAMEPLAY,
  playerMoveSpeed: 110,
  fireballSpeed: 280,
  fireballLifetime: 1.3,
  fireballSpawnOffsetY: -4,
  mobRespawnMs: 15000,
  teleportScrollRandomAttempts: 224,
};
