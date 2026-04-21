import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { createAppConfig } from "../src/app.config.js";
import { MyRoomState } from "../src/rooms/schema/MyRoomState.js";
import { MobState } from "../src/rooms/schema/MobState.js";
import { WORLD_GAMEPLAY_PROFILE } from "../src/rooms/runtime/sharedGameplay.js";
import { loadWorldDefinition } from "../src/rooms/worldDefinition.js";
import { connectToRoom } from "./helpers/realtimeJoin.js";
import {
  SKELETON_DASH_SKILL,
  SKELETON_DASH_SKILL_ID,
} from "@mmorpg/shared/mobs/skills";
import { recordMobDamage } from "../src/rooms/runtime/trainingDummyRuntime.js";

const RAT_ID = "rat-scout";
const BAT_ID = "bat-stalker";
const DUMMY_ID = "training-dummy-near-spawn";

async function waitForNextSimulation(room: { waitForNextPatch: () => Promise<unknown> }, ms = 280) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await room.waitForNextPatch();
}

async function spawnStaticWorldMobsForTest(room: {
  waitForNextPatch: () => Promise<unknown>;
  state: MyRoomState;
}) {
  room.state.mobs.set(RAT_ID, createTestRat(RAT_ID, 20 * 32 + 16, 14 * 32 + 16));
  room.state.mobs.set(BAT_ID, createTestBat(BAT_ID, 22 * 32 + 16, 14 * 32 + 16));
  await room.waitForNextPatch();
}

function createTestRat(id: string, x: number, y: number) {
  const rat = new MobState();
  rat.id = id;
  rat.kind = "rat";
  rat.texture = "rat";
  rat.name = "Rat";
  rat.x = x;
  rat.y = y;
  rat.targetX = x;
  rat.targetY = y;
  rat.spawnX = x;
  rat.spawnY = y;
  rat.patrolMinX = x - 32;
  rat.patrolMaxX = x + 32;
  rat.patrolY = y;
  rat.moveSpeed = 64;
  rat.aggroRange = 999;
  rat.leashRange = 224;
  rat.attackRange = 24;
  rat.attackDamage = 6;
  rat.attackCooldownMs = 900;
  rat.health = 38;
  rat.maxHealth = 38;
  rat.experienceReward = 18;
  return rat;
}

function createTestBat(id: string, x: number, y: number) {
  const bat = new MobState();
  bat.id = id;
  bat.kind = "bat";
  bat.texture = "bat";
  bat.name = "Bat";
  bat.x = x;
  bat.y = y;
  bat.targetX = x;
  bat.targetY = y;
  bat.spawnX = x;
  bat.spawnY = y;
  bat.patrolMinX = x - 32;
  bat.patrolMaxX = x + 32;
  bat.patrolY = y;
  bat.patrolRadiusY = 24;
  bat.moveSpeed = 72;
  bat.aggroRange = 999;
  bat.leashRange = 224;
  bat.attackRange = 24;
  bat.attackDamage = 7;
  bat.attackCooldownMs = 800;
  bat.health = 34;
  bat.maxHealth = 34;
  bat.experienceReward = 22;
  return bat;
}

function createTestSkeleton(id: string, x: number, y: number) {
  const skeleton = new MobState();
  skeleton.id = id;
  skeleton.kind = "skeleton";
  skeleton.texture = "skeleton";
  skeleton.name = "Skeleton";
  skeleton.x = x;
  skeleton.y = y;
  skeleton.targetX = x;
  skeleton.targetY = y;
  skeleton.spawnX = x;
  skeleton.spawnY = y;
  skeleton.moveSpeed = 58;
  skeleton.aggroRange = 999;
  skeleton.leashRange = 240;
  skeleton.attackRange = 28;
  skeleton.attackDamage = 0;
  skeleton.attackCooldownMs = 1100;
  skeleton.health = 52;
  skeleton.maxHealth = 52;
  skeleton.experienceReward = 36;
  return skeleton;
}

function createTestDummy(id: string, x: number, y: number) {
  const dummy = new MobState();
  dummy.id = id;
  dummy.kind = "dummy";
  dummy.texture = "dummy";
  dummy.name = "Training Dummy";
  dummy.x = x;
  dummy.y = y;
  dummy.targetX = x;
  dummy.targetY = y;
  dummy.spawnX = x;
  dummy.spawnY = y;
  dummy.patrolMinX = x;
  dummy.patrolMaxX = x;
  dummy.patrolY = y;
  dummy.moveSpeed = 0;
  dummy.aggroRange = 0;
  dummy.leashRange = 0;
  dummy.attackRange = 0;
  dummy.attackDamage = 0;
  dummy.attackCooldownMs = 0;
  dummy.health = 500;
  dummy.maxHealth = 500;
  dummy.experienceReward = 0;
  return dummy;
}

describe("world room", () => {
  let colyseus: ColyseusTestServer<ReturnType<typeof createAppConfig>>;

  before(async () => (colyseus = await boot(createAppConfig())));
  after(async () => {
    await colyseus.cleanup();
    await colyseus.shutdown();
  });
  beforeEach(async () => await colyseus.cleanup());

  it("puts multiple players into one shared world and syncs movement", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});

    const client1 = await connectToRoom(colyseus, room, {
      name: "Mage One",
    });
    await connectToRoom(colyseus, room, {
      name: "Mage Two",
    });

    await room.waitForNextPatch();

    assert.strictEqual(room.clients.length, 2);
    assert.strictEqual(room.state.players.size, 2);

    const localPlayer = room.state.players.get(client1.sessionId);
    assert.ok(localPlayer);
    assert.strictEqual(localPlayer?.name, "Mage One");

    const startX = localPlayer?.x ?? 0;
    client1.send("move", { x: 1, y: 0 });

    await room.waitForNextPatch();
    await waitForNextSimulation(room, 120);

    const movedPlayer = room.state.players.get(client1.sessionId);
    assert.ok(movedPlayer);
    assert.ok((movedPlayer?.x ?? 0) > startX);
  });

  it("spawns world players at the server spawn regardless of join position", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const worldDefinition = loadWorldDefinition("lobby");
    const tileSize = WORLD_GAMEPLAY_PROFILE.tileSize;
    const expectedSpawn = {
      x: worldDefinition.spawn.x * tileSize + tileSize / 2,
      y: worldDefinition.spawn.y * tileSize + tileSize / 2,
    };

    const client = await connectToRoom(colyseus, room, {
      name: "Spawn Tester",
      position: { x: expectedSpawn.x + 400, y: expectedSpawn.y + 400 },
      worldSpawn: { x: expectedSpawn.x + 800, y: expectedSpawn.y + 800 },
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);
    assert.strictEqual(player?.x, expectedSpawn.x);
    assert.strictEqual(player?.y, expectedSpawn.y);
  });

  it("acknowledges the latest world move sequence after simulation", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Sequence Mage",
    });

    await room.waitForNextPatch();

    client.send("move", { x: 1, y: 0, sequence: 7 });
    await waitForNextSimulation(room, 120);

    const movedPlayer = room.state.players.get(client.sessionId);
    assert.ok(movedPlayer);
    assert.strictEqual(movedPlayer?.lastProcessedInput, 7);

    client.send("move", { x: 0, y: 0, sequence: 8 });
    await waitForNextSimulation(room, 120);

    const stoppedPlayer = room.state.players.get(client.sessionId);
    assert.ok(stoppedPlayer);
    assert.strictEqual(stoppedPlayer?.lastProcessedInput, 8);
  });

  it("loads the world lobby with the training dummy near spawn", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", { worldOwner: "tester" });
    await connectToRoom(colyseus, room, {
      worldOwner: "tester",
      name: "Aggro Target",
    });

    await room.waitForNextPatch();

    const dummy = room.state.mobs.get(DUMMY_ID);
    assert.ok(dummy);
    assert.strictEqual(dummy?.kind, "dummy");
    assert.strictEqual(room.state.mobs.size, 3);
  });

  it("resets the training dummy 3 seconds after the last hit", async () => {
    const testDummyId = "test-training-dummy";
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    await connectToRoom(colyseus, room, {
      name: "Dummy Tester",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    const dummy = createTestDummy(testDummyId, 20 * 32 + 16, 14 * 32 + 16);
    room.state.mobs.set(testDummyId, dummy);
    await room.waitForNextPatch();

    const serverDummy = room.state.mobs.get(testDummyId);
    assert.ok(serverDummy);
    serverDummy!.health = Math.max(0, serverDummy!.health - 40);
    recordMobDamage(serverDummy!, 40);
    await room.waitForNextPatch();

    const damagedDummy = room.state.mobs.get(testDummyId);
    assert.ok(damagedDummy);
    assert.ok((damagedDummy?.health ?? 0) < (damagedDummy?.maxHealth ?? 0));
    assert.ok((damagedDummy?.lastDamagedAt ?? 0) > 0);

    damagedDummy!.x += 24;
    damagedDummy!.y += 12;

    await waitForNextSimulation(room, 3200);

    const resetDummy = room.state.mobs.get(testDummyId);
    assert.ok(resetDummy);
    assert.strictEqual(resetDummy?.x, resetDummy?.spawnX);
    assert.strictEqual(resetDummy?.y, resetDummy?.spawnY);
    assert.strictEqual(resetDummy?.health, resetDummy?.maxHealth);
    assert.strictEqual(resetDummy?.totalDamageTaken, 0);
    assert.strictEqual(resetDummy?.totalHitsTaken, 0);
    assert.strictEqual(resetDummy?.lastDamagedAt, 0);
  });

  it("spawns a rat mob with balance-driven health and patrol movement", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Watcher",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const clientState = client.state as MyRoomState;
    const rat = clientState.mobs.get(RAT_ID);
    assert.ok(rat);
    assert.strictEqual(rat?.name, "Rat");
    assert.strictEqual(rat?.health, 38);
    assert.strictEqual(rat?.maxHealth, 38);

    const startX = rat?.x ?? 0;
    await waitForNextSimulation(room, 220);

    const movedRat = clientState.mobs.get(RAT_ID);
    assert.ok(movedRat);
    assert.notStrictEqual(movedRat?.x, startX);
  });

  it("makes the rat chase and attack a nearby player", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Target Dummy",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(client.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);

    if (!serverPlayer || !serverRat) {
      assert.fail("Expected player and rat to exist");
    }

    serverPlayer.x = serverRat.x + 40;
    serverPlayer.y = serverRat.y;

    const startingHealth = serverPlayer.health;
    const startingRatX = serverRat.x;

    await waitForNextSimulation(room, 1200);

    const clientState = client.state as MyRoomState;
    const updatedPlayer = clientState.players.get(client.sessionId);
    const updatedRat = clientState.mobs.get(RAT_ID);

    assert.ok(updatedPlayer);
    assert.ok(updatedRat);
    assert.strictEqual(updatedRat?.aggroTargetId, client.sessionId);
    assert.ok((updatedRat?.x ?? startingRatX) > startingRatX);
    assert.ok((updatedPlayer?.health ?? startingHealth) < startingHealth);
  });

  it("starts a skeleton dash skill cast with a visible cast window and a 2s cooldown", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Dash Target",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    const skeleton = createTestSkeleton("test-skeleton-cast", 300, 300);
    room.state.mobs.set(skeleton.id, skeleton);
    player.x = skeleton.x + 96;
    player.y = skeleton.y;
    const startingHealth = player.health;

    await waitForNextSimulation(room, 720);

    assert.strictEqual(skeleton.castingSkillId, SKELETON_DASH_SKILL_ID);
    assert.strictEqual(skeleton.castEndsAt - skeleton.castStartedAt, SKELETON_DASH_SKILL.castMs);
    assert.strictEqual(
      skeleton.attackCooldownEndsAt - skeleton.castStartedAt,
      SKELETON_DASH_SKILL.cooldownMs,
    );
    assert.strictEqual(player.health, startingHealth);
    assert.strictEqual(skeleton.skillLungeStartedAt, 0);
  });

  it("keeps skeletons from using generic melee while dash is on cooldown", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Melee Immune Target",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    const skeleton = createTestSkeleton("test-skeleton-cooldown", 360, 300);
    skeleton.attackCooldownEndsAt = Date.now() + 2000;
    room.state.mobs.set(skeleton.id, skeleton);
    player.x = skeleton.x + 8;
    player.y = skeleton.y;
    const startingHealth = player.health;

    await waitForNextSimulation(room, 520);

    assert.strictEqual(skeleton.castingSkillId, "");
    assert.strictEqual(player.health, startingHealth);
  });

  it("stops a skeleton dash skill lunge at the collision edge and deals 35 damage once", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Collision Target",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    const skeleton = createTestSkeleton("test-skeleton-lunge", 300, 300);
    room.state.mobs.set(skeleton.id, skeleton);
    player.x = skeleton.x + 96;
    player.y = skeleton.y;
    const startingHealth = player.health;

    await waitForNextSimulation(room, 1450);

    assert.strictEqual(skeleton.castingSkillId, "");
    assert.strictEqual(startingHealth - player.health, SKELETON_DASH_SKILL.damage);
    assert.ok(skeleton.x < player.x);
    assert.ok(Math.hypot(player.x - skeleton.x, player.y - skeleton.y) >= 20);

    const healthAfterDash = player.health;
    await waitForNextSimulation(room, 280);
    assert.strictEqual(player.health, healthAfterDash);
  });

  it("rejects fireball casts without the required weapon", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Unarmed Mage",
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
    assert.strictEqual(player.castingSkillId, "");
  });

  it("aggros the rat when a player hits it", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Mage Hunter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(attacker.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);

    if (!serverPlayer || !serverRat) {
      assert.fail("Expected player and rat to exist");
    }

    serverPlayer.x = serverRat.x + 220;
    serverPlayer.y = serverRat.y;
    serverRat.aggroTargetId = "";

    attacker.send("castSkill", {
      skillId: "fireball",
      targetX: serverRat.x,
      targetY: serverRat.y,
    });

    await waitForNextSimulation(room, 400);

    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedRat);
    assert.strictEqual(updatedRat?.aggroTargetId, attacker.sessionId);
  });

  it("lets wood_staff hit a nearby mob with a wood staff strike", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Stick Fighter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(attacker.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);

    if (!serverPlayer || !serverRat) {
      assert.fail("Expected player and rat to exist");
    }

    serverPlayer.x = serverRat.x - 24;
    serverPlayer.y = serverRat.y;
    const initialHealth = serverRat.health;
    const initialRatX = serverRat.x;
    const initialRatY = serverRat.y;

    attacker.send("castSkill", {
      skillId: "woodStaffStrike",
      targetX: serverRat.x,
      targetY: serverRat.y,
    });

    await waitForNextSimulation(room, 720);

    const updatedPlayer = room.state.players.get(attacker.sessionId);
    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedPlayer);
    assert.ok(updatedRat);
    assert.strictEqual(room.state.projectiles.size, 0);
    assert.ok((updatedPlayer?.woodStaffStrikeCooldownEndsAt ?? 0) > Date.now());
    const remainingHealth = updatedRat?.health ?? initialHealth;
    assert.ok(remainingHealth < initialHealth);
    assert.strictEqual(initialHealth - remainingHealth, 5);
    assert.strictEqual(updatedRat?.x, initialRatX);
    assert.strictEqual(updatedRat?.y, initialRatY);
    assert.strictEqual(updatedRat?.aggroTargetId, attacker.sessionId);
  });

  it("casts wood staff slam on nearby mobs when unlocked", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Slam Fighter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    attacker.send("profile", {
      equipmentItemProgression: {
        weapon: {
          level: 5,
          selectedUpgradeIds: [
            "wood_staff_range_2",
            "wood_staff_cooldown_3",
            "wood_staff_knockback_4",
            "wood_staff_nova_5",
          ],
        },
      },
    });
    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(attacker.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);

    if (!serverPlayer || !serverRat) {
      assert.fail("Expected player and target mob to exist");
    }

    serverPlayer.x = serverRat.x - 24;
    serverPlayer.y = serverRat.y;
    const initialHealth = serverRat.health;

    attacker.send("castSkill", {
      skillId: "woodStaffSlam",
    });

    await waitForNextSimulation(room, 720);

    const updatedPlayer = room.state.players.get(attacker.sessionId);
    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedPlayer);
    assert.ok(updatedRat);
    assert.ok((updatedPlayer?.woodStaffSlamCooldownEndsAt ?? 0) > Date.now());
    assert.ok((updatedRat?.health ?? initialHealth) < initialHealth);
  });

  it("casts chain strike on multiple nearby mobs when unlocked", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Chain Fighter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    attacker.send("profile", {
      equipmentItemProgression: {
        weapon: {
          level: 10,
          selectedUpgradeIds: [
            "wood_staff_range_2",
            "wood_staff_cooldown_3",
            "wood_staff_knockback_4",
            "wood_staff_dash_5",
            "wood_staff_rapid_6",
            "wood_staff_mastery_7",
            "wood_staff_echo_8",
            "wood_staff_ruin_9",
            "wood_staff_chain_10",
          ],
        },
      },
    });
    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(attacker.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    const serverBat = room.state.mobs.get(BAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);
    assert.ok(serverBat);

    if (!serverPlayer || !serverRat || !serverBat) {
      assert.fail("Expected player and chain targets to exist");
    }

    serverPlayer.x = serverRat.x - 20;
    serverPlayer.y = serverRat.y;
    const initialPlayerX = serverPlayer.x;
    const initialPlayerY = serverPlayer.y;
    const initialRatHealth = serverRat.health;
    const initialBatHealth = serverBat.health;

    attacker.send("castSkill", {
      skillId: "woodStaffChainStrike",
      targetX: serverRat.x,
      targetY: serverRat.y,
    });

    await waitForNextSimulation(room, 720);

    const updatedPlayer = room.state.players.get(attacker.sessionId);
    const updatedRat = room.state.mobs.get(RAT_ID);
    const updatedBat = room.state.mobs.get(BAT_ID);
    assert.ok(updatedPlayer);
    assert.ok(updatedRat);
    assert.ok(updatedBat);
    assert.ok((updatedPlayer?.woodStaffStrikeCooldownEndsAt ?? 0) > 0);
    assert.ok((updatedRat?.health ?? initialRatHealth) < initialRatHealth);
    assert.ok((updatedBat?.health ?? initialBatHealth) < initialBatHealth);
    assert.ok(Math.hypot((updatedPlayer?.x ?? initialPlayerX) - initialPlayerX, (updatedPlayer?.y ?? initialPlayerY) - initialPlayerY) > 8);
  });

  it("repeats chain strike on the same target when no nearby targets exist", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Solo Chain Fighter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    attacker.send("profile", {
      equipmentItemProgression: {
        weapon: {
          level: 10,
          selectedUpgradeIds: [
            "wood_staff_range_2",
            "wood_staff_cooldown_3",
            "wood_staff_knockback_4",
            "wood_staff_dash_5",
            "wood_staff_rapid_6",
            "wood_staff_mastery_7",
            "wood_staff_echo_8",
            "wood_staff_ruin_9",
            "wood_staff_chain_10",
          ],
        },
      },
    });
    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(attacker.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    const serverBat = room.state.mobs.get(BAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);
    assert.ok(serverBat);

    if (!serverPlayer || !serverRat || !serverBat) {
      assert.fail("Expected player and chain targets to exist");
    }

    serverPlayer.x = serverRat.x - 20;
    serverPlayer.y = serverRat.y;
    serverBat.x = serverRat.x + 512;
    serverBat.y = serverRat.y + 512;
    serverBat.targetX = serverBat.x;
    serverBat.targetY = serverBat.y;
    const initialRatHealth = serverRat.health;

    attacker.send("castSkill", {
      skillId: "woodStaffChainStrike",
      targetX: serverRat.x,
      targetY: serverRat.y,
    });

    await waitForNextSimulation(room, 720);

    const updatedRat = room.state.mobs.get(RAT_ID);
    const updatedBat = room.state.mobs.get(BAT_ID);
    assert.ok(updatedRat);
    assert.ok(updatedBat);
    assert.ok((updatedRat?.health ?? initialRatHealth) <= initialRatHealth - 2);
    assert.strictEqual(updatedBat?.health, serverBat.maxHealth);
  });

  it("applies chain strike branch upgrades for range, search radius, and extra bounce", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Extended Chain Fighter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    attacker.send("profile", {
      equipmentItemProgression: {
        weapon: {
          level: 13,
          selectedUpgradeIds: [
            "wood_staff_range_2",
            "wood_staff_chain_10",
            "wood_staff_chain_jump_11",
            "wood_staff_chain_reach_12",
            "wood_staff_chain_seek_13",
          ],
        },
      },
    });
    await room.waitForNextPatch();

    const serverPlayer = room.state.players.get(attacker.sessionId);
    assert.ok(serverPlayer);
    if (!serverPlayer) {
      assert.fail("Expected player to exist");
    }

    const baseX = 20 * 32 + 16;
    const baseY = 14 * 32 + 16;
    const rat = createTestRat(`${RAT_ID}-extended`, baseX, baseY);
    const bat = createTestBat(`${BAT_ID}-extended`, baseX + 125, baseY);
    const skeleton = createTestSkeleton("chain-skeleton-extended", baseX + 250, baseY);
    const dummy = createTestDummy("chain-dummy-extended", baseX + 375, baseY);
    for (const mob of [rat, bat, skeleton, dummy]) {
      mob.moveSpeed = 0;
      mob.aggroRange = 0;
    }
    room.state.mobs.clear();
    room.state.mobs.set(rat.id, rat);
    room.state.mobs.set(bat.id, bat);
    room.state.mobs.set(skeleton.id, skeleton);
    room.state.mobs.set(dummy.id, dummy);
    await room.waitForNextPatch();

    serverPlayer.x = rat.x - 65;
    serverPlayer.y = rat.y;

    const initialHealthById = new Map(
      [rat, bat, skeleton, dummy].map((mob) => [mob.id, mob.health]),
    );

    attacker.send("castSkill", {
      skillId: "woodStaffChainStrike",
      targetX: rat.x,
      targetY: rat.y,
    });

    await waitForNextSimulation(room, 1250);

    for (const mobId of initialHealthById.keys()) {
      const updatedMob = room.state.mobs.get(mobId);
      assert.ok(updatedMob);
      assert.ok((updatedMob?.health ?? 0) < (initialHealthById.get(mobId) ?? 0), `${mobId} should be hit by extended chain strike`);
    }
  });

  it("can refund chain strike bounces after chained hits deal damage", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Refund Chain Fighter",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    attacker.send("profile", {
      equipmentItemProgression: {
        weapon: {
          level: 14,
          selectedUpgradeIds: [
            "wood_staff_chain_10",
            "wood_staff_chain_refund_14",
          ],
        },
      },
    });
    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverPlayer = room.state.players.get(attacker.sessionId);
    const serverRat = room.state.mobs.get(RAT_ID);
    const serverBat = room.state.mobs.get(BAT_ID);
    assert.ok(serverPlayer);
    assert.ok(serverRat);
    assert.ok(serverBat);

    if (!serverPlayer || !serverRat || !serverBat) {
      assert.fail("Expected player and chain targets to exist");
    }

    serverPlayer.x = serverRat.x - 20;
    serverPlayer.y = serverRat.y;
    serverBat.x = serverRat.x + 512;
    serverBat.y = serverRat.y + 512;
    serverBat.targetX = serverBat.x;
    serverBat.targetY = serverBat.y;
    const initialRatHealth = serverRat.health;
    const originalRandom = Math.random;
    Math.random = () => 0.1;
    try {
      attacker.send("castSkill", {
        skillId: "woodStaffChainStrike",
        targetX: serverRat.x,
        targetY: serverRat.y,
      });

      await waitForNextSimulation(room, 1850);
    } finally {
      Math.random = originalRandom;
    }

    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedRat);
    assert.ok((updatedRat?.health ?? initialRatHealth) <= initialRatHealth - 4);
  });

  it("rewinds recent player positions for lag-compensated wood staff strikes", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const attacker = await connectToRoom(colyseus, room, {
      name: "Lag Fighter",
      weaponItem: "wood_staff",
    });
    const target = await connectToRoom(colyseus, room, {
      name: "Lag Target",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    const attackerPlayer = room.state.players.get(attacker.sessionId);
    const targetPlayer = room.state.players.get(target.sessionId);
    assert.ok(attackerPlayer);
    assert.ok(targetPlayer);

    if (!attackerPlayer || !targetPlayer) {
      assert.fail("Expected attacker and target to exist");
    }

    attackerPlayer.x = 300;
    attackerPlayer.y = 300;
    targetPlayer.x = attackerPlayer.x + 38;
    targetPlayer.y = attackerPlayer.y;
    const rewindTargetX = targetPlayer.x;
    const rewindTargetY = targetPlayer.y;
    const initialHealth = targetPlayer.health;

    await waitForNextSimulation(room, 80);
    const estimatedLatencyMs = 80;
    targetPlayer.x = attackerPlayer.x + 140;
    targetPlayer.y = attackerPlayer.y;

    attacker.send("castSkill", {
      skillId: "woodStaffStrike",
      targetX: rewindTargetX,
      targetY: rewindTargetY,
      clientEstimatedLatencyMs: estimatedLatencyMs,
    });

    await waitForNextSimulation(room, 180);

    const updatedTarget = room.state.players.get(target.sessionId);
    assert.ok(updatedTarget);
    assert.ok((updatedTarget?.health ?? initialHealth) < initialHealth);
  });

  it("aims the fireball through the cursor point from its actual spawn position", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Mage Aim",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    const serverPlayer = room.state.players.get(caster.sessionId);
    assert.ok(serverPlayer);

    if (!serverPlayer) {
      assert.fail("Expected player to exist");
    }

    const targetX = serverPlayer.x + 120;
    const targetY = serverPlayer.y + 60;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX,
      targetY,
    });

    await waitForNextSimulation(room, 320);

    const projectile = [...room.state.projectiles.values()][0];
    assert.ok(projectile);

    if (!projectile) {
      assert.fail("Expected projectile to exist");
    }

    const toTargetX = targetX - projectile.x;
    const toTargetY = targetY - projectile.y;
    const length = Math.hypot(toTargetX, toTargetY);

    assert.ok(Math.abs(projectile.directionX - toTargetX / length) < 0.0001);
    assert.ok(Math.abs(projectile.directionY - toTargetY / length) < 0.0001);
  });

  it("clamps targeted staff casts to the maximum cast range", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const fireballCaster = await connectToRoom(colyseus, room, {
      name: "Range Mage",
      weaponItem: "wood_staff",
    });
    const fireFieldCaster = await connectToRoom(colyseus, room, {
      name: "Field Ranger",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    const fireballPlayer = room.state.players.get(fireballCaster.sessionId);
    const fireFieldPlayer = room.state.players.get(fireFieldCaster.sessionId);
    assert.ok(fireballPlayer);
    assert.ok(fireFieldPlayer);

    if (!fireballPlayer || !fireFieldPlayer) {
      assert.fail("Expected casters to exist");
    }

    // Move the second player away so the fireball doesn't collide immediately.
    fireFieldPlayer.x = fireballPlayer.x - 200;
    fireFieldPlayer.y = fireballPlayer.y + 200;

    const requestedTargetX = fireballPlayer.x + 1000;
    const requestedTargetY = fireballPlayer.y;

    fireballCaster.send("castSkill", {
      skillId: "fireball",
      targetX: requestedTargetX,
      targetY: requestedTargetY,
    });

    await waitForNextSimulation(room, 320);

    fireFieldCaster.send("castSkill", {
      skillId: "fireField",
      targetX: requestedTargetX,
      targetY: requestedTargetY,
    });

    await waitForNextSimulation(room, 320);

    const projectile = [...room.state.projectiles.values()][0];
    const fieldCenters = [...room.state.groundEffects.values()].map((effect) => effect.x);

    assert.ok(projectile);
    assert.ok(fieldCenters.length > 0);
    assert.ok((projectile?.x ?? fireballPlayer.x) < requestedTargetX);
    assert.ok(Math.max(...fieldCenters) < requestedTargetX);
    assert.ok(Math.max(...fieldCenters) <= fireFieldPlayer.x + 32 * 8);
  });

  it("applies burn damage over time to a player hit by fireball", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Burn Mage",
      weaponItem: "wood_staff",
    });
    const target = await connectToRoom(colyseus, room, {
      name: "Burn Target",
    });

    await room.waitForNextPatch();

    const serverCaster = room.state.players.get(caster.sessionId);
    const serverTarget = room.state.players.get(target.sessionId);
    assert.ok(serverCaster);
    assert.ok(serverTarget);

    if (!serverCaster || !serverTarget) {
      assert.fail("Expected both players to exist");
    }

    serverCaster.x = 400;
    serverCaster.y = 300;
    serverTarget.x = 470;
    serverTarget.y = 300;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: serverTarget.x,
      targetY: serverTarget.y,
    });

    await waitForNextSimulation(room, 1300);

    const updatedTarget = room.state.players.get(target.sessionId);
    assert.ok(updatedTarget);
    assert.ok((updatedTarget?.health ?? 100) < 100);
    assert.ok((updatedTarget?.burnTicksRemaining ?? 0) > 0);
  });

  it("applies burn damage over time to a mob hit by fireball", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Burn Mage",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverCaster = room.state.players.get(caster.sessionId);
    const rat = room.state.mobs.get(RAT_ID);
    assert.ok(serverCaster);
    assert.ok(rat);

    if (!serverCaster || !rat) {
      assert.fail("Expected caster and rat to exist");
    }

    const startingHealth = rat.health;
    serverCaster.x = rat.x - 70;
    serverCaster.y = rat.y;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: rat.x,
      targetY: rat.y,
    });

    await waitForNextSimulation(room, 1300);

    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedRat);
    assert.ok((updatedRat?.health ?? startingHealth) < startingHealth);
    assert.ok((updatedRat?.burnTicksRemaining ?? 0) > 0);
  });

  it("casts fire nova as 12 projectiles and starts a cooldown", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Nova Mage",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    caster.send("castSkill", {
      skillId: "fireNova",
    });

    await waitForNextSimulation(room, 320);

    const player = room.state.players.get(caster.sessionId);
    assert.ok(player);
    assert.ok(room.state.projectiles.size >= 11);
    assert.ok((player?.fireNovaCooldownEndsAt ?? 0) > Date.now() + 9000);
  });

  it("awards experience for killing a rat", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "XP Mage",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const player = room.state.players.get(caster.sessionId);
    const rat = room.state.mobs.get(RAT_ID);
    assert.ok(player);
    assert.ok(rat);

    if (!player || !rat) {
      assert.fail("Expected player and rat to exist");
    }

    player.x = rat.x - 70;
    player.y = rat.y;
    rat.health = 1;
    const reward = rat.experienceReward;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: rat.x,
      targetY: rat.y,
    });

    await waitForNextSimulation(room, 400);

    const updatedPlayer = room.state.players.get(caster.sessionId);
    assert.ok(updatedPlayer);
    assert.strictEqual(updatedPlayer?.level, 1);
    assert.strictEqual(updatedPlayer?.experience, reward);
  });

  it("resets player progression on death", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Fragile Mage",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const player = room.state.players.get(client.sessionId);
    const rat = room.state.mobs.get(RAT_ID);
    assert.ok(player);
    assert.ok(rat);

    if (!player || !rat) {
      assert.fail("Expected player and rat to exist");
    }

    player.level = 3;
    player.experience = 55;
    player.maxHealth = 130;
    player.health = 1;
    player.x = rat.x + 10;
    player.y = rat.y;

    await waitForNextSimulation(room, 1200);

    const updatedPlayer = room.state.players.get(client.sessionId);
    assert.ok(updatedPlayer);
    assert.strictEqual(updatedPlayer?.dead, true);
    assert.strictEqual(updatedPlayer?.level, 1);
    assert.strictEqual(updatedPlayer?.experience, 0);
    assert.strictEqual(updatedPlayer?.maxHealth, 100);
  });

  it("keeps a disconnected player in the world for reconnect and preserves position", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Reconnect Mage",
      position: { x: 222, y: 333 },
    });

    await room.waitForNextPatch();

    const originalPlayer = room.state.players.get(client.sessionId);
    assert.ok(originalPlayer);

    if (!originalPlayer) {
      assert.fail("Expected original player to exist");
    }

    originalPlayer.x = 444;
    originalPlayer.y = 555;

    await client.leave();
    await room.waitForNextPatch();

    const offlinePlayer = room.state.players.get(client.sessionId);
    assert.ok(offlinePlayer);
    assert.strictEqual(offlinePlayer?.isOnline, false);
    assert.ok((offlinePlayer?.offlineExpiresAt ?? 0) > Date.now());

    const reconnectedClient = await connectToRoom(colyseus, room, {
      name: "Reconnect Mage",
      position: { x: 10, y: 10 },
    });

    await room.waitForNextPatch();

    const restoredPlayer = room.state.players.get(reconnectedClient.sessionId);
    assert.ok(restoredPlayer);
    assert.strictEqual(room.state.players.size, 1);
    assert.strictEqual(restoredPlayer?.isOnline, true);
    assert.strictEqual(restoredPlayer?.x, 444);
    assert.strictEqual(restoredPlayer?.y, 555);
  });

  it("preserves burn state across reconnect", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Reconnect Burner",
      weaponItem: "wood_staff",
    });
    const target = await connectToRoom(colyseus, room, {
      name: "Burn Survivor",
    });

    await room.waitForNextPatch();

    const serverCaster = room.state.players.get(caster.sessionId);
    const serverTarget = room.state.players.get(target.sessionId);
    assert.ok(serverCaster);
    assert.ok(serverTarget);

    if (!serverCaster || !serverTarget) {
      assert.fail("Expected both players to exist");
    }

    serverCaster.x = 400;
    serverCaster.y = 300;
    serverTarget.x = 470;
    serverTarget.y = 300;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: serverTarget.x,
      targetY: serverTarget.y,
    });

    await waitForNextSimulation(room, 420);

    const burningPlayer = room.state.players.get(target.sessionId);
    assert.ok((burningPlayer?.burnTicksRemaining ?? 0) > 0);
    const healthBeforeReconnect = burningPlayer?.health ?? 100;

    await target.leave();
    await room.waitForNextPatch();

    const reconnectedTarget = await connectToRoom(colyseus, room, {
      name: "Burn Survivor",
    });

    await room.waitForNextPatch();

    const restoredPlayer = room.state.players.get(reconnectedTarget.sessionId);
    assert.ok(restoredPlayer);
    assert.ok((restoredPlayer?.burnTicksRemaining ?? 0) > 0);

    await waitForNextSimulation(room, 1100);

    const updatedRestoredPlayer = room.state.players.get(reconnectedTarget.sessionId);
    assert.ok(updatedRestoredPlayer);
    assert.ok((updatedRestoredPlayer?.health ?? healthBeforeReconnect) < healthBeforeReconnect);
  });

  it("preserves healing state across reconnect", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Healing Survivor",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    player.health = 50;
    (
      room as unknown as {
        statusEffects: {
          startHealing: (
            playerId: string,
            totalTicks: number,
            tickMs: number,
            durationMs: number,
            target: typeof player,
            now?: number,
          ) => void;
        };
      }
    ).statusEffects.startHealing(client.sessionId, 4, 1000, 4000, player, Date.now());

    await waitForNextSimulation(room, 220);

    const healingPlayer = room.state.players.get(client.sessionId);
    assert.ok((healingPlayer?.healingTicksRemaining ?? 0) > 0);

    await client.leave();
    await room.waitForNextPatch();

    const reconnectedClient = await connectToRoom(colyseus, room, {
      name: "Healing Survivor",
    });

    await room.waitForNextPatch();

    const restoredPlayer = room.state.players.get(reconnectedClient.sessionId);
    assert.ok(restoredPlayer);
    assert.ok((restoredPlayer?.healingTicksRemaining ?? 0) > 0);

    await waitForNextSimulation(room, 1100);

    const updatedRestoredPlayer = room.state.players.get(reconnectedClient.sessionId);
    assert.ok(updatedRestoredPlayer);
    assert.ok((updatedRestoredPlayer?.health ?? 50) > 50);
  });

  it("broadcasts green floating text when a player receives healing", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Healing Popup",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(client.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected player to exist");
    }

    player.health = 50;

    const healingTextPromise = new Promise<{ text?: string; color?: string }>((resolve) => {
      client.onMessage("damageText", (payload) => {
        if (typeof payload?.text === "string" && payload.text.startsWith("+")) {
          resolve(payload as { text?: string; color?: string });
        }
      });
    });

    (
      room as unknown as {
        statusEffects: {
          startHealing: (
            playerId: string,
            totalTicks: number,
            tickMs: number,
            durationMs: number,
            target: typeof player,
            now?: number,
          ) => void;
        };
      }
    ).statusEffects.startHealing(client.sessionId, 1, 50, 50, player, Date.now());

    const payload = await healingTextPromise;
    assert.strictEqual(payload.text, "+2");
    assert.strictEqual(payload.color, "#6dff8f");
  });

  it("broadcasts a thrown healing potion event to all room clients", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const thrower = await connectToRoom(colyseus, room, {
      name: "Thrower",
      inventory: ["healing_potion::1"],
    });
    const ally = await connectToRoom(colyseus, room, {
      name: "Potion Ally",
    });

    await room.waitForNextPatch();

    const throwerPlayer = room.state.players.get(thrower.sessionId);
    const allyPlayer = room.state.players.get(ally.sessionId);
    assert.ok(throwerPlayer);
    assert.ok(allyPlayer);

    if (!throwerPlayer || !allyPlayer) {
      assert.fail("Expected both players to exist");
    }

    throwerPlayer.x = 320;
    throwerPlayer.y = 320;
    allyPlayer.x = 384;
    allyPlayer.y = 320;
    allyPlayer.health = 60;

    const targetX = 384;
    const targetY = 320;
    const waitForThrownMessage = (client: typeof thrower) =>
      Promise.race([
        new Promise<Record<string, unknown>>((resolve) => {
          client.onMessage("thrownConsumable", (payload) => resolve(payload as Record<string, unknown>));
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("thrownConsumable not received")), 1200),
        ),
      ]);

    const selfPayloadPromise = waitForThrownMessage(thrower);
    const allyPayloadPromise = waitForThrownMessage(ally);

    thrower.send("useConsumable", {
      source: "inventory",
      slotIndex: 0,
      mode: "throw",
      targetX,
      targetY,
    });

    const [selfPayload, allyPayload] = await Promise.all([selfPayloadPromise, allyPayloadPromise]);
    await room.waitForNextPatch();

    assert.deepStrictEqual(allyPayload, selfPayload);
    assert.strictEqual(selfPayload.itemId, "healing_potion");
    assert.strictEqual(selfPayload.sourcePlayerId, thrower.sessionId);
    assert.strictEqual(selfPayload.targetX, targetX);
    assert.strictEqual(selfPayload.targetY, targetY);
    assert.ok(typeof selfPayload.startX === "number");
    assert.ok(typeof selfPayload.startY === "number");
    assert.ok(typeof selfPayload.durationMs === "number");
    assert.ok((selfPayload.durationMs as number) >= 180);
    assert.ok((allyPlayer.healingTicksRemaining ?? 0) > 0);
    assert.strictEqual(room.state.players.get(thrower.sessionId)?.inventory[0], "");
  });

  it("removes a disconnected player after the offline grace period expires", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await connectToRoom(colyseus, room, {
      name: "Timeout Mage",
    });

    await room.waitForNextPatch();
    await client.leave();
    await room.waitForNextPatch();

    const offlinePlayer = room.state.players.get(client.sessionId);
    assert.ok(offlinePlayer);

    if (!offlinePlayer) {
      assert.fail("Expected offline player to exist");
    }

    offlinePlayer.offlineExpiresAt = Date.now() - 1;

    await waitForNextSimulation(room, 80);

    assert.strictEqual(room.state.players.has(client.sessionId), false);
  });

  it("casts fire field as a 3x3 burning ground zone and starts cooldown", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Field Mage",
      weaponItem: "wood_staff",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(caster.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected caster to exist");
    }

    caster.send("castSkill", {
      skillId: "fireField",
      targetX: player.x + 64,
      targetY: player.y,
    });

    await waitForNextSimulation(room, 320);

    const updatedPlayer = room.state.players.get(caster.sessionId);
    assert.strictEqual(room.state.groundEffects.size, 9);
    assert.ok((updatedPlayer?.fireFieldCooldownEndsAt ?? 0) > Date.now() + 11000);
  });

  it("deals periodic damage and burn from fire field to players and mobs", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Inferno Mage",
      weaponItem: "wood_staff",
    });
    const target = await connectToRoom(colyseus, room, {
      name: "Standing Target",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverCaster = room.state.players.get(caster.sessionId);
    const serverTarget = room.state.players.get(target.sessionId);
    const rat = room.state.mobs.get(RAT_ID);
    assert.ok(serverCaster);
    assert.ok(serverTarget);
    assert.ok(rat);

    if (!serverCaster || !serverTarget || !rat) {
      assert.fail("Expected caster, target and rat to exist");
    }

    const targetTileCenterX = 12 * 32 + 16;
    const targetTileCenterY = 12 * 32 + 16;
    serverCaster.x = targetTileCenterX - 96;
    serverCaster.y = targetTileCenterY;
    serverTarget.x = targetTileCenterX;
    serverTarget.y = targetTileCenterY;
    rat.x = targetTileCenterX + 32;
    rat.y = targetTileCenterY;
    rat.health = rat.maxHealth;
    rat.aggroTargetId = "";

    caster.send("castSkill", {
      skillId: "fireField",
      targetX: targetTileCenterX,
      targetY: targetTileCenterY,
    });

    await waitForNextSimulation(room, 1300);

    const updatedTarget = room.state.players.get(target.sessionId);
    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedTarget);
    assert.ok(updatedRat);
    assert.ok((updatedTarget?.health ?? 100) < 100);
    assert.ok((updatedTarget?.burnTicksRemaining ?? 0) > 0);
    assert.ok((updatedRat?.health ?? rat.maxHealth) < rat.maxHealth);
    assert.ok((updatedRat?.burnTicksRemaining ?? 0) > 0);
    assert.ok((updatedRat?.aggroTargetId ?? "").length > 0);
  });

  it("keeps player collision priority over a nearby mob in projectile broadphase", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await connectToRoom(colyseus, room, {
      name: "Priority Mage",
      weaponItem: "wood_staff",
    });
    const target = await connectToRoom(colyseus, room, {
      name: "Priority Target",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const serverCaster = room.state.players.get(caster.sessionId);
    const serverTarget = room.state.players.get(target.sessionId);
    const rat = room.state.mobs.get(RAT_ID);
    assert.ok(serverCaster);
    assert.ok(serverTarget);
    assert.ok(rat);

    if (!serverCaster || !serverTarget || !rat) {
      assert.fail("Expected caster, target and rat to exist");
    }

    serverCaster.x = 400;
    serverCaster.y = 300;
    serverTarget.x = 470;
    serverTarget.y = 300;
    rat.x = serverTarget.x + 8;
    rat.y = serverTarget.y;
    rat.health = rat.maxHealth;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: serverTarget.x,
      targetY: serverTarget.y,
    });

    await waitForNextSimulation(room, 420);

    const updatedTarget = room.state.players.get(target.sessionId);
    const updatedRat = room.state.mobs.get(RAT_ID);
    assert.ok(updatedTarget);
    assert.ok(updatedRat);
    assert.ok((updatedTarget?.health ?? 100) < 100);
    assert.strictEqual(updatedRat?.health, updatedRat?.maxHealth);
  });
});

