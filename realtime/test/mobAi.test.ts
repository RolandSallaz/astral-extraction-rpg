import assert from "assert";
import { MobState } from "../src/rooms/schema/MobState.js";
import { resolveMobAggroTarget, setMobAggroTarget } from "../src/rooms/mobAi.js";
import { hasGridLineOfSight } from "../src/rooms/mobPathing.js";

describe("mob AI aggro", () => {
  it("does not acquire a player through a blocking wall", () => {
    const mob = new MobState();
    mob.id = "rat";
    mob.x = 1 * 32 + 16;
    mob.y = 2 * 32 + 16;
    mob.aggroRange = 999;

    const player = {
      id: "player-1",
      x: 4 * 32 + 16,
      y: 2 * 32 + 16,
      dead: false,
    };

    const blockedTiles = new Set(["2:2", "3:2"]);
    const target = resolveMobAggroTarget(mob, [player], {
      canAcquireTarget: (candidate) =>
        hasGridLineOfSight(
          {
            x: Math.floor(mob.x / 32),
            y: Math.floor(mob.y / 32),
          },
          {
            x: Math.floor(candidate.x / 32),
            y: Math.floor(candidate.y / 32),
          },
          {
            tileSize: 32,
            width: 6,
            height: 6,
            isBlocked: (tileX, tileY) => blockedTiles.has(`${tileX}:${tileY}`),
          },
        ),
    });

    assert.strictEqual(target, null);
    assert.strictEqual(mob.aggroTargetId, "");
  });

  it("acquires a player when line of sight is clear", () => {
    const mob = new MobState();
    mob.id = "bat";
    mob.x = 1 * 32 + 16;
    mob.y = 1 * 32 + 16;
    mob.aggroRange = 999;

    const player = {
      id: "player-2",
      x: 3 * 32 + 16,
      y: 1 * 32 + 16,
      dead: false,
    };

    const target = resolveMobAggroTarget(mob, [player], {
      canAcquireTarget: (candidate) =>
        hasGridLineOfSight(
          {
            x: Math.floor(mob.x / 32),
            y: Math.floor(mob.y / 32),
          },
          {
            x: Math.floor(candidate.x / 32),
            y: Math.floor(candidate.y / 32),
          },
          {
            tileSize: 32,
            width: 6,
            height: 6,
            isBlocked: () => false,
          },
        ),
    });

    assert.ok(target);
    assert.strictEqual(target?.id, "player-2");
    assert.strictEqual(mob.aggroTargetId, "player-2");
  });

  it("keeps forced aggro on the attacker while the lock is active", () => {
    const mob = new MobState();
    mob.id = "rat";
    mob.x = 0;
    mob.y = 0;
    mob.aggroRange = 999;

    const attacker = {
      id: "player-3",
      x: 280,
      y: 0,
      dead: false,
    };
    const closerPlayer = {
      id: "player-4",
      x: 64,
      y: 0,
      dead: false,
    };

    setMobAggroTarget(mob, attacker, { now: 1000, lockDurationMs: 2000 });

    const target = resolveMobAggroTarget(mob, [attacker, closerPlayer], {
      now: 1500,
    });

    assert.ok(target);
    assert.strictEqual(target?.id, "player-3");
    assert.strictEqual(mob.aggroTargetId, "player-3");
  });

  it("switches aggro to a much closer player after the lock expires", () => {
    const mob = new MobState();
    mob.id = "rat";
    mob.x = 0;
    mob.y = 0;
    mob.aggroRange = 999;

    const attacker = {
      id: "player-5",
      x: 280,
      y: 0,
      dead: false,
    };
    const closerPlayer = {
      id: "player-6",
      x: 64,
      y: 0,
      dead: false,
    };

    setMobAggroTarget(mob, attacker, { now: 1000, lockDurationMs: 2000 });

    const target = resolveMobAggroTarget(mob, [attacker, closerPlayer], {
      now: 3201,
    });

    assert.ok(target);
    assert.strictEqual(target?.id, "player-6");
    assert.strictEqual(mob.aggroTargetId, "player-6");
  });
});
