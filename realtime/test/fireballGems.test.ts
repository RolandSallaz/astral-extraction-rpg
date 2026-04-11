import assert from "assert";
import {
  AREA_GEM_ID,
  CAST_SPEED_GEM_ID,
  CHAIN_GEM_ID,
  CRITICAL_GEM_ID,
  DURATION_GEM_ID,
  EXECUTION_GEM_ID,
  FIRE_BOUNCE_GEM_ID,
  FIRE_LONGSHOT_GEM_ID,
  FIRE_RANGE_GEM_ID,
  FIRE_RETURN_GEM_ID,
  FIRE_SHATTER_GEM_ID,
  FIRE_SPLIT_GEM_ID,
  FIRE_TRAIL_GEM_ID,
  FIREBALL_SHARD_SKILL_ID,
  FIREBALL_SPLIT_SKILL_ID,
  HOMING_GEM_ID,
  KNOCKBACK_GEM_ID,
  LIFESTEAL_GEM_ID,
  PIERCE_GEM_ID,
  canProjectileLeaveTrail,
  canProjectileShatter,
  getFireballCastRange,
  getFireballCastTimeMs,
  getFireballCooldownMs,
  getProjectileBounceCount,
  getProjectileGemConfig,
  getProjectileRangeMultiplier,
  hasSplitProjectileGem,
  isProjectileReturningEnabled,
  type WeaponGemCarrier,
} from "../src/rooms/fireballGems.js";

describe("fireball gem helpers", () => {
  it("stacks projectile gem modifiers into one config", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_TRAIL_GEM_ID,
      weaponGemItem2: CAST_SPEED_GEM_ID,
      weaponGemItem3: AREA_GEM_ID,
    };

    const config = getProjectileGemConfig("fireball", player, {
      fireTrailCastPenaltyMs: 200,
    });

    assert.strictEqual(config.trail, true);
    assert.strictEqual(config.castTimeFlatMs, 200);
    assert.strictEqual(config.castTimeMultiplier, 0.65);
    assert.strictEqual(config.splashRadius, 48);
    assert.strictEqual(config.splashDamageScale, 0.6);
    assert.ok(Math.abs(config.directDamageMultiplier - 0.704) < 0.00001);
  });

  it("applies range gem to cast range and cooldown", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_RANGE_GEM_ID,
    };

    assert.strictEqual(getFireballCastRange(192, player), 240);
    assert.strictEqual(getFireballCooldownMs(1000, player), 1250);
  });

  it("keeps split exclusive to the main fireball cast", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_SPLIT_GEM_ID,
    };

    assert.strictEqual(hasSplitProjectileGem(player), true);
    assert.strictEqual(getProjectileGemConfig(FIREBALL_SPLIT_SKILL_ID, player).splitProjectile, false);
    assert.strictEqual(getProjectileGemConfig(FIREBALL_SHARD_SKILL_ID, player).splitProjectile, false);
  });

  it("lets shatter affect the main projectile and split projectiles but not shards", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_SHATTER_GEM_ID,
    };

    assert.strictEqual(canProjectileShatter("fireball", player), true);
    assert.strictEqual(canProjectileShatter(FIREBALL_SPLIT_SKILL_ID, player), true);
    assert.strictEqual(canProjectileShatter(FIREBALL_SHARD_SKILL_ID, player), false);
  });

  it("applies return, bounce and longshot to projectile skills", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_RETURN_GEM_ID,
      weaponGemItem2: FIRE_BOUNCE_GEM_ID,
      weaponGemItem3: FIRE_LONGSHOT_GEM_ID,
    };

    assert.strictEqual(isProjectileReturningEnabled("fireball", player), true);
    assert.strictEqual(isProjectileReturningEnabled(FIREBALL_SHARD_SKILL_ID, player), true);
    assert.strictEqual(getProjectileBounceCount("fireball", player, 2), 2);
    assert.strictEqual(getProjectileRangeMultiplier("fireball", player, 3), 3);
    assert.strictEqual(getProjectileRangeMultiplier("fireNova", player, 3), 1);
  });

  it("stacks bounce gems additively across weapon sockets", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_BOUNCE_GEM_ID,
      weaponGemItem2: FIRE_BOUNCE_GEM_ID,
      weaponGemItem3: FIRE_BOUNCE_GEM_ID,
    };

    assert.strictEqual(getProjectileBounceCount("fireball", player, 2), 6);
    assert.strictEqual(getProjectileBounceCount(FIREBALL_SHARD_SKILL_ID, player, 2), 6);
    assert.strictEqual(getProjectileBounceCount("fireField", player, 2), 0);
  });

  it("combines advanced combat gems without affecting non-projectile skills", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: PIERCE_GEM_ID,
      weaponGemItem2: CHAIN_GEM_ID,
      weaponGemItem3: HOMING_GEM_ID,
    };

    const projectileConfig = getProjectileGemConfig("fireball", player);
    const nonProjectileConfig = getProjectileGemConfig("fireField", player);

    assert.strictEqual(projectileConfig.pierceCount, 2);
    assert.strictEqual(projectileConfig.chainCount, 2);
    assert.strictEqual(projectileConfig.homingStrength, 3.2);
    assert.ok(projectileConfig.directDamageMultiplier < 1);
    assert.strictEqual(nonProjectileConfig.pierceCount, 0);
    assert.strictEqual(nonProjectileConfig.chainCount, 0);
    assert.strictEqual(nonProjectileConfig.homingStrength, 0);
  });

  it("supports duration, knockback, lifesteal, execution and critical gem effects together", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: DURATION_GEM_ID,
      weaponGemItem2: KNOCKBACK_GEM_ID,
      weaponGemItem3: LIFESTEAL_GEM_ID,
    };
    const extended: WeaponGemCarrier = {
      ...player,
      weaponGemItem1: EXECUTION_GEM_ID,
      weaponGemItem2: CRITICAL_GEM_ID,
      weaponGemItem3: DURATION_GEM_ID,
    };

    const utilityConfig = getProjectileGemConfig("fireball", player);
    const finisherConfig = getProjectileGemConfig("fireball", extended);

    assert.strictEqual(utilityConfig.durationMultiplier, 1.5);
    assert.strictEqual(utilityConfig.knockbackDistance, 28);
    assert.strictEqual(utilityConfig.lifestealRatio, 0.1);
    assert.strictEqual(finisherConfig.executionThreshold, 0.3);
    assert.strictEqual(finisherConfig.executionDamageMultiplier, 1.5);
    assert.strictEqual(finisherConfig.criticalChance, 0.2);
    assert.strictEqual(finisherConfig.criticalDamageMultiplier, 2);
  });

  it("calculates fireball cast time with flat penalty and multiplier", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_TRAIL_GEM_ID,
      weaponGemItem2: CAST_SPEED_GEM_ID,
    };

    assert.strictEqual(getFireballCastTimeMs(player, 200), 260);
  });

  it("uses a 200ms base fireball cast time without gems", () => {
    assert.strictEqual(getFireballCastTimeMs(undefined, 200), 200);
  });

  it("only lets projectile skills leave trail", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_TRAIL_GEM_ID,
    };

    assert.strictEqual(canProjectileLeaveTrail("fireball", player), true);
    assert.strictEqual(canProjectileLeaveTrail(FIREBALL_SPLIT_SKILL_ID, player), true);
    assert.strictEqual(canProjectileLeaveTrail(FIREBALL_SHARD_SKILL_ID, player), true);
    assert.strictEqual(canProjectileLeaveTrail("fireField", player), false);
  });
});
