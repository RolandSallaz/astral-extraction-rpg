import assert from "assert";
import {
  getProjectileGemConfig,
  FIRE_BURST_GEM_ID,
  FIRE_SPREAD_GEM_ID,
  FIRE_SPLIT_GEM_ID,
} from "../src/rooms/runtime/fireballGems.js";
import { buildFireballCastPlan } from "../src/rooms/runtime/projectileSkills.js";

describe("projectile skill planning", () => {
  it("ignores legacy burst and spread gems while gems are disabled", () => {
    const gemConfig = getProjectileGemConfig("fireball", {
      weaponGemItem1: FIRE_BURST_GEM_ID,
      weaponGemItem2: FIRE_SPREAD_GEM_ID,
    });

    const plan = buildFireballCastPlan({
      ownerId: "player-1",
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      now: 1000,
      fireballLifetime: 1.3,
      splitAngleOffsetRad: 0.14,
      splitProjectile: false,
      gemConfig,
    });

    assert.strictEqual(plan.immediateSpawns.length, 1);
    assert.strictEqual(plan.delayedSpawns.length, 0);
    assert.strictEqual(plan.postCastLockMs, 0);
  });

  it("ignores legacy split on top of burst and spread while gems are disabled", () => {
    const gemConfig = getProjectileGemConfig("fireball", {
      weaponGemItem1: FIRE_BURST_GEM_ID,
      weaponGemItem2: FIRE_SPREAD_GEM_ID,
      weaponGemItem3: FIRE_SPLIT_GEM_ID,
    });

    const plan = buildFireballCastPlan({
      ownerId: "player-1",
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      now: 1000,
      fireballLifetime: 1.3,
      splitAngleOffsetRad: 0.14,
      splitProjectile: false,
      gemConfig,
    });

    assert.strictEqual(plan.immediateSpawns.length, 1);
    assert.strictEqual(plan.delayedSpawns.length, 0);
    assert.strictEqual(plan.postCastLockMs, 0);
  });
});
