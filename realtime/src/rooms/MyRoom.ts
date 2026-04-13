import { Client } from "colyseus";
import {
  type AdminUpdateMobBalanceMessage,
  type AdminUpdateSkillBalanceMessage,
  createEquipmentStateSnapshot,
  type ChatInputMessage,
  type MoveMessage,
  type RealtimeChatMessage,
  type UseConsumableMessage,
  type WorldProfileMessage,
  type WorldRoomJoinOptions,
} from "@mmorpg/shared/realtime/contracts";
import { type MapSchema } from "@colyseus/schema";
import { MyRoomState } from "./schema/MyRoomState.js";
import { ChestState } from "./schema/ChestState.js";
import { GroundEffectState } from "./schema/GroundEffectState.js";
import { MobState } from "./schema/MobState.js";
import { PlayerState } from "./schema/PlayerState.js";
import { ProjectileState } from "./schema/ProjectileState.js";
import { BaseGameRoom, type VerifiedPlayer } from "./BaseGameRoom.js";
import {
  awardExperience as awardSharedExperience,
  WORLD_GAMEPLAY_PROFILE,
  type RoomGameplayProfile,
} from "./sharedGameplay.js";
import { INVENTORY_SIZE } from "@mmorpg/shared";
import {
  getMobDefinition,
  MOB_KINDS,
  type MobKind,
} from "@mmorpg/shared/mobs/catalog";
import {
  normalizeRoomInventorySlots,
  parseRoomInventoryEntry,
} from "./roomItems.js";
import {
  applyVerifiedProfile,
} from "./auth.js";
import {
  replaceRoomStringSlots,
} from "./runtime/inventoryRuntime.js";
import {
  applyRoomProfilePatch,
  applyRoomZeroHealthState,
  initializeRoomPlayerTransientState,
} from "./runtime/profileRuntime.js";
import {
  clearRoomSessionCollections,
  moveRoomMapValue,
  refreshVerifiedRoomProfile,
  resolveVerifiedRoomAuthResult,
  sendRoomBalanceSnapshots,
  transferRoomOwnedReferences,
} from "./runtime/sessionRuntime.js";
import { loadWorldDefinition } from "./worldDefinition.js";

const TILE_SIZE = WORLD_GAMEPLAY_PROFILE.tileSize;
const PLAYER_SPEED = WORLD_GAMEPLAY_PROFILE.playerMoveSpeed;
const CHAT_HISTORY_LIMIT = 40;
const PLAYER_OFFLINE_GRACE_MS = 60000;
const PLAYER_MOB_COLLISION_RADIUS = WORLD_GAMEPLAY_PROFILE.playerMobCollisionRadius;

export class MyRoom extends BaseGameRoom<PlayerState> {
  maxClients = 100;
  autoDispose = false;
  state = new MyRoomState();
  private readonly worldDefinition = loadWorldDefinition("lobby");
  private readonly blockedWorldTiles = new Set(
    this.worldDefinition.blockedTiles.map((tile) => `${tile.x}:${tile.y}`),
  );
  private readonly chatHistory: RealtimeChatMessage[] = [];
  private readonly pendingMovementSequence = new Map<string, number>();
  private readonly worldSpawnPosition = {
    x: this.worldDefinition.spawn.x * TILE_SIZE + TILE_SIZE / 2,
    y: this.worldDefinition.spawn.y * TILE_SIZE + TILE_SIZE / 2,
  };

  // ── Abstract method implementations ─────────────────────────────

  protected get profile(): RoomGameplayProfile {
    return WORLD_GAMEPLAY_PROFILE;
  }

  protected get roomPlayers(): MapSchema<PlayerState> {
    return this.state.players;
  }

  protected get roomMobs(): MapSchema<MobState> {
    return this.state.mobs;
  }

  protected get roomChests(): MapSchema<ChestState> {
    return this.state.chests;
  }

  protected get roomGroundEffects(): MapSchema<GroundEffectState> {
    return this.state.groundEffects;
  }

  protected get roomProjectiles(): MapSchema<ProjectileState> {
    return this.state.projectiles;
  }

  protected isBlockedTile(tileX: number, tileY: number): boolean {
    return this.blockedWorldTiles.has(`${tileX}:${tileY}`);
  }

  protected getMapWidthPx(): number {
    return this.worldDefinition.width * TILE_SIZE;
  }

  protected getMapHeightPx(): number {
    return this.worldDefinition.height * TILE_SIZE;
  }

  protected getMapWidthTiles(): number {
    return this.worldDefinition.width;
  }

  protected getMapHeightTiles(): number {
    return this.worldDefinition.height;
  }

  protected handlePlayerKilled(player: PlayerState): void {
    this.handlePlayerDeath(player);
  }

  protected onCombatLog(text: string): void {
    this.pushChatMessage({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      author: "Combat",
      text,
      channel: "combat",
      createdAt: new Date().toISOString(),
    });
  }

  protected clearPlayerMovement(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.moveX = 0;
      player.moveY = 0;
    }
    this.pendingMovementSequence.delete(sessionId);
  }

  protected canTeleportTo(x: number, y: number, _playerId: string): boolean {
    return this.canPlayerMoveTo(x, y);
  }

  protected performTeleportScroll(playerId: string, player: PlayerState): void {
    const destination = this.findRandomTeleportDestination(playerId);
    if (!destination) {
      return;
    }

    player.x = destination.x;
    player.y = destination.y;
    player.moveX = 0;
    player.moveY = 0;
    this.pendingMovementSequence.delete(playerId);
  }

  protected override createProjectileState(): ProjectileState {
    return new ProjectileState();
  }

  // ── Overrides for world-specific behaviour ──────────────────────

  protected override awardExperience(playerId: string, amount: number): void {
    const player = this.state.players.get(playerId);
    if (!player || player.dead || amount <= 0) {
      return;
    }

    const levelsGained = awardSharedExperience(player, amount);

    for (let levelOffset = 0; levelOffset < levelsGained; levelOffset += 1) {
      this.pushChatMessage({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        author: "Combat",
        text: `${player.name} reached level ${player.level - levelsGained + levelOffset + 1}.`,
        channel: "combat",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // ── Colyseus lifecycle ──────────────────────────────────────────

  async onAuth(_client: Client, options?: WorldRoomJoinOptions) {
    return this.verifyAuth(options as Record<string, unknown> | undefined);
  }

  protected shouldSpawnStaticMobs() {
    return this.worldDefinition.hostileMobsEnabled || this.worldDefinition.staticMobs.length > 0;
  }

  onCreate() {
    this.contentSnapshotPoller.start();
    this.createStaticChests();
    if (this.shouldSpawnStaticMobs()) {
      this.createStaticMobs();
    }

    this.registerSharedMessageHandlers();

    this.setSimulationInterval((deltaTime) => {
      const tickNow = Date.now();
      this.updatePlayers(deltaTime / 1000, tickNow);
    }, this.simulationIntervalMs);

    this.onMessage("move", (client, message: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      if (player.dead || player.castEndsAt > Date.now()) {
        player.moveX = 0;
        player.moveY = 0;
        const sequence = Number.isFinite(message?.sequence) ? Math.max(0, Math.floor(message.sequence!)) : 0;
        player.lastProcessedInput = sequence;
        this.pendingMovementSequence.delete(client.sessionId);
        return;
      }

      const moveX = Number.isFinite(message?.x) ? message.x : 0;
      const moveY = Number.isFinite(message?.y) ? message.y : 0;
      const sequence = Number.isFinite(message?.sequence) ? Math.max(0, Math.floor(message.sequence!)) : 0;
      const length = Math.hypot(moveX, moveY);

      if (length <= 0.001) {
        player.moveX = 0;
        player.moveY = 0;
        player.lastProcessedInput = sequence;
        this.pendingMovementSequence.delete(client.sessionId);
        return;
      }

      if (length > 1) {
        player.moveX = moveX / length;
        player.moveY = moveY / length;
        this.pendingMovementSequence.set(client.sessionId, sequence);
        return;
      }

      player.moveX = moveX;
      player.moveY = moveY;
      this.pendingMovementSequence.set(client.sessionId, sequence);
    });

    this.onMessage("profile", (client, message: WorldProfileMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      const isAuthenticated = this.verifiedPlayers.has(client.sessionId);

      if (isAuthenticated) {
        refreshVerifiedRoomProfile({
          sessionToken: (message as Record<string, unknown>)?.sessionToken,
          sessionId: client.sessionId,
          verifiedPlayers: this.verifiedPlayers,
          player,
        });
        return;
      }

      applyRoomProfilePatch(player, message, {
        roleTransform: (value) => value.toUpperCase(),
      });

      this.syncPlayerInventory(player, message?.inventory);

      if (
        applyRoomZeroHealthState(player, {
          resetMovement: () => {
            player.moveX = 0;
            player.moveY = 0;
          },
          clearCastState: () => {
            this.clearPlayerCastState(player);
          },
        })
      ) {
        this.statusEffects.deletePlayerEffects(player.id);
      }
    });

    this.onMessage("chat", (client, message: ChatInputMessage) => {
      const player = this.state.players.get(client.sessionId);
      const text = typeof message?.text === "string" ? message.text.trim() : "";
      if (!player || !text) {
        return;
      }

      const chatMessage: RealtimeChatMessage = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        author: player.name || "Wanderer",
        text: text.slice(0, 180),
        channel: "general",
        createdAt: new Date().toISOString(),
      };
      this.pushChatMessage(chatMessage);
    });

    this.onMessage("adminUpdateSkillBalance", (client, message: AdminUpdateSkillBalanceMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.role.toUpperCase() !== "ADMIN") {
        return;
      }

      this.applyAdminSkillBalanceUpdate(message);
      this.broadcast("skillBalanceConfig", this.serializeSkillBalanceConfig());
    });

    this.onMessage("adminUpdateMobBalance", (client, message: AdminUpdateMobBalanceMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.role.toUpperCase() !== "ADMIN") {
        return;
      }

      this.applyAdminMobBalanceUpdate(message);
      this.applyMobBalanceToLiveMobs();
      this.broadcast("mobBalanceConfig", this.serializeMobBalanceConfig());
    });

    this.onMessage("useConsumable", (client, message: UseConsumableMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.dead || player.castEndsAt > Date.now()) {
        return;
      }

      const slotIndex = typeof message?.slotIndex === "number" ? Math.floor(message.slotIndex) : -1;
      const source = message?.source === "container" ? "container" : "inventory";
      const inventory = Array.from(player.inventory);
      let sourceSlots: string[] | null = null;

      if (source === "inventory") {
        sourceSlots = inventory;
      } else if (typeof message?.containerId === "string") {
        const chest = this.state.chests.get(message.containerId);
        if (chest) {
          sourceSlots = Array.from(chest.slots);
        }
      }

      if (!sourceSlots || slotIndex < 0 || slotIndex >= sourceSlots.length) {
        return;
      }

      this.handleUseConsumableShared(
        client.sessionId,
        player,
        sourceSlots,
        slotIndex,
        (nextSlots) => {
          if (source === "inventory") {
            replaceRoomStringSlots(player.inventory, nextSlots);
            client.send("inventoryUpdate", {
              inventory: nextSlots.map((item) => item || ""),
            });
          } else if (typeof message?.containerId === "string") {
            const chest = this.state.chests.get(message.containerId);
            if (chest) {
              replaceRoomStringSlots(chest.slots, nextSlots);
            }
          }
        },
      );
    });

    this.onMessage("respawn", (client, _message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || (!player.dead && player.health > 0)) {
        return;
      }

      const respawnPosition = this.resolveSpawnPosition(this.worldSpawnPosition);
      const respawnedPlayer = this.createRespawnedPlayerState(player, respawnPosition.x, respawnPosition.y);
      this.state.players.set(client.sessionId, respawnedPlayer);
      this.pendingMovementSequence.delete(client.sessionId);
      this.statusEffects.deletePlayerEffects(player.id);
      client.send("respawned", {
        x: respawnedPlayer.x,
        y: respawnedPlayer.y,
        health: respawnedPlayer.health,
        maxHealth: respawnedPlayer.maxHealth,
      });
    });
  }

  onDispose() {
    this.disposeShared();
  }

  onJoin(client: Client, options?: WorldRoomJoinOptions, authResult?: VerifiedPlayer | boolean | null) {
    const verified = resolveVerifiedRoomAuthResult(authResult);
    if (verified) {
      this.verifiedPlayers.set(client.sessionId, verified);
    }

    const restoredPlayer = this.restoreOfflinePlayer(client, options);
    if (restoredPlayer) {
      client.send("chatHistory", this.chatHistory);
      return;
    }

    const player = new PlayerState();
    player.id = client.sessionId;

    if (verified) {
      applyVerifiedProfile(player, verified);
    } else {
      applyRoomProfilePatch(player, options, {
        defaultName: "Wanderer",
        defaultRole: "USER",
        roleTransform: (value) => value.toUpperCase(),
      });
      this.syncPlayerInventory(player, options?.inventory);
    }

    initializeRoomPlayerTransientState(player);

    const spawnPosition = this.resolveSpawnPosition(this.worldSpawnPosition);
    player.x = spawnPosition.x;
    player.y = spawnPosition.y;

    this.state.players.set(client.sessionId, player);
    client.send("chatHistory", this.chatHistory);
    sendRoomBalanceSnapshots(
      client,
      this.serializeSkillBalanceConfig(),
      this.serializeMobBalanceConfig(),
    );
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      this.verifiedPlayers.delete(client.sessionId);
      return;
    }

    player.isOnline = false;
    player.offlineExpiresAt = Date.now() + PLAYER_OFFLINE_GRACE_MS;
    player.moveX = 0;
    player.moveY = 0;
    this.clearPlayerCastState(player);
  }

  // ── World-specific methods ──────────────────────────────────────

  private syncPlayerInventory(
    player: PlayerState,
    inventory: Array<string | null | undefined> | null | undefined,
  ) {
    if (Array.isArray(inventory)) {
      const normalizedInventory = normalizeRoomInventorySlots(inventory, INVENTORY_SIZE);
      replaceRoomStringSlots(player.inventory, normalizedInventory);
      return;
    }

    if (player.inventory.length === 0) {
      replaceRoomStringSlots(player.inventory, normalizeRoomInventorySlots([], INVENTORY_SIZE));
    }
  }

  private createStaticChests() {
    for (const definition of this.worldDefinition.staticChests) {
      const chest = new ChestState();
      chest.id = definition.id;
      chest.title = definition.title;
      chest.subtitle = definition.subtitle;
      chest.columns = definition.columns;
      chest.rows = definition.rows;
      chest.x = definition.x;
      chest.y = definition.y;

      for (let index = 0; index < chest.columns * chest.rows; index += 1) {
        chest.slots.push(definition.slots[index] ?? "");
      }

      this.state.chests.set(chest.id, chest);
    }
  }

  private createStaticMobs() {
    for (const mobDefinition of this.worldDefinition.staticMobs) {
      const mob = new MobState();
      const catalogDefinition = getMobDefinition(mobDefinition.kind);
      const patrolMinX = Math.min(mobDefinition.patrol.minX, mobDefinition.patrol.maxX);
      const patrolMaxX = Math.max(mobDefinition.patrol.minX, mobDefinition.patrol.maxX);

      mob.id = mobDefinition.id;
      mob.kind = mobDefinition.kind;
      mob.name = catalogDefinition.name;
      mob.texture = catalogDefinition.texture;
      mob.patrolMinX = patrolMinX * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolMaxX = patrolMaxX * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolY = mobDefinition.patrol.y * TILE_SIZE + TILE_SIZE / 2;
      mob.spawnX = mobDefinition.spawn.x * TILE_SIZE + TILE_SIZE / 2;
      mob.spawnY = mobDefinition.spawn.y * TILE_SIZE + TILE_SIZE / 2;
      mob.x = mob.spawnX;
      mob.y = mob.spawnY;
      mob.targetX = mob.patrolMaxX;
      mob.targetY = mob.patrolY;
      mob.patrolRadiusY = mobDefinition.patrol.radiusY;
      mob.patrolPhase = mobDefinition.patrol.phase;
      this.applyMobBalance(mob, this.getMobBalanceByKind(mobDefinition.kind));
      this.state.mobs.set(mob.id, mob);
    }
  }

  private updatePlayers(deltaSeconds: number, tickNow: number) {
    this.removeExpiredOfflinePlayers();
    // Rebuild mob spatial grid so canPlayerMoveTo uses grid queries instead of O(N)
    this.rebuildMobSpatialGrid();

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.dead) {
        continue;
      }

      const length = Math.hypot(player.moveX, player.moveY);
      if (length <= 0) {
        this.pendingMovementSequence.delete(sessionId);
        continue;
      }

      const nextX = player.x + player.moveX * PLAYER_SPEED * deltaSeconds;
      const nextY = player.y + player.moveY * PLAYER_SPEED * deltaSeconds;
      const clampedX = Math.max(TILE_SIZE / 2, Math.min(this.getMapWidthPx() - TILE_SIZE / 2, nextX));
      const clampedY = Math.max(TILE_SIZE / 2, Math.min(this.getMapHeightPx() - TILE_SIZE / 2, nextY));
      if (this.canPlayerMoveTo(clampedX, clampedY, player)) {
        player.x = clampedX;
        player.y = clampedY;
      }
      const processedSequence = this.pendingMovementSequence.get(sessionId);
      if (typeof processedSequence === "number") {
        player.lastProcessedInput = processedSequence;
      }
    }

    this.recordPlayerPositionHistory(tickNow);
    this.updateMobs(deltaSeconds, tickNow);
    this.updateCombatSystems(deltaSeconds, tickNow, { includeMobBurns: false });
  }

  private canPlayerMoveTo(x: number, y: number, player?: PlayerState) {
    const clampedX = Math.max(TILE_SIZE / 2, Math.min(this.getMapWidthPx() - TILE_SIZE / 2, x));
    const clampedY = Math.max(TILE_SIZE / 2, Math.min(this.getMapHeightPx() - TILE_SIZE / 2, y));
    const tileX = Math.floor(clampedX / TILE_SIZE);
    const tileY = Math.floor(clampedY / TILE_SIZE);

    if (this.blockedWorldTiles.has(`${tileX}:${tileY}`)) {
      return false;
    }

    const nearbyMobs = this.mobSpatialGrid.queryRadius(clampedX, clampedY, PLAYER_MOB_COLLISION_RADIUS);
    if (nearbyMobs.length > 0) {
      for (const mob of nearbyMobs) {
        if (!player) {
          return false;
        }

        const currentDistance = Math.hypot(player.x - mob.x, player.y - mob.y);
        const nextDistance = Math.hypot(clampedX - mob.x, clampedY - mob.y);
        const isAlreadyOverlapping = currentDistance < PLAYER_MOB_COLLISION_RADIUS;
        const isMovingOutOfOverlap = nextDistance > currentDistance + 0.01;

        if (!isAlreadyOverlapping || !isMovingOutOfOverlap) {
          return false;
        }
      }
    }

    return true;
  }

  private updateMobs(deltaSeconds: number, tickNow: number) {
    const onlinePlayers = Array.from(this.state.players.values());
    this.updateMobsShared(deltaSeconds, onlinePlayers, undefined, tickNow);
  }

  private getMobBalanceByKind(kind: MobKind) {
    return this.mobBalance[kind];
  }

  private findRandomTeleportDestination(playerId: string) {
    const widthInTiles = this.getMapWidthTiles();
    const heightInTiles = this.getMapHeightTiles();

    for (let attempt = 0; attempt < this.profile.teleportScrollRandomAttempts; attempt += 1) {
      const tileX = Math.floor(Math.random() * widthInTiles);
      const tileY = Math.floor(Math.random() * heightInTiles);
      const x = tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = tileY * TILE_SIZE + TILE_SIZE / 2;

      if (!this.canPlayerMoveTo(x, y)) {
        continue;
      }

      let blockedByPlayer = false;
      for (const otherPlayer of this.state.players.values()) {
        if (otherPlayer.id === playerId || otherPlayer.dead) {
          continue;
        }

        if (Math.hypot(otherPlayer.x - x, otherPlayer.y - y) < TILE_SIZE * 0.75) {
          blockedByPlayer = true;
          break;
        }
      }

      if (!blockedByPlayer) {
        return { x, y };
      }
    }

    const spawnPosition = this.resolveSpawnPosition(this.worldSpawnPosition);
    return this.canPlayerMoveTo(spawnPosition.x, spawnPosition.y) ? spawnPosition : null;
  }

  private restoreOfflinePlayer(client: Client, options?: WorldRoomJoinOptions) {
    const nextName = options?.name?.trim()?.slice(0, 24);
    if (!nextName) {
      return null;
    }

    for (const [previousSessionId, player] of this.state.players.entries()) {
      if (player.isOnline || player.name !== nextName) {
        continue;
      }

      this.state.players.delete(previousSessionId);
      player.id = client.sessionId;
      player.name = nextName;
      player.isOnline = true;
      player.offlineExpiresAt = 0;
      player.moveX = 0;
      player.moveY = 0;
      this.clearPlayerCastState(player);
      this.state.players.set(client.sessionId, player);

      moveRoomMapValue(this.consumableCooldownEndsAt, previousSessionId, client.sessionId);
      moveRoomMapValue(this.verifiedPlayers, previousSessionId, client.sessionId);
      clearRoomSessionCollections(
        previousSessionId,
        this.pendingMovementSequence,
      );
      this.skillCastSystem.clearPlayer(previousSessionId);
      this.statusEffects.movePlayerEffects(previousSessionId, client.sessionId);

      applyRoomProfilePatch(player, options, {
        roleTransform: (value) => value.toUpperCase(),
      });
      this.syncPlayerInventory(player, options?.inventory);
      if (player.health > 0) {
        player.dead = false;
      } else {
        this.statusEffects.deletePlayerEffects(player.id);
        applyRoomZeroHealthState(player, {
          resetMovement: () => {
            player.moveX = 0;
            player.moveY = 0;
          },
          clearCastState: () => {
            this.clearPlayerCastState(player);
          },
        });
      }

      transferRoomOwnedReferences({
        fromId: previousSessionId,
        toId: client.sessionId,
        mobs: this.state.mobs.values(),
        projectiles: this.state.projectiles.values(),
        groundEffects: this.state.groundEffects.values(),
      });
      this.projectileSystem.transferOwnerReferences(previousSessionId, client.sessionId);

      sendRoomBalanceSnapshots(
        client,
        this.serializeSkillBalanceConfig(),
        this.serializeMobBalanceConfig(),
      );
      return player;
    }

    return null;
  }

  private createRespawnedPlayerState(player: PlayerState, x: number, y: number) {
    const nextPlayer = new PlayerState();
    nextPlayer.id = player.id;
    nextPlayer.name = player.name;
    nextPlayer.role = player.role;
    nextPlayer.x = x;
    nextPlayer.y = y;
    nextPlayer.isOnline = true;
    nextPlayer.offlineExpiresAt = 0;
    nextPlayer.moveX = 0;
    nextPlayer.moveY = 0;
    nextPlayer.health = player.maxHealth;
    nextPlayer.maxHealth = player.maxHealth;
    nextPlayer.level = player.level;
    nextPlayer.experience = player.experience;
    nextPlayer.strength = player.strength;
    nextPlayer.agility = player.agility;
    nextPlayer.intellect = player.intellect;
    initializeRoomPlayerTransientState(nextPlayer);
    nextPlayer.bodyItem = player.bodyItem;
    nextPlayer.headItem = player.headItem;
    nextPlayer.weaponItem = player.weaponItem;
    nextPlayer.headGemItem1 = player.headGemItem1;
    nextPlayer.headGemItem2 = player.headGemItem2;
    nextPlayer.headGemItem3 = player.headGemItem3;
    nextPlayer.bodyGemItem1 = player.bodyGemItem1;
    nextPlayer.bodyGemItem2 = player.bodyGemItem2;
    nextPlayer.bodyGemItem3 = player.bodyGemItem3;
    nextPlayer.weaponGemItem1 = player.weaponGemItem1;
    nextPlayer.weaponGemItem2 = player.weaponGemItem2;
    nextPlayer.weaponGemItem3 = player.weaponGemItem3;
    replaceRoomStringSlots(
      nextPlayer.inventory,
      normalizeRoomInventorySlots(Array.from(player.inventory), INVENTORY_SIZE),
    );
    return nextPlayer;
  }

  private resolveSpawnPosition(position?: WorldProfileMessage["position"]) {
    const fallback = {
      x: this.worldDefinition.spawn.x * TILE_SIZE + TILE_SIZE / 2 + this.state.players.size * 18,
      y: this.worldDefinition.spawn.y * TILE_SIZE + TILE_SIZE / 2 + this.state.players.size * 18,
    };

    if (
      typeof position?.x !== "number" ||
      !Number.isFinite(position.x) ||
      typeof position?.y !== "number" ||
      !Number.isFinite(position.y)
    ) {
      return fallback;
    }

    const clampedX = Math.max(TILE_SIZE / 2, Math.min(this.getMapWidthPx() - TILE_SIZE / 2, position.x));
    const clampedY = Math.max(TILE_SIZE / 2, Math.min(this.getMapHeightPx() - TILE_SIZE / 2, position.y));
    const tileX = Math.floor(clampedX / TILE_SIZE);
    const tileY = Math.floor(clampedY / TILE_SIZE);

    if (this.blockedWorldTiles.has(`${tileX}:${tileY}`)) {
      return fallback;
    }

    return {
      x: clampedX,
      y: clampedY,
    };
  }

  private removeExpiredOfflinePlayers() {
    const now = Date.now();

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.isOnline || player.offlineExpiresAt > now) {
        continue;
      }

      this.state.players.delete(sessionId);
      this.statusEffects.deletePlayerEffects(sessionId);
      this.projectileSystem.clearOwnerData(sessionId);
      clearRoomSessionCollections(
        sessionId,
        this.consumableCooldownEndsAt,
        this.pendingMovementSequence,
        this.verifiedPlayers,
      );
      this.skillCastSystem.clearPlayer(sessionId);
    }
  }

  private handlePlayerDeath(player: PlayerState) {
    player.dead = true;
    player.health = 0;
    player.maxHealth = 100;
    player.level = 1;
    player.experience = 0;
    player.burnTicksRemaining = 0;
    player.burnEndsAt = 0;
    player.healingTicksRemaining = 0;
    player.healingEndsAt = 0;
    player.moveX = 0;
    player.moveY = 0;
    player.fireFieldCooldownEndsAt = 0;
    player.woodStaffStrikeCooldownEndsAt = 0;
    this.clearPlayerCastState(player);
    this.statusEffects.deletePlayerEffects(player.id);

    const droppedItems = [
      player.headItem,
      player.bodyItem,
      player.weaponItem,
      player.headGemItem1,
      player.headGemItem2,
      player.headGemItem3,
      player.bodyGemItem1,
      player.bodyGemItem2,
      player.bodyGemItem3,
      player.weaponGemItem1,
      player.weaponGemItem2,
      player.weaponGemItem3,
      ...Array.from(player.inventory),
    ].filter((itemId) => {
      return parseRoomInventoryEntry(itemId) !== null;
    });

    if (droppedItems.length > 0) {
      const chest = new ChestState();
      chest.id = `loot-bag-${player.id}-${Date.now()}`;
      chest.title = "Loot Bag";
      chest.subtitle = "Dropped Loot";
      chest.columns = 6;
      chest.rows = 5;
      chest.x = Math.floor(player.x / TILE_SIZE);
      chest.y = Math.floor(player.y / TILE_SIZE);

      for (let index = 0; index < chest.columns * chest.rows; index += 1) {
        chest.slots.push(droppedItems[index] ?? "");
      }

      this.state.chests.set(chest.id, chest);
    }

    player.headItem = "";
    player.bodyItem = "";
    player.weaponItem = "";
    player.headGemItem1 = "";
    player.headGemItem2 = "";
    player.headGemItem3 = "";
    player.bodyGemItem1 = "";
    player.bodyGemItem2 = "";
    player.bodyGemItem3 = "";
    player.weaponGemItem1 = "";
    player.weaponGemItem2 = "";
    player.weaponGemItem3 = "";
    replaceRoomStringSlots(player.inventory, normalizeRoomInventorySlots([], INVENTORY_SIZE));

    const client = this.clients.find((entry: Client): boolean => entry.sessionId === player.id);
    client?.send("died", {
      health: 0,
      maxHealth: player.maxHealth,
      level: player.level,
      experience: player.experience,
      equipment: createEquipmentStateSnapshot({}),
      inventory: new Array<string | null>(INVENTORY_SIZE).fill(null),
    });
  }

  private pushChatMessage(message: RealtimeChatMessage) {
    this.chatHistory.push(message);
    if (this.chatHistory.length > CHAT_HISTORY_LIMIT) {
      this.chatHistory.shift();
    }

    this.broadcast("chat", message);
  }

  // ── Admin balance ───────────────────────────────────────────────

  private applyAdminSkillBalanceUpdate(message: AdminUpdateSkillBalanceMessage) {
    const sections = [
      ["fireball", this.skillBalance.fireball, message.fireball],
      ["fireNova", this.skillBalance.fireNova, message.fireNova],
      ["fireField", this.skillBalance.fireField, message.fireField],
    ] as const;

    for (const [, target, patch] of sections) {
      if (!patch) {
        continue;
      }

      if (typeof patch.damage === "number" && Number.isFinite(patch.damage)) {
        target.damage = Math.max(0, Math.floor(patch.damage));
      }

      if (typeof patch.burnDamage === "number" && Number.isFinite(patch.burnDamage)) {
        target.burnDamage = Math.max(0, Math.floor(patch.burnDamage));
      }

      if (typeof patch.burnTicks === "number" && Number.isFinite(patch.burnTicks)) {
        target.burnTicks = Math.max(0, Math.floor(patch.burnTicks));
      }
    }
  }

  private applyAdminMobBalanceUpdate(message: AdminUpdateMobBalanceMessage) {
    for (const kind of MOB_KINDS) {
      const target = this.mobBalance[kind];
      const patch = message[kind];
      if (!patch) {
        continue;
      }

      if (typeof patch.maxHealth === "number" && Number.isFinite(patch.maxHealth)) {
        target.maxHealth = Math.max(1, Math.floor(patch.maxHealth));
      }
      if (typeof patch.moveSpeed === "number" && Number.isFinite(patch.moveSpeed)) {
        target.moveSpeed = Math.max(0, Math.floor(patch.moveSpeed));
      }
      if (typeof patch.aggroRange === "number" && Number.isFinite(patch.aggroRange)) {
        target.aggroRange = Math.max(0, Math.floor(patch.aggroRange));
      }
      if (typeof patch.leashRange === "number" && Number.isFinite(patch.leashRange)) {
        target.leashRange = Math.max(0, Math.floor(patch.leashRange));
      }
      if (typeof patch.attackRange === "number" && Number.isFinite(patch.attackRange)) {
        target.attackRange = Math.max(0, Math.floor(patch.attackRange));
      }
      if (typeof patch.attackDamage === "number" && Number.isFinite(patch.attackDamage)) {
        target.attackDamage = Math.max(0, Math.floor(patch.attackDamage));
      }
      if (typeof patch.attackCooldownMs === "number" && Number.isFinite(patch.attackCooldownMs)) {
        target.attackCooldownMs = Math.max(0, Math.floor(patch.attackCooldownMs));
      }
      if (typeof patch.experienceReward === "number" && Number.isFinite(patch.experienceReward)) {
        target.experienceReward = Math.max(0, Math.floor(patch.experienceReward));
      }
    }
  }

}
