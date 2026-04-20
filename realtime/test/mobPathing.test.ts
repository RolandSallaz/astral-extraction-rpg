import assert from "assert";
import { MobState } from "../src/rooms/schema/MobState.js";
import { resolveMobPathTarget } from "../src/rooms/runtime/mobPathing.js";

describe("mobPathing", () => {
  it("routes around blocked tiles instead of chasing straight through them", () => {
    const mob = new MobState();
    mob.id = "rat";
    mob.x = 1 * 32 + 16;
    mob.y = 2 * 32 + 16;

    const blockedTiles = new Set(["2:0", "2:1", "2:2", "2:3"]);
    const cache = new Map();

    const nextTarget = resolveMobPathTarget(mob, {
      now: 1000,
      desiredX: 4 * 32 + 16,
      desiredY: 2 * 32 + 16,
      cache,
      grid: {
        tileSize: 32,
        width: 5,
        height: 5,
        isBlocked: (tileX, tileY) => blockedTiles.has(`${tileX}:${tileY}`),
      },
    });

    assert.notStrictEqual(nextTarget.x, 4 * 32 + 16);
    assert.ok(nextTarget.y > mob.y, "mob should route downward toward the open gap");
    assert.ok(cache.has("rat"));
  });

  it("moves directly when there is no blocked line between mob and target", () => {
    const mob = new MobState();
    mob.id = "bat";
    mob.x = 1 * 32 + 16;
    mob.y = 1 * 32 + 16;

    const nextTarget = resolveMobPathTarget(mob, {
      now: 1000,
      desiredX: 3 * 32 + 16,
      desiredY: 1 * 32 + 16,
      cache: new Map(),
      grid: {
        tileSize: 32,
        width: 5,
        height: 5,
        isBlocked: () => false,
      },
    });

    assert.strictEqual(nextTarget.x, 3 * 32 + 16);
    assert.strictEqual(nextTarget.y, 1 * 32 + 16);
  });
});
