import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { createAppConfig } from "../src/app.config.js";
import { RaidRoomState } from "../src/rooms/schema/RaidRoomState.js";
import { KafkaPublisherService } from "../src/services/KafkaPublisher.js";
import {
  createRealtimeServices,
  setRealtimeServices,
  type RealtimeServices,
} from "../src/services/runtimeServices.js";
import { connectToRoom } from "./helpers/realtimeJoin.js";

async function waitForNextSimulation(room: { waitForNextPatch: () => Promise<unknown> }, ms = 280) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await room.waitForNextPatch();
}

describe("raid room", () => {
  let colyseus: ColyseusTestServer<ReturnType<typeof createAppConfig>>;
  let previousRealtimeServices: RealtimeServices;

  before(async () => {
    const kafkaPublisher = new KafkaPublisherService();
    kafkaPublisher.publish = async () => {};
    kafkaPublisher.shutdown = async () => {};
    previousRealtimeServices = setRealtimeServices(createRealtimeServices({ kafkaPublisher }));
    colyseus = await boot(createAppConfig());
  });
  after(async () => {
    await colyseus.cleanup();
    await colyseus.shutdown();
    setRealtimeServices(previousRealtimeServices);
  });
  beforeEach(async () => await colyseus.cleanup());

  it("expires the raid, kills players and notifies the client", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-expiry-test",
      seed: "expiry-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await connectToRoom(colyseus, room, {
      name: "Expiry Raider",
      raidRunId: "raid-expiry-test",
      weaponItem: "wood_staff",
      inventory: ["healing_potion::2"],
    });

    await room.waitForNextPatch();

    const payloadPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.onMessage("raidExpired", (payload) => resolve(payload as Record<string, unknown>));
    });

    const internalRoom = room as unknown as {
      raidExpiresAt: number;
      updateRaidExpiration(): void;
    };
    internalRoom.raidExpiresAt = Date.now() - 1;
    internalRoom.updateRaidExpiration();

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

  it("acknowledges the latest raid move sequence after simulation", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-move-sequence",
      seed: "raid-move-sequence-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await connectToRoom(colyseus, room, {
      name: "Sequence Raider",
      raidRunId: "raid-move-sequence",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    client.send("move", { x: 1, y: 0, sequence: 11 });
    await waitForNextSimulation(room, 120);

    const movedPlayer = room.state.players.get(client.sessionId);
    assert.ok(movedPlayer);
    assert.strictEqual(movedPlayer?.lastProcessedInput, 11);

    client.send("move", { x: 0, y: 0, sequence: 12 });
    await waitForNextSimulation(room, 120);

    const stoppedPlayer = room.state.players.get(client.sessionId);
    assert.ok(stoppedPlayer);
    assert.strictEqual(stoppedPlayer?.lastProcessedInput, 12);
  });

  it("does not let raid profile sync restore server-authoritative health", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-profile-health",
      seed: "raid-profile-health-seed",
      templateCode: "crypt",
      width: 64,
      height: 64,
    });

    const client = await connectToRoom(colyseus, room, {
      name: "Profile Raider",
      raidRunId: "raid-profile-health",
      weaponItem: "wood_staff",
      health: 100,
      maxHealth: 100,
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);
    player!.health = 37;

    client.send("profile", {
      name: "Profile Raider",
      raidRunId: "raid-profile-health",
      weaponItem: "wood_staff",
      health: 100,
      maxHealth: 100,
      level: 99,
      strength: 99,
    });

    await room.waitForNextPatch();

    assert.strictEqual(player!.health, 37);
    assert.strictEqual(player!.maxHealth, 100);
    assert.notStrictEqual(player!.level, 99);
    assert.notStrictEqual(player!.strength, 99);
  });

  it("extracts the player with current loot when using an exit", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-extract-test",
      seed: "extract-seed",
      templateCode: "crypt_standard",
      width: 24,
      height: 24,
    });

    const client = await connectToRoom(colyseus, room, {
      name: "Extract Raider",
      raidRunId: "raid-extract-test",
      weaponItem: "wood_staff",
      weaponGemItem1: "fire_trail_gem",
      inventory: ["healing_potion::2", "wood"],
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
      weapon: "wood_staff",
    });
    assert.deepStrictEqual(payload.inventory, [
      "healing_potion::2",
      "wood",
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

    const client = await connectToRoom(colyseus, room, {
      name: "Tutorial Raider",
      raidRunId: "raid-crypt-small-test",
    });

    await room.waitForNextPatch();

    assert.strictEqual(room.state.templateCode, "crypt_small");
    assert.strictEqual(room.state.width, 32);
    assert.strictEqual(room.state.height, 16);
    assert.deepStrictEqual(Array.from(room.state.exitPoints), ["27:7"]);
    const tileAt = (x: number, y: number) => room.state.tiles[y * room.state.width + x];
    assert.notStrictEqual(tileAt(8, 7), "wall");
    assert.notStrictEqual(tileAt(8, 8), "wall");
    assert.notStrictEqual(tileAt(9, 7), "wall");
    assert.notStrictEqual(tileAt(9, 8), "wall");

    const tutorialChest = room.state.chests.get("raid-chest-0-13-7");
    assert.ok(tutorialChest);
    assert.strictEqual(tutorialChest?.title, "Astral Reliquary");
    assert.strictEqual(tutorialChest?.subtitle, "Training Cache");
    assert.deepStrictEqual(Array.from(tutorialChest?.slots ?? []), [
      "wood_staff",
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
      "",
    ]);

    const tutorialMobs = Array.from(room.state.mobs.values());
    assert.strictEqual(tutorialMobs.length, 1);
    assert.strictEqual(tutorialMobs[0]?.id, "raid-skeleton-tutorial");
    assert.strictEqual(tutorialMobs[0]?.kind, "skeleton");
    assert.strictEqual(tutorialMobs[0]?.name, "Skeleton");

    await client.leave();
  });

  it("spawns a mixed mob roster in the non-tutorial crypt", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-crypt-mixed-mobs",
      seed: "crypt-mixed-mobs-seed",
      templateCode: "crypt",
      width: 128,
      height: 128,
    });

    const mobKinds = new Set(Array.from(room.state.mobs.values(), (mob) => mob.kind));

    assert.ok(room.state.mobs.size > 0);
    assert.ok(mobKinds.has("bat"));
    assert.ok(Array.from(mobKinds).some((kind) => kind !== "bat"));
  });

  it("fills non-tutorial raid chests with loot", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-crypt-loot",
      seed: "crypt-loot-seed",
      templateCode: "crypt",
      width: 128,
      height: 128,
    });

    const lootChests = Array.from(room.state.chests.values()).filter((chest) => chest.title === "Crypt Chest");
    const nonEmptyLootChests = lootChests.filter((chest) => Array.from(chest.slots).some((slot) => slot !== ""));

    assert.ok(lootChests.length > 0);
    assert.strictEqual(nonEmptyLootChests.length, lootChests.length);
  });

  it("wood staff dash damages and knocks back a raid player", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-wood-staff-dash",
      seed: "raid-wood-staff-dash-seed",
      templateCode: "crypt",
      width: 64,
      height: 64,
    });

    const client = await connectToRoom(colyseus, room, {
      name: "Dash Raider",
      raidRunId: "raid-wood-staff-dash",
      weaponItem: "wood_staff",
    });
    const targetClient = await connectToRoom(colyseus, room, {
      name: "Dash Target",
      raidRunId: "raid-wood-staff-dash",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    const target = room.state.players.get(targetClient.sessionId);
    assert.ok(player);
    assert.ok(target);

    const roomBounds = room.state.rooms[0]?.split(":").map((value) => Number.parseInt(value, 10));
    assert.ok(roomBounds);
    const [roomX, roomY, roomWidth, roomHeight] = roomBounds!;
    const centerTileX = roomX + Math.max(2, Math.floor(roomWidth / 3));
    const centerTileY = roomY + Math.floor(roomHeight / 2);
    player!.x = centerTileX * 32 + 16;
    player!.y = centerTileY * 32 + 16;
    target!.x = player!.x + 64;
    target!.y = player!.y;
    target!.health = target!.maxHealth;
    const startingHealth = target!.health;
    const startingTargetX = target!.x;

    client.send("castSkill", {
      skillId: "woodStaffDash",
      targetX: target!.x + 16,
      targetY: target!.y,
    });

    await waitForNextSimulation(room, 900);

    assert.ok(target!.health < startingHealth);
    assert.ok(target!.x > startingTargetX);
  });

  it("keeps the player alive in the crypt_small tutorial", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-crypt-small-safety",
      seed: "crypt-small-safety-seed",
      templateCode: "crypt_small",
    });

    const client = await connectToRoom(colyseus, room, {
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

  it("removes tutorial damage protection after the tutorial mob dies", async () => {
    const room = await colyseus.createRoom<RaidRoomState>("raid", {
      raidRunId: "raid-crypt-small-post-tutorial",
      seed: "crypt-small-post-tutorial-seed",
      templateCode: "crypt_small",
    });

    const client = await connectToRoom(colyseus, room, {
      name: "Vulnerable Raider",
      raidRunId: "raid-crypt-small-post-tutorial",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    const tutorialMob = room.state.mobs.get("raid-skeleton-tutorial");
    assert.ok(tutorialMob);
    tutorialMob!.health = 0;
    tutorialMob!.dead = true;

    player!.health = 3;
    const dealt = (room as unknown as {
      applyDamageToPlayer: (target: { health: number }, amount: number, damageType: "physical" | "fire") => number;
    }).applyDamageToPlayer(player!, 999, "physical");

    assert.strictEqual(dealt, 3);
    assert.strictEqual(player!.health, 0);

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

    const client = await connectToRoom(colyseus, room, {
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

    const client = await connectToRoom(colyseus, room, {
      name: "Nova Raider",
      raidRunId: "raid-fire-nova",
      weaponItem: "wood_staff",
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

    const client = await connectToRoom(colyseus, room, {
      name: "Field Raider",
      raidRunId: "raid-fire-field",
      weaponItem: "wood_staff",
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

