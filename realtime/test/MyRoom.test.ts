import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { createAppConfig } from "../src/app.config.js";
import { MyRoomState } from "../src/rooms/schema/MyRoomState.js";
import { MobState } from "../src/rooms/schema/MobState.js";

const RAT_ID = "rat-scout";
const BAT_ID = "bat-stalker";

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
  skeleton.attackDamage = 11;
  skeleton.attackCooldownMs = 1100;
  skeleton.health = 52;
  skeleton.maxHealth = 52;
  skeleton.experienceReward = 36;
  return skeleton;
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

    const client1 = await colyseus.connectTo(room, {
      name: "Mage One",
      bodyItem: "robe_tunic",
      headItem: "magic_hat",
    });
    const client2 = await colyseus.connectTo(room, {
      name: "Mage Two",
    });

    await room.waitForNextPatch();

    assert.strictEqual(room.clients.length, 2);
    assert.strictEqual(room.state.players.size, 2);

    const localPlayer = room.state.players.get(client1.sessionId);
    assert.ok(localPlayer);
    assert.strictEqual(localPlayer?.name, "Mage One");
    assert.strictEqual(localPlayer?.bodyItem, "robe_tunic");
    assert.strictEqual(localPlayer?.headItem, "magic_hat");

    const startX = localPlayer?.x ?? 0;
    client1.send("move", { x: 1, y: 0 });

    await room.waitForNextPatch();
    await waitForNextSimulation(room, 120);

    const movedPlayer = room.state.players.get(client1.sessionId);
    assert.ok(movedPlayer);
    assert.ok((movedPlayer?.x ?? 0) > startX);
  });

  it("loads configured static skeletons in the world lobby without legacy rat or bat ids", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", { worldOwner: "tester" });
    await colyseus.connectTo(room, {
      worldOwner: "tester",
      name: "Aggro Target",
    });

    await room.waitForNextPatch();

    const rat = room.state.mobs.get(RAT_ID);
    const bat = room.state.mobs.get(BAT_ID);
    assert.strictEqual(rat, undefined);
    assert.strictEqual(bat, undefined);
    assert.strictEqual(room.state.mobs.size, 1);
    assert.strictEqual([...room.state.mobs.values()][0]?.kind, "skeleton");
  });

  it("spawns a rat mob with balance-driven health and patrol movement", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
      name: "Watcher",
    });

    await room.waitForNextPatch();
    await spawnStaticWorldMobsForTest(room);

    const rat = client.state.mobs.get(RAT_ID);
    assert.ok(rat);
    assert.strictEqual(rat?.name, "Rat");
    assert.strictEqual(rat?.health, 38);
    assert.strictEqual(rat?.maxHealth, 38);

    const startX = rat?.x ?? 0;
    await waitForNextSimulation(room, 220);

    const movedRat = client.state.mobs.get(RAT_ID);
    assert.ok(movedRat);
    assert.notStrictEqual(movedRat?.x, startX);
  });

  it("makes the rat chase and attack a nearby player", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
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

    const updatedPlayer = client.state.players.get(client.sessionId);
    const updatedRat = client.state.mobs.get(RAT_ID);

    assert.ok(updatedPlayer);
    assert.ok(updatedRat);
    assert.strictEqual(updatedRat?.aggroTargetId, client.sessionId);
    assert.ok((updatedRat?.x ?? startingRatX) > startingRatX);
    assert.ok((updatedPlayer?.health ?? startingHealth) < startingHealth);
  });

  it("starts a skeleton bite cast with a visible cast window and a 2s cooldown", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
      name: "Bite Target",
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

    await waitForNextSimulation(room, 180);

    assert.strictEqual(skeleton.castingSkillId, "bite");
    assert.strictEqual(skeleton.castEndsAt - skeleton.castStartedAt, 1000);
    assert.strictEqual(skeleton.attackCooldownEndsAt - skeleton.castStartedAt, 2000);
    assert.strictEqual(player.health, startingHealth);
    assert.strictEqual(skeleton.skillLungeStartedAt, 0);
  });

  it("keeps skeletons from using generic melee while bite is on cooldown", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
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

  it("stops a skeleton bite lunge at the collision edge and damages once", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
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
    assert.ok(player.health < startingHealth);
    assert.ok(skeleton.x < player.x);
    assert.ok(Math.hypot(player.x - skeleton.x, player.y - skeleton.y) >= 20);

    const healthAfterBite = player.health;
    await waitForNextSimulation(room, 280);
    assert.strictEqual(player.health, healthAfterBite);
  });

  it("rejects fireball casts without the required weapon", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
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
    const attacker = await colyseus.connectTo(room, {
      name: "Mage Hunter",
      weaponItem: "default_staff",
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

  it("aims the fireball through the cursor point from its actual spawn position", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await colyseus.connectTo(room, {
      name: "Mage Aim",
      weaponItem: "default_staff",
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
    const caster = await colyseus.connectTo(room, {
      name: "Range Mage",
      weaponItem: "default_staff",
    });

    await room.waitForNextPatch();

    const player = room.state.players.get(caster.sessionId);
    assert.ok(player);

    if (!player) {
      assert.fail("Expected caster to exist");
    }

    const requestedTargetX = player.x + 1000;
    const requestedTargetY = player.y;

    caster.send("castSkill", {
      skillId: "fireball",
      targetX: requestedTargetX,
      targetY: requestedTargetY,
    });

    await waitForNextSimulation(room, 320);

    caster.send("castSkill", {
      skillId: "fireField",
      targetX: requestedTargetX,
      targetY: requestedTargetY,
    });

    await waitForNextSimulation(room, 320);

    const projectile = [...room.state.projectiles.values()][0];
    const fieldCenters = [...room.state.groundEffects.values()].map((effect) => effect.x);

    assert.ok(projectile);
    assert.ok(fieldCenters.length > 0);
    assert.ok((projectile?.x ?? player.x) < requestedTargetX);
    assert.ok(Math.max(...fieldCenters) < requestedTargetX);
    assert.ok(Math.max(...fieldCenters) <= player.x + 32 * 8);
  });

  it("applies burn damage over time to a player hit by fireball", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const caster = await colyseus.connectTo(room, {
      name: "Burn Mage",
      weaponItem: "default_staff",
    });
    const target = await colyseus.connectTo(room, {
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
    const caster = await colyseus.connectTo(room, {
      name: "Burn Mage",
      weaponItem: "default_staff",
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
    const caster = await colyseus.connectTo(room, {
      name: "Nova Mage",
      weaponItem: "default_staff",
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
    const caster = await colyseus.connectTo(room, {
      name: "XP Mage",
      weaponItem: "default_staff",
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
    const client = await colyseus.connectTo(room, {
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
    const client = await colyseus.connectTo(room, {
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

    const reconnectedClient = await colyseus.connectTo(room, {
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
    const caster = await colyseus.connectTo(room, {
      name: "Reconnect Burner",
      weaponItem: "default_staff",
    });
    const target = await colyseus.connectTo(room, {
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

    const reconnectedTarget = await colyseus.connectTo(room, {
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
    const client = await colyseus.connectTo(room, {
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
        playerHealing: {
          start: (
            playerId: string,
            totalTicks: number,
            tickMs: number,
            durationMs: number,
            target: typeof player,
            now?: number,
          ) => void;
        };
      }
    ).playerHealing.start(client.sessionId, 4, 1000, 4000, player, Date.now());

    await waitForNextSimulation(room, 220);

    const healingPlayer = room.state.players.get(client.sessionId);
    assert.ok((healingPlayer?.healingTicksRemaining ?? 0) > 0);

    await client.leave();
    await room.waitForNextPatch();

    const reconnectedClient = await colyseus.connectTo(room, {
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

  it("removes a disconnected player after the offline grace period expires", async () => {
    const room = await colyseus.createRoom<MyRoomState>("world", {});
    const client = await colyseus.connectTo(room, {
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
    const caster = await colyseus.connectTo(room, {
      name: "Field Mage",
      weaponItem: "default_staff",
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
    const caster = await colyseus.connectTo(room, {
      name: "Inferno Mage",
      weaponItem: "default_staff",
    });
    const target = await colyseus.connectTo(room, {
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
    const caster = await colyseus.connectTo(room, {
      name: "Priority Mage",
      weaponItem: "default_staff",
    });
    const target = await colyseus.connectTo(room, {
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
