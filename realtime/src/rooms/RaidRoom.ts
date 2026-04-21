import { Client } from "colyseus";
import {
  createEquipmentStateSnapshot,
  type MoveMessage,
  type RaidExitStateMessage,
  type RaidProfileMessage,
  type RaidRoomJoinOptions,
  type UseConsumableMessage,
  type UseExitMessage,
} from "@mmorpg/shared/realtime/contracts";
import { type MapSchema } from "@colyseus/schema";
import { ChestState } from "./schema/ChestState.js";
import { GroundEffectState } from "./schema/GroundEffectState.js";
import { MobState } from "./schema/MobState.js";
import { ProjectileState } from "./schema/ProjectileState.js";
import { RaidRoomState } from "./schema/RaidRoomState.js";
import { RaidPlayerState } from "./schema/RaidPlayerState.js";
import { BaseGameRoom, type DamageType, type VerifiedPlayer } from "./BaseGameRoom.js";
import {
  RAID_GAMEPLAY_PROFILE,
  type RoomGameplayProfile,
} from "./runtime/sharedGameplay.js";
import {
  INVENTORY_SIZE,
  identifyAllRaidUnidentifiedInventoryEntries,
  isGemItemId,
  normalizeItemProgressionState,
  serializeRaidUnidentifiedInventoryItem,
  type ItemId,
} from "@mmorpg/shared";
import {
  getMobDefinition,
  type MobKind,
} from "@mmorpg/shared/mobs/catalog";
import { type ArmorGemCarrier } from "./runtime/armorGems.js";
import {
  getSharedDamageTakenMultiplier,
} from "./runtime/projectileSkills.js";
import { generateRaidLayoutForTemplate } from "./procgen/generateRaidLayout.js";
import { createSeededRandom } from "./procgen/seededRandom.js";
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
import {
  normalizeMoveMessage,
  normalizeUseExitMessage,
  normalizeUseConsumableMessage,
} from "./runtime/messageValidation.js";
import {
  canRaidPlayerMoveTo,
  findRandomRaidTeleportDestination,
  handleRaidMoveMessage,
  resolveRaidJoinSpawnPosition,
  updateRaidPlayers,
  type RaidMovementRuntimeContext,
} from "./runtime/raidMovementRuntime.js";
import {
  restoreRaidRuntimeState,
  serializeRaidRuntimeState,
} from "./runtime/raidPersistenceRuntime.js";
import type { BasePlayerState } from "./schema/BasePlayerState.js";
import {
  loadRaidContent,
  resolveRaidTemplateContent,
} from "./raidContent.js";

const TILE_SIZE = RAID_GAMEPLAY_PROFILE.tileSize;
const RAID_PLAYER_SPEED = RAID_GAMEPLAY_PROFILE.playerMoveSpeed;
const PLAYER_COLLISION_FOOT_OFFSET_Y = 12;
const PLAYER_MOB_COLLISION_HALF_WIDTH = RAID_GAMEPLAY_PROFILE.playerMobCollisionHalfWidth;
const PLAYER_MOB_COLLISION_HALF_HEIGHT = RAID_GAMEPLAY_PROFILE.playerMobCollisionHalfHeight;
const PLAYER_MOB_COLLISION_OFFSET_Y = RAID_GAMEPLAY_PROFILE.playerMobCollisionOffsetY;
const OFFLINE_PLAYER_GRACE_MS = 60_000;
const RAID_DURATION_MS = 15 * 60_000;
const RAT_PACK_JOIN_DISTANCE = TILE_SIZE * 3.5;
const RAT_PACK_ROAM_INTERVAL_MS = 5000;
const RAT_PACK_TARGET_REACHED_DISTANCE = TILE_SIZE * 0.75;
const RAID_INITIAL_MOB_MIN_SPAWN_DISTANCE_PX = TILE_SIZE * 10;
const RAID_CHEST_GEM_ROLL_CHANCE = 0.05;
const RAID_CHEST_LOOT_REDUCTION_FACTOR = 2;
const RAID_UNIDENTIFIED_CONSUMABLE_ITEM_IDS = new Set([
  "healing_potion",
  "poison_potion",
  "slow_potion",
  "antidote",
  "speed_potion",
  "fire_resistance_potion",
]);
const RAID_RUNTIME_PERSIST_INTERVAL_MS = 1000;
const ALLOW_GUEST_EQUIPMENT_SYNC = process.env.NODE_ENV !== "production";

export class RaidRoom extends BaseGameRoom<RaidPlayerState> {
  maxClients = 8;
  state = new RaidRoomState();
  private readonly raidContent = loadRaidContent();
  private activeRaidContent = resolveRaidTemplateContent(this.raidContent, "crypt_small");
  private readonly pendingMovement = new Map<string, { x: number; y: number; sequence: number }>();
  private blockedTiles = new Uint8Array(0);
  private chestBlockedTiles = new Uint8Array(0);
  private readonly offlineExpiresAt = new Map<string, number>();
  private readonly ratPackDestinations = new Map<string, { x: number; y: number; expiresAt: number }>();
  private disposeTimeout: ReturnType<typeof setTimeout> | null = null;
  private raidExpiresAt = 0;
  private raidClosed = false;
  private lastPersistedRaidRuntimeKey = "";
  private lastPersistedRaidRuntimeAt = 0;
  private readonly raidMovementContext: RaidMovementRuntimeContext<RaidPlayerState> = {
    roomPlayers: this.state.players,
    pendingMovement: this.pendingMovement,
    offlineExpiresAt: this.offlineExpiresAt,
    playerLatencyMs: this.playerLatencyMs,
    mobSpatialGrid: this.mobSpatialGrid,
    profile: this.profile,
    tileSize: TILE_SIZE,
    playerSpeed: RAID_PLAYER_SPEED,
    collisionHalfWidth: PLAYER_MOB_COLLISION_HALF_WIDTH,
    collisionHalfHeight: PLAYER_MOB_COLLISION_HALF_HEIGHT,
    collisionOffsetY: PLAYER_MOB_COLLISION_OFFSET_Y,
    footCollisionOffsetY: PLAYER_COLLISION_FOOT_OFFSET_Y,
    teleportAttempts: this.profile.teleportScrollRandomAttempts,
    getMapWidthTiles: () => this.state.width,
    getMapHeightTiles: () => this.state.height,
    getBlockedTiles: () => this.blockedTiles,
    getChestBlockedTiles: () => this.chestBlockedTiles,
    ensureMobSpatialGrid: () => this.ensureMobSpatialGrid(),
  };

  // ── Abstract method implementations ─────────────────────────────

  protected get profile(): RoomGameplayProfile {
    return RAID_GAMEPLAY_PROFILE;
  }

  protected get roomPlayers(): MapSchema<RaidPlayerState> {
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
    if (tileX < 0 || tileY < 0 || tileX >= this.state.width || tileY >= this.state.height) {
      return true;
    }
    const tileIndex = tileY * this.state.width + tileX;
    return this.blockedTiles[tileIndex] === 1 || this.chestBlockedTiles[tileIndex] === 1;
  }

  protected getMapWidthPx(): number {
    return this.state.width * TILE_SIZE;
  }

  protected getMapHeightPx(): number {
    return this.state.height * TILE_SIZE;
  }

  protected getMapWidthTiles(): number {
    return this.state.width;
  }

  protected getMapHeightTiles(): number {
    return this.state.height;
  }

  protected handlePlayerKilled(player: BasePlayerState): void {
    this.handleRaidPlayerDeath(player as RaidPlayerState);
  }

  protected onCombatLog(_text: string): void {
    // Raids have no chat — combat logs are silently discarded.
  }

  protected clearPlayerMovement(sessionId: string): void {
    this.pendingMovement.delete(sessionId);
  }

  protected canTeleportTo(x: number, y: number, _playerId: string): boolean {
    return canRaidPlayerMoveTo(this.raidMovementContext, x, y);
  }

  protected performTeleportScroll(playerId: string, player: BasePlayerState): void {
    const destination = findRandomRaidTeleportDestination(this.raidMovementContext, playerId, this.state.spawnPoints[0] ?? "2:2");
    if (!destination) {
      return;
    }

    player.x = destination.x;
    player.y = destination.y;
    this.pendingMovement.delete(playerId);
  }

  protected override createProjectileState(): ProjectileState {
    return new ProjectileState();
  }

  // ── Overrides for raid-specific behaviour ───────────────────────

  protected override applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number {
    const resolvedDamage = Math.max(
      0,
      Math.round(amount * getSharedDamageTakenMultiplier(
        player as BasePlayerState & ArmorGemCarrier,
        damageType,
        this.itemFireResistance,
        player.fireResistanceBuffEndsAt,
        this.profile.fireResistancePotionPercent,
      )),
    );
    const previousHealth = player.health;
    const minimumHealth = this.hasActiveTutorialProtection() ? 1 : 0;
    player.health = Math.max(minimumHealth, player.health - resolvedDamage);
    return Math.max(0, previousHealth - player.health);
  }

  protected override handleMobDeath(mob: MobState): void {
    super.handleMobDeath(mob);
    this.ratPackDestinations.delete(mob.id);
  }

  // ── Colyseus lifecycle ──────────────────────────────────────────

  async onAuth(_client: Client, options?: RaidRoomJoinOptions) {
    return this.verifyAuth(options as Record<string, unknown> | undefined);
  }

  onCreate(options: RaidRoomJoinOptions = {}) {
    this.autoDispose = false;
    this.contentSnapshotPoller.start();
    this.registerSharedMessageHandlers();
    const seed = options.seed || `raid-${Date.now().toString(36)}`;
    const templateCode = options.templateCode ?? "crypt_small";
    this.activeRaidContent = resolveRaidTemplateContent(this.raidContent, templateCode);
    const layout = generateRaidLayoutForTemplate(
      templateCode,
      seed,
      options.width ?? 128,
      options.height ?? 128,
    );

    this.state.raidRunId = options.raidRunId ?? "";
    this.state.templateCode = templateCode;
    this.state.templateName = options.templateName ?? "Crypt Small";
    this.state.biome = options.biome ?? "crypt";
    this.state.seed = seed;
    this.state.status = "forming";
    this.raidExpiresAt = Date.now() + RAID_DURATION_MS;
    this.state.width = layout.width;
    this.state.height = layout.height;
    this.blockedTiles = new Uint8Array(layout.tiles.length);
    this.chestBlockedTiles = new Uint8Array(layout.tiles.length);

    layout.tiles.forEach((tile, index) => {
      this.state.tiles.push(tile);
      this.blockedTiles[index] = tile === "wall" || tile === "wallEdge" ? 1 : 0;
    });
    layout.rooms.forEach((room) => this.state.rooms.push(`${room.x}:${room.y}:${room.width}:${room.height}`));
    layout.spawnPoints.forEach((spawn) => this.state.spawnPoints.push(`${spawn.x}:${spawn.y}`));
    layout.exitPoints.forEach((exitPoint) => this.state.exitPoints.push(`${exitPoint.x}:${exitPoint.y}`));
    layout.questObjectives.forEach((questObjective, index) => {
      const chest = this.createQuestObjectiveChest(
        `${questObjective.kind}-${index}`,
        questObjective.x,
        questObjective.y,
      );
      this.state.chests.set(chest.id, chest);
      this.chestBlockedTiles[chest.y * layout.width + chest.x] = 1;
    });
    layout.chests.forEach((chestPoint, index) => {
      const chest = this.createRaidChest(seed, index, chestPoint.x, chestPoint.y, layout.width, layout.height);
      this.state.chests.set(chest.id, chest);
      this.chestBlockedTiles[chest.y * layout.width + chest.x] = 1;
    });
    this.createRaidMobs(seed, layout.rooms);
    if (options.runtimeState) {
      restoreRaidRuntimeState({
        runtimeState: options.runtimeState,
        mobs: this.state.mobs,
        chests: this.state.chests,
        groundEffects: this.state.groundEffects,
        chestBlockedTiles: this.chestBlockedTiles,
        width: layout.width,
      });
      this.state.status = options.runtimeState.status || this.state.status;
      this.raidExpiresAt = options.runtimeState.expiresAt || this.raidExpiresAt;
      this.raidClosed = this.state.status === "expired";
    }

    this.onMessage("move", (client, message: MoveMessage) => {
      const normalizedMessage = normalizeMoveMessage(message);
      if (!normalizedMessage) {
        return;
      }
      handleRaidMoveMessage(this.raidMovementContext, client.sessionId, normalizedMessage);
    });

    this.onMessage("profile", (client, message: RaidProfileMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      if (this.verifiedPlayers.has(client.sessionId)) {
        refreshVerifiedRoomProfile({
          sessionToken: (message as Record<string, unknown>)?.sessionToken,
          sessionId: client.sessionId,
          verifiedPlayers: this.verifiedPlayers,
          player,
        });
      } else {
        this.applyProfileToPlayer(player, message, {
          allowEquipmentSync: ALLOW_GUEST_EQUIPMENT_SYNC,
          allowVitalsSync: false,
          allowStatsSync: false,
        });
        if (
          applyRoomZeroHealthState(player, {
            clearCastState: () => {
              this.pendingMovement.delete(client.sessionId);
              this.clearPlayerCastState(player);
            },
          })
        ) {
          this.statusEffects.deletePlayerEffects(player.id);
        }
      }

      const weaponProgression = normalizeItemProgressionState(
        player.weaponItem,
        message?.equipmentItemProgression?.weapon,
      );
      this.setPlayerEquipmentItemProgression(
        client.sessionId,
        weaponProgression ? { weapon: weaponProgression } : {},
      );

    });

    this.onMessage("useExit", (client, message: UseExitMessage) => {
      const normalizedMessage = normalizeUseExitMessage(message);
      if (!normalizedMessage) {
        return;
      }

      const player = this.state.players.get(client.sessionId);
      if (!player || typeof normalizedMessage.exitId !== "string") {
        return;
      }

      const [tileX, tileY] = normalizedMessage.exitId.split(":").map((value) => Number.parseInt(value, 10));
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        return;
      }

      const exitExists = this.state.exitPoints.includes(normalizedMessage.exitId);
      if (!exitExists) {
        return;
      }

      const exitWorldX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const exitWorldY = tileY * TILE_SIZE + TILE_SIZE / 2;
      const distance = Math.hypot(player.x - exitWorldX, player.y - exitWorldY);
      if (distance > TILE_SIZE * 1.5) {
        return;
      }

      const payload = this.handleSuccessfulRaidExit(player);
      this.publishPlayerProfileSnapshot({
        sessionId: client.sessionId,
        equipment: payload.equipment ?? createEquipmentStateSnapshot({}),
        equipmentItemProgression: this.getPlayerEquipmentItemProgression(client.sessionId),
        inventory: payload.inventory ?? [],
        source: "raid",
        force: true,
      });
      client.send("raidExited", {
        raidRunId: this.state.raidRunId,
        exitId: normalizedMessage.exitId,
        reason: "extracted",
        ...payload,
      });
    });

    this.onMessage("useConsumable", (client, message: UseConsumableMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.dead || player.castEndsAt > Date.now()) {
        return;
      }

      const normalizedMessage = normalizeUseConsumableMessage(message);
      if (!normalizedMessage) {
        return;
      }

      const slotIndex = normalizedMessage.slotIndex ?? -1;
      const source = normalizedMessage.source === "container" ? "container" : "inventory";
      let sourceSlots: string[] | null = null;

      if (source === "inventory") {
        sourceSlots = Array.from(player.inventory);
      } else if (normalizedMessage.containerId) {
        const chest = this.state.chests.get(normalizedMessage.containerId);
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
          } else if (normalizedMessage.containerId) {
            const chest = this.state.chests.get(normalizedMessage.containerId);
            if (chest) {
              replaceRoomStringSlots(chest.slots, nextSlots);
              this.removeChestIfEmptyLootBag(chest.id);
            }
          }
        },
        {
          mode: normalizedMessage.mode,
          targetX: normalizedMessage.targetX,
          targetY: normalizedMessage.targetY,
        },
      );
    });

    this.setSimulationInterval((deltaTime) => {
      const tickNow = Date.now();
      this.updateRaidExpiration();
      this.removeExpiredOfflinePlayers();
      const deltaSeconds = deltaTime / 1000;
      this.ensureMobSpatialGrid();
      this.updatePlayers(deltaSeconds);
      this.recordPlayerPositionHistory(tickNow);
      this.updateMobs(deltaSeconds, tickNow);
      this.updateCombatSystems(deltaSeconds, tickNow, { includeMobBurns: true });
      this.publishRaidRuntimeStateIfNeeded(tickNow);
    }, this.simulationIntervalMs);
  }

  async onDispose() {
    await this.publishRaidRuntimeStateIfNeeded(Date.now(), true);
    await this.waitForPendingPublishes();
    this.disposeShared();
  }

  private buildRaidRuntimeState() {
    return serializeRaidRuntimeState({
      status: this.state.status,
      expiresAt: this.raidExpiresAt,
      mobs: this.state.mobs.values(),
      chests: this.state.chests.values(),
      groundEffects: this.state.groundEffects.values(),
    });
  }

  private publishRaidRuntimeStateIfNeeded(now: number, force = false) {
    if (!this.state.raidRunId) {
      return null;
    }

    if (!force && now - this.lastPersistedRaidRuntimeAt < RAID_RUNTIME_PERSIST_INTERVAL_MS) {
      return null;
    }

    const runtimeState = this.buildRaidRuntimeState();
    const snapshotKey = JSON.stringify({
      status: runtimeState.status,
      expiresAt: runtimeState.expiresAt,
      mobs: runtimeState.mobs,
      chests: runtimeState.chests,
      groundEffects: runtimeState.groundEffects,
    });

    this.lastPersistedRaidRuntimeAt = now;
    if (!force && snapshotKey === this.lastPersistedRaidRuntimeKey) {
      return null;
    }

    this.lastPersistedRaidRuntimeKey = snapshotKey;
    return this.trackPendingPublish(
      this.kafkaPublisher.publish("raid.run.updated", {
        raidRunId: this.state.raidRunId,
        runtimeState,
        updatedAt: runtimeState.updatedAt,
      }),
    );
  }

  onJoin(client: Client, options: RaidRoomJoinOptions = {}, authResult?: VerifiedPlayer | boolean | null) {
    if (this.raidClosed || Date.now() >= this.raidExpiresAt) {
      throw new Error("Raid expired.");
    }

    const verified = resolveVerifiedRoomAuthResult(authResult);
    if (verified) {
      this.verifiedPlayers.set(client.sessionId, verified);
      this.setPlayerEquipmentItemProgression(client.sessionId, verified.equipmentItemProgression);
    }

    this.clearDisposeTimeout();
    const restoredPlayer = this.tryRestoreOfflinePlayer(client, options);
    if (restoredPlayer) {
      this.state.status = "active";
      return;
    }

    const spawnPosition = this.resolveJoinSpawnPosition();
    const player = new RaidPlayerState();
    player.id = client.sessionId;
    player.x = spawnPosition.x;
    player.y = spawnPosition.y;

    if (verified) {
      applyVerifiedProfile(player, verified);
    } else {
      player.name = "Raider";
      this.applyProfileToPlayer(player, options, {
        allowEquipmentSync: ALLOW_GUEST_EQUIPMENT_SYNC,
      });
    }
    initializeRoomPlayerTransientState(player);
    if (
      !verified &&
      applyRoomZeroHealthState(player, {
        clearCastState: () => {
          this.pendingMovement.delete(client.sessionId);
          this.clearPlayerCastState(player);
        },
      })
    ) {
      this.statusEffects.deletePlayerEffects(player.id);
    }

    this.state.players.set(client.sessionId, player);
    this.state.status = "active";
    sendRoomBalanceSnapshots(
      client,
      this.serializeSkillBalanceConfig(),
      this.serializeMobBalanceConfig(),
    );
  }

  onLeave(client: Client) {
    this.pendingMovement.delete(client.sessionId);
    this.skillCastSystem.clearPlayer(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.clearPlayerCastState(player);
    }
    if (this.raidClosed) {
      this.state.players.delete(client.sessionId);
      this.statusEffects.deletePlayerEffects(client.sessionId);
      this.projectileSystem.clearOwnerData(client.sessionId);
      clearRoomSessionCollections(
        client.sessionId,
        this.offlineExpiresAt,
        this.consumableCooldownEndsAt,
        this.playerLatencyMs,
        this.playerEquipmentItemProgression,
        this.verifiedPlayers,
      );
      return;
    }
    if (this.state.players.has(client.sessionId)) {
      this.offlineExpiresAt.set(client.sessionId, Date.now() + OFFLINE_PLAYER_GRACE_MS);
    }
    if (this.state.players.size === 0) {
      this.state.status = "empty";
      this.scheduleDispose();
    }
  }

  // ── Raid-specific methods ───────────────────────────────────────

  private isTutorialRaid() {
    return this.activeRaidContent.isTutorial;
  }

  private hasActiveTutorialProtection() {
    if (!this.isTutorialRaid()) {
      return false;
    }

    const tutorialMobId = this.activeRaidContent.tutorialMob?.id;
    if (!tutorialMobId) {
      return false;
    }

    const tutorialMob = this.state.mobs.get(tutorialMobId);
    return tutorialMob ? tutorialMob.dead !== true && tutorialMob.health > 0 : false;
  }

  private updatePlayers(deltaSeconds: number) {
    updateRaidPlayers(this.raidMovementContext, deltaSeconds);
  }

  private updateMobs(deltaSeconds: number, tickNow: number) {
    const raidPlayers = Array.from(this.state.players.values());
    const ratPackState = this.buildRatPackState();

    this.updateMobsShared(deltaSeconds, raidPlayers, (mob, targetPlayer, now) => {
      if (!targetPlayer && this.resolveMobKind(mob) === "rat" && ratPackState.has(mob.id)) {
        return this.getRatPackDesiredTarget(mob, ratPackState.get(mob.id)!, now);
      }
      return null;
    }, tickNow);
  }

  private resolveJoinSpawnPosition() {
    return resolveRaidJoinSpawnPosition(this.raidMovementContext, this.state.spawnPoints[0] ?? "2:2");
  }

  // ── Rat pack AI ─────────────────────────────────────────────────

  private buildRatPackState() {
    const rats = Array.from(this.state.mobs.values())
      .filter((mob) => !mob.dead && this.resolveMobKind(mob) === "rat")
      .sort((left, right) => left.id.localeCompare(right.id));
    const visited = new Set<string>();
    const packState = new Map<string, {
      leaderId: string;
      memberIndex: number;
      size: number;
      centerX: number;
      centerY: number;
    }>();

    for (const rat of rats) {
      if (visited.has(rat.id)) {
        continue;
      }

      const cluster: MobState[] = [];
      const queue = [rat];
      visited.add(rat.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        cluster.push(current);

        for (const candidate of rats) {
          if (visited.has(candidate.id)) {
            continue;
          }

          if (Math.hypot(candidate.x - current.x, candidate.y - current.y) > RAT_PACK_JOIN_DISTANCE) {
            continue;
          }

          visited.add(candidate.id);
          queue.push(candidate);
        }
      }

      const centerX = cluster.reduce((sum, member) => sum + member.x, 0) / cluster.length;
      const centerY = cluster.reduce((sum, member) => sum + member.y, 0) / cluster.length;
      const leaderId = cluster[0]?.id ?? rat.id;

      cluster.forEach((member, memberIndex) => {
        packState.set(member.id, {
          leaderId,
          memberIndex,
          size: cluster.length,
          centerX,
          centerY,
        });
      });
    }

    return packState;
  }

  private createRatPackDestination(
    centerX: number,
    centerY: number,
    now: number,
  ) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const tileX = 1 + Math.floor(Math.random() * Math.max(1, this.state.width - 2));
      const tileY = 1 + Math.floor(Math.random() * Math.max(1, this.state.height - 2));

      if (!this.isWalkableMobTile(tileX, tileY)) {
        continue;
      }

      return {
        x: tileX * TILE_SIZE + TILE_SIZE / 2,
        y: tileY * TILE_SIZE + TILE_SIZE / 2,
        expiresAt: now + RAT_PACK_ROAM_INTERVAL_MS + Math.floor(Math.random() * 1800),
      };
    }

    return {
      x: centerX,
      y: centerY,
      expiresAt: now + RAT_PACK_ROAM_INTERVAL_MS,
    };
  }

  private getRatPackDesiredTarget(
    _mob: MobState,
    packState: { leaderId: string; memberIndex: number; size: number; centerX: number; centerY: number },
    now: number,
  ) {
    let destination = this.ratPackDestinations.get(packState.leaderId);
    const packReachedDestination =
      destination &&
      Math.hypot(packState.centerX - destination.x, packState.centerY - destination.y) <=
        RAT_PACK_TARGET_REACHED_DISTANCE;

    if (!destination || destination.expiresAt <= now || packReachedDestination) {
      destination = this.createRatPackDestination(packState.centerX, packState.centerY, now);
      this.ratPackDestinations.set(packState.leaderId, destination);
    }

    const formationRadius =
      packState.size <= 1 ? 0 : Math.min(TILE_SIZE * 1.1, TILE_SIZE * 0.35 + packState.size * 1.4);
    const formationAngle = packState.size <= 1
      ? 0
      : (Math.PI * 2 * packState.memberIndex) / packState.size;

    return {
      x: destination.x + Math.cos(formationAngle) * formationRadius,
      y: destination.y + Math.sin(formationAngle) * formationRadius * 0.8,
    };
  }

  private isWalkableMobTile(tileX: number, tileY: number) {
    if (tileX < 0 || tileY < 0 || tileX >= this.state.width || tileY >= this.state.height) {
      return false;
    }

    const tileIndex = tileY * this.state.width + tileX;
    return this.blockedTiles[tileIndex] !== 1 && this.chestBlockedTiles[tileIndex] !== 1;
  }

  private getMobBalanceByKind(kind: MobKind) {
    return this.mobBalance[kind];
  }

  private resolveProceduralMobKind(
    room: { width: number; height: number },
    centerY: number,
    random: () => number,
  ): MobKind {
    const mobGeneration = this.activeRaidContent.mobGeneration;
    const batRoomEligible =
      room.height >= mobGeneration.batMinRoomHeight &&
      room.width >= mobGeneration.batMinRoomWidth;
    const batRollThreshold = centerY < this.state.height / 2
      ? Math.max(0, mobGeneration.batRandomThreshold - 0.12)
      : mobGeneration.batRandomThreshold;

    if (batRoomEligible && random() > batRollThreshold) {
      return "bat";
    }

    if (random() < mobGeneration.skeletonSpawnChance) {
      return "skeleton";
    }

    return "rat";
  }

  // ── Raid mob creation ───────────────────────────────────────────

  private createRaidMobs(seed: string, rooms: Array<{ x: number; y: number; width: number; height: number }>) {
    const tutorialMob = this.activeRaidContent.tutorialMob;
    if (tutorialMob) {
      const tutorialRoom = rooms[tutorialMob.roomIndex] ?? tutorialMob.fallbackRoom;
      const balance = this.getMobBalanceByKind(tutorialMob.kind);
      const definition = getMobDefinition(tutorialMob.kind);
      const mob = new MobState();
      mob.id = tutorialMob.id;
      mob.kind = tutorialMob.kind;
      mob.name = definition.name;
      mob.texture = definition.texture;
      mob.spawnX = (tutorialRoom.x + Math.floor(tutorialRoom.width / 2)) * TILE_SIZE + TILE_SIZE / 2;
      mob.spawnY = (tutorialRoom.y + Math.floor(tutorialRoom.height / 2)) * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolMinX = (tutorialRoom.x + tutorialMob.patrolInset) * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolMaxX = (tutorialRoom.x + tutorialRoom.width - tutorialMob.patrolInset - 1) * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolY = mob.spawnY;
      mob.patrolRadiusY = tutorialMob.patrolRadiusY;
      mob.patrolPhase = tutorialMob.patrolPhase;
      mob.x = mob.spawnX;
      mob.y = mob.spawnY;
      mob.targetX = mob.spawnX;
      mob.targetY = mob.spawnY;
      this.applyMobBalance(mob, balance);
      this.state.mobs.set(mob.id, mob);
      return;
    }

    const random = createSeededRandom(`${seed}:mobs`);
    const mobGeneration = this.activeRaidContent.mobGeneration;
    const reservedPoints = new Set([
      ...this.state.spawnPoints,
      ...this.state.exitPoints,
      ...Array.from(this.state.chests.values(), (chest) => `${chest.x}:${chest.y}`),
    ]);
    const playerSpawnWorldPoints = this.state.spawnPoints
      .map((value) => {
        const [spawnX, spawnY] = value.split(":").map((part) => Number.parseInt(part, 10));
        if (!Number.isFinite(spawnX) || !Number.isFinite(spawnY)) {
          return null;
        }
        return {
          x: spawnX * TILE_SIZE + TILE_SIZE / 2,
          y: spawnY * TILE_SIZE + TILE_SIZE / 2,
        };
      })
      .filter((point): point is { x: number; y: number } => point !== null);
    const allCandidates = rooms
      .map((room) => {
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);
        return {
          room,
          centerX,
          centerY,
        };
      })
      .filter(({ centerX, centerY }) => {
        if (reservedPoints.has(`${centerX}:${centerY}`)) {
          return false;
        }

        const centerWorldX = centerX * TILE_SIZE + TILE_SIZE / 2;
        const centerWorldY = centerY * TILE_SIZE + TILE_SIZE / 2;
        return playerSpawnWorldPoints.every((spawnPoint) =>
          Math.hypot(centerWorldX - spawnPoint.x, centerWorldY - spawnPoint.y) >= RAID_INITIAL_MOB_MIN_SPAWN_DISTANCE_PX,
        );
      });
    const candidates = allCandidates.length > 0 ? allCandidates : rooms
      .map((room) => {
        const centerX = room.x + Math.floor(room.width / 2);
        const centerY = room.y + Math.floor(room.height / 2);
        return {
          room,
          centerX,
          centerY,
        };
      })
      .filter(({ centerX, centerY }) => !reservedPoints.has(`${centerX}:${centerY}`));

    const spawnCount = Math.max(
      mobGeneration.minSpawnCount,
      Math.min(mobGeneration.maxSpawnCount, Math.floor(candidates.length * mobGeneration.spawnRatio)),
    );
    const selectedRooms = candidates
      .map((candidate) => ({
        ...candidate,
        score: random(),
      }))
      .sort((left, right) => left.score - right.score)
      .slice(0, spawnCount);

    selectedRooms.forEach(({ room, centerX, centerY }, index) => {
      const kind = this.resolveProceduralMobKind(room, centerY, random);
      const balance = this.getMobBalanceByKind(kind);
      const definition = getMobDefinition(kind);
      const mob = new MobState();
      mob.id =
        kind === "bat"
          ? `raid-bat-${index}`
          : kind === "skeleton"
            ? `raid-skeleton-${index}`
            : `raid-rat-${index}`;
      mob.kind = kind;
      mob.name = definition.name;
      mob.texture = definition.texture;
      mob.spawnX = centerX * TILE_SIZE + TILE_SIZE / 2;
      mob.spawnY = centerY * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolMinX = (room.x + 1) * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolMaxX = (room.x + room.width - 2) * TILE_SIZE + TILE_SIZE / 2;
      mob.patrolY = mob.spawnY;
      mob.patrolRadiusY = kind === "bat"
        ? Math.max(
            mobGeneration.batPatrolRadiusMin,
            (room.height - mobGeneration.batPatrolRadiusRoomHeightOffset) *
              mobGeneration.batPatrolRadiusScale,
          )
        : 0;
      mob.patrolPhase = random() * Math.PI * 2;
      mob.x = mob.spawnX;
      mob.y = mob.spawnY;
      mob.targetX = mob.spawnX;
      mob.targetY = mob.spawnY;
      this.applyMobBalance(mob, balance);
      this.state.mobs.set(mob.id, mob);
    });
  }

  // ── Raid chest creation ─────────────────────────────────────────

  private createRaidChest(seed: string, index: number, x: number, y: number, width: number, height: number) {
    const chestContent = this.activeRaidContent.chest;
    const chest = new ChestState();
    chest.id = `raid-chest-${index}-${x}-${y}`;
    chest.title = chestContent.title;
    chest.subtitle = chestContent.subtitle;
    chest.columns = chestContent.columns;
    chest.rows = chestContent.rows;
    chest.x = x;
    chest.y = y;

    if (chestContent.fixedSlots.length > 0) {
      const slots = new Array<string>(chest.columns * chest.rows).fill("");
      chestContent.fixedSlots.forEach((itemId, slotIndex) => {
        if (slotIndex < slots.length) {
          slots[slotIndex] = itemId;
        }
      });
      slots.forEach((itemId) => chest.slots.push(itemId));
      return chest;
    }

    const random = createSeededRandom(`${seed}:chest:${index}`);
    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;
    const maxCenterDistance = Math.max(1, Math.hypot(centerX, centerY));
    const normalizedDistanceToCenter = Math.min(1, Math.hypot(x - centerX, y - centerY) / maxCenterDistance);
    const centerBias = 1 - normalizedDistanceToCenter;
    const lootBand = chestContent.lootBands.find((band) => centerBias >= band.minCenterBias);
    const baseItemCount = lootBand?.itemCount ?? 0;
    const itemCount =
      baseItemCount > 0
        ? Math.max(1, Math.floor(baseItemCount / RAID_CHEST_LOOT_REDUCTION_FACTOR))
        : 0;
    const slots = new Array<string>(chest.columns * chest.rows).fill("");
    const itemPool = (lootBand?.pools ?? []).flatMap((poolId) => chestContent.lootPools[poolId] ?? []);
    const usedItems = new Set<string>();
    const nonGemItemPool = itemPool.filter((itemId) => !isGemItemId(itemId));

    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      if (itemPool.length === 0) {
        break;
      }
      let slotIndex = Math.floor(random() * slots.length);
      while (slots[slotIndex] && slots.some((value) => value === "")) {
        slotIndex = (slotIndex + 1) % slots.length;
      }
      let itemId = itemPool[Math.floor(random() * itemPool.length)];
      let guard = 0;
      while (usedItems.has(itemId) && guard < itemPool.length * 2) {
        itemId = itemPool[Math.floor(random() * itemPool.length)];
        guard += 1;
      }
      if (
        isGemItemId(itemId) &&
        nonGemItemPool.length > 0 &&
        random() > RAID_CHEST_GEM_ROLL_CHANCE
      ) {
        itemId = nonGemItemPool[Math.floor(random() * nonGemItemPool.length)] ?? itemId;
      }
      usedItems.add(itemId);
      const resolvedItemId = itemId as ItemId;
      slots[slotIndex] = RAID_UNIDENTIFIED_CONSUMABLE_ITEM_IDS.has(resolvedItemId)
        ? serializeRaidUnidentifiedInventoryItem(resolvedItemId)
        : resolvedItemId;
    }

    slots.forEach((itemId) => chest.slots.push(itemId));
    return chest;
  }

  private createQuestObjectiveChest(objectiveId: string, x: number, y: number) {
    const chestContent = this.activeRaidContent.questObjectiveChest;
    const chest = new ChestState();
    chest.id = `raid-quest-${objectiveId}-${x}-${y}`;
    chest.title = chestContent.title;
    chest.subtitle = chestContent.subtitle;
    chest.columns = chestContent.columns;
    chest.rows = chestContent.rows;
    chest.x = x;
    chest.y = y;

    const slots = new Array<string>(chest.columns * chest.rows).fill("");
    chestContent.fixedSlots.forEach((itemId, slotIndex) => {
      if (slotIndex < slots.length) {
        slots[slotIndex] = itemId;
      }
    });
    slots.forEach((itemId) => chest.slots.push(itemId));
    return chest;
  }

  // ── Raid expiration & exit ──────────────────────────────────────

  private updateRaidExpiration() {
    if (this.raidClosed || this.isTutorialRaid() || Date.now() < this.raidExpiresAt) {
      return;
    }

    this.raidClosed = true;
    this.state.status = "expired";
    this.autoDispose = true;

    for (const [sessionId, player] of this.state.players.entries()) {
      const payload = this.handleFailedRaidExit(player);
      const client = this.clients.find((entry) => entry.sessionId === sessionId);
      client?.send("raidExpired", {
        raidRunId: this.state.raidRunId,
        reason: "expired",
        ...payload,
      });
    }

    this.pendingMovement.clear();
    this.skillCastSystem.clearAll();
    this.statusEffects.clearAll();
    this.consumableCooldownEndsAt.clear();
    this.offlineExpiresAt.clear();
    this.publishRaidRuntimeStateIfNeeded(Date.now(), true);
    this.clearDisposeTimeout();
    setTimeout(() => {
      this.state.players.clear();
      this.state.projectiles.clear();
      this.state.groundEffects.clear();
      void this.disconnect();
    }, 1000);
  }

  private handleRaidPlayerDeath(player: RaidPlayerState) {
    if (player.dead) {
      return;
    }

    const payload = this.handleFailedRaidExit(player);
    const client = this.clients.find((entry) => entry.sessionId === player.id);
    client?.send("raidExited", {
      raidRunId: this.state.raidRunId,
      reason: "defeated",
      ...payload,
    });
  }

  private createRaidExitPayload(player: RaidPlayerState): RaidExitStateMessage {
    const inventory = identifyAllRaidUnidentifiedInventoryEntries(
      Array.from({ length: INVENTORY_SIZE }, (_, index) => player.inventory[index] || null),
    ).map((entry) => entry || null);
    const equipment = createEquipmentStateSnapshot({
      headItem: player.headItem,
      bodyItem: player.bodyItem,
      weaponItem: player.weaponItem,
      headGemItem1: player.headGemItem1,
      headGemItem2: player.headGemItem2,
      headGemItem3: player.headGemItem3,
      bodyGemItem1: player.bodyGemItem1,
      bodyGemItem2: player.bodyGemItem2,
      bodyGemItem3: player.bodyGemItem3,
      weaponGemItem1: player.weaponGemItem1,
      weaponGemItem2: player.weaponGemItem2,
      weaponGemItem3: player.weaponGemItem3,
    });

    return {
      health: player.health,
      maxHealth: player.maxHealth,
      level: player.level,
      experience: player.experience,
      equipment,
      inventory,
    };
  }

  private removePlayerFromRaidState(playerId: string) {
    this.pendingMovement.delete(playerId);
    this.skillCastSystem.clearPlayer(playerId);
    this.offlineExpiresAt.delete(playerId);
    this.statusEffects.deletePlayerEffects(playerId);
    this.consumableCooldownEndsAt.delete(playerId);
    this.clearPlayerEquipmentItemProgression(playerId);
    this.state.players.delete(playerId);
  }

  private handleSuccessfulRaidExit(player: RaidPlayerState) {
    const payload = this.createRaidExitPayload(player);
    player.burnTicksRemaining = 0;
    player.burnEndsAt = 0;
    player.poisonTicksRemaining = 0;
    player.poisonEndsAt = 0;
    player.healingTicksRemaining = 0;
    player.healingEndsAt = 0;
    player.fireballCooldownEndsAt = 0;
    player.fireNovaCooldownEndsAt = 0;
    player.fireFieldCooldownEndsAt = 0;
    player.woodStaffStrikeCooldownEndsAt = 0;
    player.woodStaffDashCooldownEndsAt = 0;
    this.clearPlayerCastState(player);
    this.removePlayerFromRaidState(player.id);
    this.publishRaidRuntimeStateIfNeeded(Date.now(), true);
    return payload;
  }

  private handleFailedRaidExit(player: RaidPlayerState) {
    const preservedHealth = 0;
    const preservedMaxHealth = player.maxHealth;
    const preservedLevel = player.level;
    const preservedExperience = player.experience;
    const inventory = Array.from({ length: INVENTORY_SIZE }, () => null as string | null);
    const equipment = {
      head: "",
      body: "",
      weapon: "",
      "head-gem-1": "",
      "head-gem-2": "",
      "head-gem-3": "",
      "body-gem-1": "",
      "body-gem-2": "",
      "body-gem-3": "",
      "weapon-gem-1": "",
      "weapon-gem-2": "",
      "weapon-gem-3": "",
    };
    this.createDroppedLootChest(player);
    player.dead = true;
    player.health = 0;
    player.burnTicksRemaining = 0;
    player.burnEndsAt = 0;
    player.poisonTicksRemaining = 0;
    player.poisonEndsAt = 0;
    player.healingTicksRemaining = 0;
    player.healingEndsAt = 0;
    player.fireballCooldownEndsAt = 0;
    player.fireNovaCooldownEndsAt = 0;
    player.fireFieldCooldownEndsAt = 0;
    player.woodStaffStrikeCooldownEndsAt = 0;
    player.woodStaffDashCooldownEndsAt = 0;
    this.clearPlayerCastState(player);
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
    player.inventory.clear();
    this.pendingMovement.delete(player.id);
    this.skillCastSystem.clearPlayer(player.id);
    this.offlineExpiresAt.delete(player.id);
    this.statusEffects.deletePlayerEffects(player.id);
    this.consumableCooldownEndsAt.delete(player.id);
    this.clearPlayerEquipmentItemProgression(player.id);
    this.publishRaidRuntimeStateIfNeeded(Date.now(), true);

    return {
      health: preservedHealth,
      maxHealth: preservedMaxHealth,
      level: preservedLevel,
      experience: preservedExperience,
      equipment,
      inventory,
    };
  }

  private createDroppedLootChest(player: RaidPlayerState) {
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
      ...player.inventory,
    ].filter((itemId) => {
      return parseRoomInventoryEntry(itemId) !== null;
    });

    if (droppedItems.length === 0) {
      return;
    }

    const tileX = Math.max(0, Math.min(this.state.width - 1, Math.floor(player.x / TILE_SIZE)));
    const tileY = Math.max(0, Math.min(this.state.height - 1, Math.floor(player.y / TILE_SIZE)));
    const chest = new ChestState();
    chest.id = `raid-loot-bag-${player.id}-${Date.now()}`;
    chest.title = "Loot Bag";
    chest.subtitle = "Dropped Loot";
    chest.columns = 6;
    chest.rows = 5;
    chest.x = tileX;
    chest.y = tileY;

    for (let index = 0; index < chest.columns * chest.rows; index += 1) {
      chest.slots.push(droppedItems[index] ?? "");
    }

    this.state.chests.set(chest.id, chest);
    this.chestBlockedTiles[tileY * this.state.width + tileX] = 1;
  }

  // ── Offline players ─────────────────────────────────────────────

  private tryRestoreOfflinePlayer(client: Client, options: RaidRoomJoinOptions) {
    const nextName = options.name?.trim().slice(0, 24);
    const verified = this.verifiedPlayers.get(client.sessionId) ?? null;
    const verifiedPlayerId = verified?.id ?? null;
    if (!nextName && !verifiedPlayerId) {
      return null;
    }

    for (const [previousSessionId, player] of this.state.players.entries()) {
      if (previousSessionId === client.sessionId) {
        continue;
      }

      const expiresAt = this.offlineExpiresAt.get(previousSessionId);
      const previousVerified = this.verifiedPlayers.get(previousSessionId);
      const sameVerifiedPlayer = verifiedPlayerId !== null && previousVerified?.id === verifiedPlayerId;
      const sameOfflineGuestName =
        !sameVerifiedPlayer && expiresAt !== undefined && expiresAt > Date.now() && nextName !== undefined && player.name === nextName;
      if (!sameVerifiedPlayer && !sameOfflineGuestName) {
        continue;
      }

      this.clients.find((entry) => entry.sessionId === previousSessionId)?.leave(4000);
      this.state.players.delete(previousSessionId);
      clearRoomSessionCollections(
        previousSessionId,
        this.offlineExpiresAt,
        this.pendingMovement,
      );
      this.skillCastSystem.clearPlayer(previousSessionId);
      moveRoomMapValue(this.consumableCooldownEndsAt, previousSessionId, client.sessionId);
      moveRoomMapValue(this.playerLatencyMs, previousSessionId, client.sessionId);
      moveRoomMapValue(this.playerEquipmentItemProgression, previousSessionId, client.sessionId);
      moveRoomMapValue(this.verifiedPlayers, previousSessionId, client.sessionId);
      if (verified) {
        this.verifiedPlayers.set(client.sessionId, verified);
      }
      this.statusEffects.movePlayerEffects(previousSessionId, client.sessionId);
      player.id = client.sessionId;
      this.state.players.set(client.sessionId, player);
      this.clearPlayerCastState(player);
      if (!this.verifiedPlayers.has(client.sessionId)) {
        this.applyProfileToPlayer(player, options, {
          allowEquipmentSync: ALLOW_GUEST_EQUIPMENT_SYNC,
        });
      }
      if (
        applyRoomZeroHealthState(player, {
          clearCastState: () => {
            this.pendingMovement.delete(client.sessionId);
            this.clearPlayerCastState(player);
          },
        })
      ) {
        this.statusEffects.deletePlayerEffects(player.id);
      } else {
        player.dead = false;
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

  private removeExpiredOfflinePlayers() {
    const now = Date.now();

    for (const [sessionId, expiresAt] of this.offlineExpiresAt.entries()) {
      if (expiresAt > now) {
        continue;
      }

      this.statusEffects.deletePlayerEffects(sessionId);
      this.projectileSystem.clearOwnerData(sessionId);
      clearRoomSessionCollections(
        sessionId,
        this.offlineExpiresAt,
        this.pendingMovement,
        this.consumableCooldownEndsAt,
        this.playerLatencyMs,
        this.playerEquipmentItemProgression,
        this.verifiedPlayers,
      );
      this.skillCastSystem.clearPlayer(sessionId);
      this.state.players.delete(sessionId);
    }

    if (this.state.players.size === 0 && !this.disposeTimeout) {
      this.scheduleDispose();
    }
  }

  private scheduleDispose() {
    this.clearDisposeTimeout();
    this.disposeTimeout = setTimeout(() => {
      this.autoDispose = true;
      void this.disconnect();
    }, OFFLINE_PLAYER_GRACE_MS);
  }

  private clearDisposeTimeout() {
    if (this.disposeTimeout) {
      clearTimeout(this.disposeTimeout);
      this.disposeTimeout = null;
    }
  }

  // ── Profile ─────────────────────────────────────────────────────

  private applyProfileToPlayer(
    player: RaidPlayerState,
    profile: RaidProfileMessage | RaidRoomJoinOptions,
    options: {
      allowEquipmentSync?: boolean;
      allowVitalsSync?: boolean;
      allowStatsSync?: boolean;
    } = {},
  ) {
    applyRoomProfilePatch(player, profile, {
      defaultName: "Raider",
      allowEquipmentSync: options.allowEquipmentSync,
      allowVitalsSync: options.allowVitalsSync,
      allowStatsSync: options.allowStatsSync,
      defaultWeaponItem: "wood_staff",
    });
    replaceRoomStringSlots(
      player.inventory,
      normalizeRoomInventorySlots(profile.inventory ?? [], INVENTORY_SIZE),
    );
  }
}
