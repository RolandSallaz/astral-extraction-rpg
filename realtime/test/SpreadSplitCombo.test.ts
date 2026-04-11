import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { createAppConfig } from "../src/app.config.js";
import { MyRoomState } from "../src/rooms/schema/MyRoomState.js";

describe("spread + split combo", () => {
  let colyseus: ColyseusTestServer<ReturnType<typeof createAppConfig>>;

  before(async () => (colyseus = await boot(createAppConfig())));
  after(async () => {
    await colyseus.cleanup();
    await colyseus.shutdown();
  });
  beforeEach(async () => await colyseus.cleanup());

  it("spawns six projectiles for a fireball cast with spread and split gems", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await colyseus.connectTo(room, {
      name: "Combo Mage",
      weaponItem: "default_staff",
      weaponGemItem1: "fire_spread_gem",
      weaponGemItem2: "fire_split_gem",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(caster.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected caster to exist");
    }

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: player.x + 120,
      targetY: player.y,
    });

    await new Promise((resolve) => setTimeout(resolve, 320));
    await room.waitForNextPatch();

    assert.strictEqual(room.state.projectiles.size, 6);
  });
});
