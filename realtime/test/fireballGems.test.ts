import assert from "assert";
import {
  AREA_GEM_ID,
  CAST_SPEED_GEM_ID,
  FIRE_BOUNCE_GEM_ID,
  FIRE_LONGSHOT_GEM_ID,
  FIRE_RANGE_GEM_ID,
  FIRE_RETURN_GEM_ID,
  FIRE_SPLIT_GEM_ID,
  FIRE_TRAIL_GEM_ID,
  FIREBALL_SHARD_SKILL_ID,
  FIREBALL_SPLIT_SKILL_ID,
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
} from "../src/rooms/runtime/fireballGems.js";

describe("fireball gem helpers", () => {
  it("keeps weapon gem effects disabled while gems are removed", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_TRAIL_GEM_ID,
      weaponGemItem2: CAST_SPEED_GEM_ID,
      weaponGemItem3: AREA_GEM_ID,
    };

    const config = getProjectileGemConfig("fireball", player, {
      fireTrailCastPenaltyMs: 200,
    });

    assert.strictEqual(config.trail, false);
    assert.strictEqual(config.castTimeFlatMs, 0);
    assert.strictEqual(config.castTimeMultiplier, 1);
    assert.strictEqual(config.splashRadius, 0);
    assert.strictEqual(config.splashDamageScale, 0);
    assert.strictEqual(config.directDamageMultiplier, 1);
  });

  it("ignores legacy range, split, shatter, return, bounce and longshot gems", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_RANGE_GEM_ID,
      weaponGemItem2: FIRE_SPLIT_GEM_ID,
      weaponGemItem3: FIRE_BOUNCE_GEM_ID,
    };
    const projectilePlayer: WeaponGemCarrier = {
      weaponGemItem1: FIRE_RETURN_GEM_ID,
      weaponGemItem2: FIRE_LONGSHOT_GEM_ID,
      weaponGemItem3: FIRE_TRAIL_GEM_ID,
    };

    assert.strictEqual(getFireballCastRange(192, player), 192);
    assert.strictEqual(getFireballCooldownMs(1000, player), 1000);
    assert.strictEqual(hasSplitProjectileGem(player), false);
    assert.strictEqual(getProjectileGemConfig(FIREBALL_SPLIT_SKILL_ID, player).splitProjectile, false);
    assert.strictEqual(canProjectileShatter("fireball", player), false);
    assert.strictEqual(isProjectileReturningEnabled("fireball", projectilePlayer), false);
    assert.strictEqual(getProjectileBounceCount("fireball", player, 2), 0);
    assert.strictEqual(getProjectileRangeMultiplier("fireball", projectilePlayer, 3), 1);
    assert.strictEqual(canProjectileLeaveTrail("fireball", projectilePlayer), false);
    assert.strictEqual(canProjectileLeaveTrail(FIREBALL_SHARD_SKILL_ID, projectilePlayer), false);
  });

  it("uses base fireball cast time while gems are disabled", () => {
    const player: WeaponGemCarrier = {
      weaponGemItem1: FIRE_TRAIL_GEM_ID,
      weaponGemItem2: CAST_SPEED_GEM_ID,
    };

    assert.strictEqual(getFireballCastTimeMs(player, 200), 200);
    assert.strictEqual(getFireballCastTimeMs(undefined, 200), 200);
  });
});
