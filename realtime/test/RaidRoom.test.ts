import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { RaidRoomState } from "../src/rooms/schema/RaidRoomState.js";
import { RaidRoom } from "../src/rooms/RaidRoom.js";

async function waitForNextSimulation(room: { waitForNextPatch: () => Promise<unknown> }, ms = 280) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await room.waitForNextPatch();
}

describe("raid room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => (colyseus = await boot(appConfig)));
  after(async () => colyseus.shutdown());
  beforeEach(async () => await colyseus.cleanup());

  it("expires the raid, kills players and notifies the client", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-expiry-test",
      seed: "expiry-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await colyseus.connectTo(room, {
      name: "Expiry Raider",
      raidRunId: "raid-expiry-test",
      weaponItem: "default_staff",
      inventory: ["healing_potion::2"],
    });

    await room.waitForNextPatch();

    const payloadPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.onMessage("raidExpired", (payload) => resolve(payload as Record<string, unknown>));
    });

    (room as unknown as RaidRoom & { raidExpiresAt: number }).raidExpiresAt = Date.now() - 1;
    (room as unknown as RaidRoom & { updateRaidExpiration: () => void }).updateRaidExpiration();

    const payload = await Promise.race([
      payloadPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("raidExpired not received")), 1500)),
    ]);

    assert.strictEqual(room.state.status, "expired");
    assert.strictEqual(payload.raidRunId, "raid-expiry-test");
    assert.strictEqual(payload.reason, "expired");
    assert.strictEqual(payload.health, 0);
    assert.strictEqual(typeof payload.maxHealth, "number");

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);
    assert.strictEqual(player?.dead, true);
    assert.strictEqual(player?.health, 0);
  });

  it("extracts the player with current loot when using an exit", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-extract-test",
      seed: "extract-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await colyseus.connectTo(room, {
      name: "Extract Raider",
      raidRunId: "raid-extract-test",
      bodyItem: "robe_tunic",
      headItem: "magic_hat",
      headGemItem1: "focus_gem",
      bodyGemItem1: "guard_gem",
      bodyGemItem2: "vitality_gem",
      weaponItem: "default_staff",
      weaponGemItem1: "fire_trail_gem",
      inventory: ["healing_potion::2", "critical_gem"],
    });

    await room.waitForNextPatch();

    const exitId = room.state.exitPoints[0];
    assert.ok(exitId);
    const [tileX, tileY] = exitId.split(":").map((value) => Number.parseInt(value, 10));
    const player = room.state.players.get(client.sessionId);
    assert.ok(player);
    player!.x = tileX * 32 + 16;
    player!.y = tileY * 32 + 16;

    const payloadPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.onMessage("raidExited", (payload) => resolve(payload as Record<string, unknown>));
    });

    client.send("useExit", { exitId });

    const payload = await Promise.race([
      payloadPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("raidExited not received")), 1500)),
    ]);

    assert.strictEqual(payload.reason, "extracted");
    assert.strictEqual(payload.exitId, exitId);
    assert.deepStrictEqual(payload.equipment, {
      head: "magic_hat",
      body: "robe_tunic",
      weapon: "default_staff",
      "head-gem-1": "focus_gem",
      "body-gem-1": "guard_gem",
      "body-gem-2": "vitality_gem",
      "weapon-gem-1": "fire_trail_gem",
    });
    assert.deepStrictEqual(payload.inventory, [
      "healing_potion::2",
      "critical_gem",
      ...new Array(22).fill(null),
    ]);
    assert.strictEqual(room.state.players.get(client.sessionId), undefined);
    assert.strictEqual(
      Array.from(room.state.chests.values()).some((chest) => chest.title === "Loot Bag"),
      false,
    );
  });

  it("builds the crypt_small tutorial layout with scripted loot and encounter", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-crypt-small-test",
      seed: "crypt-small-seed",
      templateCode: "crypt_small",
    });

    const client = await colyseus.connectTo(room, {
      name: "Tutorial Raider",
      raidRunId: "raid-crypt-small-test",
    });

    await room.waitForNextPatch();

    assert.strictEqual(room.state.templateCode, "crypt_small");
    assert.strictEqual(room.state.width, 32);
    assert.strictEqual(room.state.height, 16);
    assert.deepStrictEqual(Array.from(room.state.exitPoints), ["27:7"]);

    const tutorialChest = room.state.chests.get("raid-chest-0-13-7");
    assert.ok(tutorialChest);
    assert.strictEqual(tutorialChest?.title, "Astral Reliquary");
    assert.strictEqual(tutorialChest?.subtitle, "Training Cache");
    assert.deepStrictEqual(Array.from(tutorialChest?.slots ?? []), [
      "default_staff",
      "fire_trail_gem",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const tutorialMobs = Array.from(room.state.mobs.values());
    assert.strictEqual(tutorialMobs.length, 1);
    assert.strictEqual(tutorialMobs[0]?.id, "raid-rat-tutorial");
    assert.strictEqual(tutorialMobs[0]?.name, "Rat");

    await client.leave();
  });

  it("keeps the player alive in the crypt_small tutorial", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-crypt-small-safety",
      seed: "crypt-small-safety-seed",
      templateCode: "crypt_small",
    });

    const client = await colyseus.connectTo(room, {
      name: "Safe Raider",
      raidRunId: "raid-crypt-small-safety",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);
    player!.health = 3;

    const dealt = (room as unknown as {
      applyDamageToPlayer: (target: { health: number }, amount: number, damageType: "physical" | "fire") => number;
    }).applyDamageToPlayer(player!, 999, "physical");

    assert.strictEqual(dealt, 2);
    assert.strictEqual(player!.health, 1);
    assert.strictEqual(player!.dead, false);

    await client.leave();
  });

  it("rejects fireball casts without the required weapon", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-no-weapon",
      seed: "raid-no-weapon-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await colyseus.connectTo(room, {
      name: "Unarmed Raider",
      raidRunId: "raid-no-weapon",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    client.send("castSkill", {
      skillId: "fireball",
      targetX: player.x + 120,
      targetY: player.y,
    });

    await waitForNextSimulation(room, 320);

    assert.strictEqual(room.state.projectiles.size, 0);
    assert.strictEqual(player.fireballCooldownEndsAt, 0);
    await client.leave();
  });

  it("casts fire nova after cast time and starts cooldown", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-fire-nova",
      seed: "raid-fire-nova-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await colyseus.connectTo(room, {
      name: "Nova Raider",
      raidRunId: "raid-fire-nova",
      weaponItem: "default_staff",
    });

    await room.waitForNextPatch();

    client.send("castSkill", {
      skillId: "fireNova",
    });

    await waitForNextSimulation(room, 320);

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);
    assert.ok(room.state.projectiles.size >= 11);
    assert.ok((player?.fireNovaCooldownEndsAt ?? 0) > Date.now() + 9000);
    await client.leave();
  });

  it("casts fire field after cast time and starts cooldown", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-fire-field",
      seed: "raid-fire-field-seed",
      templateCode: "crypt_small",
    });

    const client = await colyseus.connectTo(room, {
      name: "Field Raider",
      raidRunId: "raid-fire-field",
      weaponItem: "default_staff",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    client.send("castSkill", {
      skillId: "fireField",
      targetX: player.x + 64,
      targetY: player.y,
    });

    await waitForNextSimulation(room, 320);

    const updatedPlayer = room.state.players.get(client.sessionId);
    assert.ok(room.state.groundEffects.size > 0);
    assert.ok((updatedPlayer?.fireFieldCooldownEndsAt ?? 0) > Date.now() + 11000);
    await client.leave();
  });
});
