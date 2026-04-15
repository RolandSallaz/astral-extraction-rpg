import { Client, Room } from "colyseus";
import {
  cloneMobBalanceConfig,
  cloneSkillBalanceConfig,
  createDefaultItemFireResistanceMap,
  DEFAULT_MOB_BALANCE_CONFIG,
  DEFAULT_SKILL_BALANCE_CONFIG,
  type EquipmentState,
  type InventoryState,
  type MobBalanceSection,
  type QuestLog,
  type SkillBalanceConfig,
  type CastSkillMessage,
  type SyncChestMessage,
} from "@mmorpg/shared";
import { type MobKind } from "@mmorpg/shared/mobs/catalog";
import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { type ArmorGemCarrier } from "./armorGems.js";
import { createSkillHandlers, type SkillCastContext } from "./skills/index.js";
import { type MobPathCacheEntry } from "./mobPathing.js";
import { buildFireballCastPlan, type DamageType } from "./projectileSkills.js";
import { awardExperience as awardSharedExperience } from "./sharedGameplay.js";
import {
  verifySessionToken,
  type VerifiedPlayer,
} from "./auth.js";
import { SpatialGrid } from "./services/SpatialGrid.js";
import { ContentSnapshotPoller } from "./services/ContentSnapshotPoller.js";
import { canCastSkill, type SkillId } from "@mmorpg/shared/skills/registry";
import {
  applyRoomProjectileLifesteal,
  canRoomProjectileLeaveTrail,
  canRoomProjectileShatter,
  getRoomOwnerProjectileGemConfig,
  getRoomPlayerCastTimeMs,
  getRoomProjectileBounceCount,
  getRoomProjectileDamageScale,
  getRoomProjectileDirectDamage,
  getRoomProjectileRangeMultiplier,
  getRoomSkillBalanceKey,
  getRoomSkillDirectDamage,
  getRoomSkillBurnDamage,
  hasRoomSplitProjectileGem,
  isRoomProjectileReturningEnabled,
} from "./runtime/skillRuntime.js";
import {
  findNearestRoomProjectileTarget,
  queryNearbyRoomEntities,
  rebuildRoomSpatialGrid,
} from "./runtime/spatialRuntime.js";
import {
  createFireField as createFireFieldRuntime,
  createFireTrail as createFireTrailRuntime,
} from "./runtime/groundEffectsRuntime.js";
import { clampTargetToCastRange as clampTargetToCastRangeRuntime } from "./runtime/castRuntime.js";
import {
  handleSyncChest as handleSyncChestRuntime,
  removeChestIfEmptyLootBag as removeChestIfEmptyLootBagRuntime,
} from "./runtime/chestRuntime.js";
import {
  handleUseConsumable as handleUseConsumableRuntime,
  type ConsumableRuntimeContext,
} from "./runtime/consumableRuntime.js";
import {
  updateRoomMobs,
  canMobMoveTo as canMobMoveToRuntime,
  handleMobDeath as handleMobDeathRuntime,
  type MobRuntimeContext,
} from "./runtime/mobRuntime.js";
import {
  performWoodStaffStrike as performWoodStaffStrikeRuntime,
  type WoodStaffStrikeContext,
} from "./runtime/woodStaffStrikeRuntime.js";
import {
  updateRoomProjectiles,
  spawnProjectile as spawnProjectileRuntime,
  deleteProjectile as deleteProjectileRuntime,
  type ProjectileRuntimeContext,
} from "./runtime/projectileRuntime.js";
import {
  applyBackendItemBalance as applyBackendItemBalanceRuntime,
  applyBackendMobBalance as applyBackendMobBalanceRuntime,
  applyBackendSkillBalance as applyBackendSkillBalanceRuntime,
  applyMobBalance as applyMobBalanceRuntime,
  applyMobBalanceToLiveMobs as applyMobBalanceToLiveMobsRuntime,
  getMobBalanceForMob as getMobBalanceForMobRuntime,
  resolveMobKind as resolveMobKindRuntime,
  serializeMobBalanceConfig as serializeMobBalanceConfigRuntime,
  serializeSkillBalanceConfig as serializeSkillBalanceConfigRuntime,
} from "./runtime/balanceRuntime.js";
import type { BasePlayerState } from "./schema/BasePlayerState.js";
import type { MobState } from "./schema/MobState.js";
import { ChestState } from "./schema/ChestState.js";
import { GroundEffectState } from "./schema/GroundEffectState.js";
import { type ProjectileState, type ProjectileServerData } from "./schema/ProjectileState.js";
import { applyDamageToPlayer as applyDamageToPlayerService } from "./services/CombatService.js";
import { SkillCastSystem } from "./systems/SkillCastSystem.js";
import { StatusEffectSystem } from "./systems/StatusEffectSystem.js";
import { ProjectileSystem } from "./systems/ProjectileSystem.js";
import { LagCompensationTracker } from "./systems/LagCompensationTracker.js";
import { pushTargetByKnockback as pushTargetByKnockbackRuntime } from "./runtime/knockbackRuntime.js";
import { broadcastDamageText as broadcastDamageTextRuntime } from "./runtime/messageRuntime.js";
import {
  getPlayerPositionAt as getPlayerPositionAtRuntime,
  recordPlayerPositionHistory as recordPlayerPositionHistoryRuntime,
  resolveLagCompensatedCastTiming as resolveLagCompensatedCastTimingRuntime,
  type LagCompensatedCastTiming,
} from "./runtime/lagRuntime.js";
import {
  normalizeCastSkillMessage,
  normalizeContentVersion,
  normalizeSyncChestMessage,
} from "./runtime/messageValidation.js";
import { getRealtimeServices } from "../services/runtimeServices.js";

// Re-export types subclasses need
export type { DamageType } from "./projectileSkills.js";
export type { VerifiedPlayer } from "./auth.js";
export type { MobPathCacheEntry } from "./mobPathing.js";
export type { SkillId } from "@mmorpg/shared/skills/registry";


/**
 * Abstract base class that contains the shared game engine used by
 * both the world room and the raid room.  Subclasses provide concrete
 * state access (players/mobs/chests/etc.) and room-specific behaviour
 * (movement model, death handling, chat, map topology).
 *
 * The player map is typed as `MapSchema<any>` because the concrete
 * player type differs between rooms (PlayerState vs RaidPlayerState).
 * All shared methods only access BasePlayerState fields which are
 * present on both.
 */
export abstract class BaseGameRoom<TPlayer extends BasePlayerState = BasePlayerState> extends Room {
  // ── Gameplay profile (subclass picks world vs raid) ──────────────
  protected abstract get profile(): RoomGameplayProfile;
  protected get simulationIntervalMs() {
    return 1000 / this.profile.networkTickRate;
  }

  // ── State access ─────────────────────────────────────────────────
  protected abstract get roomPlayers(): MapSchema<TPlayer>;
  protected abstract get roomMobs(): MapSchema<MobState>;
  protected abstract get roomChests(): MapSchema<ChestState>;
  protected abstract get roomGroundEffects(): MapSchema<GroundEffectState>;
  protected abstract get roomProjectiles(): MapSchema<ProjectileState>;

  // ── Map topology ─────────────────────────────────────────────────
  protected abstract isBlockedTile(tileX: number, tileY: number): boolean;
  protected abstract getMapWidthPx(): number;
  protected abstract getMapHeightPx(): number;
  protected abstract getMapWidthTiles(): number;
  protected abstract getMapHeightTiles(): number;

  // ── Room-specific behaviour hooks ────────────────────────────────
  /** Called when a player's health drops to zero. */
  protected abstract handlePlayerKilled(player: BasePlayerState): void;
  /** Push a combat-related text message (world broadcasts chat, raid may no-op). */
  protected abstract onCombatLog(text: string): void;
  /** Clear movement state for a player (world resets moveX/Y, raid deletes pending). */
  protected abstract clearPlayerMovement(sessionId: string): void;
  /** Whether a position is walkable for teleport scroll landing. */
  protected abstract canTeleportTo(x: number, y: number, playerId: string): boolean;
  /** Execute teleportation after scroll cast completes. */
  protected abstract performTeleportScroll(playerId: string, player: BasePlayerState): void;

  // ── Shared services ──────────────────────────────────────────────
  protected readonly skillBalance = cloneSkillBalanceConfig(DEFAULT_SKILL_BALANCE_CONFIG);
  protected readonly mobBalance = cloneMobBalanceConfig(DEFAULT_MOB_BALANCE_CONFIG);
  protected readonly statusEffects = new StatusEffectSystem({
    getProfile: () => this.profile,
    getSkillBalance: () => this.skillBalance,
    getPlayer: (playerId) => this.getPlayer(playerId),
    getMob: (mobId) => this.roomMobs.get(mobId),
    getPlayers: () => this.roomPlayers.values(),
    getMobs: () => this.roomMobs.values(),
    getGroundEffects: () => this.roomGroundEffects,
    applyDamageToPlayer: (player, amount, damageType) => this.applyDamageToPlayer(player, amount, damageType),
    handlePlayerKilled: (player) => this.handlePlayerKilled(player),
    handleMobDeath: (mob) => this.handleMobDeath(mob),
    onCombatLog: (text) => this.onCombatLog(text),
    showHealingText: (x, y, amount) => this.broadcastHealingText(x, y, amount),
    awardExperience: (playerId, amount) => this.awardExperience(playerId, amount),
    getOwnerProjectileGemConfig: (ownerId) => this.getOwnerProjectileGemConfig(ownerId, "fireball"),
  });
  protected readonly projectileSystem = new ProjectileSystem({
    getProfile: () => this.profile,
    getPlayer: (playerId) => this.getPlayer(playerId),
    getPlayers: () => this.roomPlayers.values(),
    getMobs: () => this.roomMobs.values(),
    spawnProjectile: (
      ownerId,
      skillId,
      x,
      y,
      directionX,
      directionY,
      lifetime,
      damageScale,
      sizeScale,
    ) => this.spawnProjectile(ownerId, skillId, x, y, directionX, directionY, lifetime, damageScale, sizeScale),
    updateProjectiles: (deltaSeconds, now) => this.updateProjectilesShared(deltaSeconds, now),
    applyDamageToPlayer: (player, amount, damageType) => this.applyDamageToPlayer(player, amount, damageType),
    handlePlayerKilled: (player) => this.handlePlayerKilled(player),
    handleMobDeath: (mob) => this.handleMobDeath(mob),
    awardExperience: (playerId, amount) => this.awardExperience(playerId, amount),
  });
  protected readonly skillCastSystem = new SkillCastSystem();
  protected readonly lagCompensationTracker = new LagCompensationTracker<BasePlayerState>();
  protected readonly projectileHitHistory = new Map<string, Set<string>>();
  protected readonly projectileServerData = new Map<string, ProjectileServerData>();
  protected readonly consumableCooldownEndsAt = new Map<string, number>();
  protected readonly playerLatencyMs = new Map<string, number>();
  protected readonly mobPathCache = new Map<string, MobPathCacheEntry>();
  protected readonly losCache = new Map<string, boolean>();
  protected readonly itemFireResistance = createDefaultItemFireResistanceMap();
  protected readonly mobSkillHitTargets = new Map<string, Set<string>>();
  protected readonly playerSpatialGrid = new SpatialGrid<BasePlayerState>(64);
  protected readonly mobSpatialGrid = new SpatialGrid<MobState>(64);
  protected readonly playerSpatialOrder = new Map<string, number>();
  protected readonly mobSpatialOrder = new Map<string, number>();
  protected currentContentVersion = "";
  protected readonly contentSnapshotPoller = new ContentSnapshotPoller({
    onSnapshot: (snapshot) => {
      this.currentContentVersion = snapshot.version;
      this.applyBackendSkillBalance(snapshot.skillBalance);
      this.applyBackendMobBalance(snapshot.mobBalance);
      this.applyBackendItemBalance(snapshot.itemBalance);
    },
  });
  protected readonly kafkaPublisher = getRealtimeServices().kafkaPublisher;
  protected readonly verifiedPlayers = new Map<string, VerifiedPlayer>();
  protected readonly skillHandlers = createSkillHandlers();
  private readonly pendingPublishes = new Set<Promise<void>>();
  private readonly lastPersistedProfileSnapshots = new Map<string, string>();
  private mobSpatialDirty = true;

  // ── Auth (identical in both rooms) ───────────────────────────────
  protected async validateContentVersion(options?: Record<string, unknown>) {
    const clientVersion = normalizeContentVersion(options?.contentVersion);
    await this.contentSnapshotPoller.ensureLoaded();
    const serverVersion = this.currentContentVersion || this.contentSnapshotPoller.getCurrentVersion();

    if (!serverVersion) {
      throw new Error("Realtime content snapshot is unavailable.");
    }

    if (!clientVersion) {
      if (process.env.NODE_ENV !== "production") {
        return;
      }
      throw new Error(`Missing content version. Expected ${serverVersion}.`);
    }

    if (clientVersion !== serverVersion) {
      throw new Error(`Content version mismatch. Client=${clientVersion} Server=${serverVersion}.`);
    }
  }

  protected async verifyAuth(options?: Record<string, unknown>) {
    await this.validateContentVersion(options);
    const sessionToken = options?.sessionToken as string | undefined;
    try {
      return await verifySessionToken(sessionToken);
    } catch {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Authentication required");
      }
      return true;
    }
  }

  // ── Dispose (identical in both rooms) ────────────────────────────
  protected disposeShared() {
    this.contentSnapshotPoller.stop();
    this.statusEffects.clearAll();
    this.projectileSystem.clearAll();
    this.skillCastSystem.clearAll();
    this.playerSpatialGrid.clear();
    this.mobSpatialGrid.clear();
    this.lagCompensationTracker.clearAll();
    this.projectileServerData.clear();
    this.mobSkillHitTargets.clear();
  }

  protected trackPendingPublish(task: Promise<void>) {
    let trackedTask: Promise<void>;
    trackedTask = task.finally(() => {
      this.pendingPublishes.delete(trackedTask);
    });
    this.pendingPublishes.add(trackedTask);
    return trackedTask;
  }

  protected async waitForPendingPublishes() {
    if (this.pendingPublishes.size === 0) {
      return;
    }

    await Promise.allSettled(Array.from(this.pendingPublishes));
  }

  // ── Shared message handlers ──────────────────────────────────────
  protected registerSharedMessageHandlers() {
    this.onMessage("syncChest", (_client: Client, message: SyncChestMessage) => {
      const normalizedMessage = normalizeSyncChestMessage(message);
      if (!normalizedMessage) {
        return;
      }

      handleSyncChestRuntime(this.roomChests, normalizedMessage);
    });

    this.onMessage("castSkill", (client: Client, message: CastSkillMessage) => {
      this.handleCastSkillMessage(client.sessionId, message);
    });
  }

  protected updateCombatSystems(
    deltaSeconds: number,
    now: number,
    options: { includeMobBurns?: boolean } = {},
  ) {
    this.skillCastSystem.update(now, {
      getPlayer: (playerId) => this.getPlayer(playerId),
      getSkillHandler: (skillId) => this.skillHandlers.get(skillId),
      createSkillCastContext: (playerId, player, castNow) =>
        this.createSkillCastContext(playerId, player, castNow),
      clearPlayerCastState: (player) => this.clearPlayerCastState(player),
      performTeleportScroll: (playerId, player) => this.performTeleportScroll(playerId, player),
    });
    this.statusEffects.update(now, { includeMobBurns: options.includeMobBurns });
    this.projectileSystem.update(deltaSeconds, now);
  }

  // ── Skill casting ────────────────────────────────────────────────
  protected handleCastSkillMessage(
    sessionId: string,
    message: CastSkillMessage,
  ) {
    const normalizedMessage = normalizeCastSkillMessage(message);
    if (!normalizedMessage) {
      return;
    }

    const skillId = normalizedMessage.skillId ?? "";
    const player = this.getPlayer(sessionId);
    if (!player || player.dead || !canCastSkill(skillId, player.weaponItem)) {
      return;
    }

    const now = Date.now();
    if (player.castEndsAt > now) {
      return;
    }

    const handler = this.skillHandlers.get(skillId);
    if (!handler) {
      return;
    }

    if (handler.getCooldownEndsAt(player) > now) {
      return;
    }

    const lagCompensation = resolveLagCompensatedCastTimingRuntime(this.profile, normalizedMessage, now);
    const ctx = this.createSkillCastContext(sessionId, player, now, lagCompensation);

    let targetX = player.x;
    let targetY = player.y;
    if (handler.needsTarget) {
      const requestedTargetX = normalizedMessage.targetX ?? player.x;
      const requestedTargetY = normalizedMessage.targetY ?? player.y;
      if (skillId === "woodStaffStrike") {
        const originX = player.x;
        const originY = player.y - this.profile.playerHitRadius;
        const deltaX = requestedTargetX - originX;
        const deltaY = requestedTargetY - originY;
        const distance = Math.hypot(deltaX, deltaY);
        const upRangeBonus = 24;
        const downRangePenalty = 16;
        const maxRange =
          this.profile.meleeStrikeRange +
          (deltaY < 0 ? upRangeBonus : deltaY > 0 ? -downRangePenalty : 0);
        if (distance > 0.001 && distance > maxRange) {
          const scale = maxRange / distance;
          targetX = originX + deltaX * scale;
          targetY = originY + deltaY * scale;
        } else {
          targetX = requestedTargetX;
          targetY = requestedTargetY;
        }
      } else {
        const clamped = clampTargetToCastRangeRuntime(this.profile, player, player.x, player.y, requestedTargetX, requestedTargetY);
        targetX = clamped.x;
        targetY = clamped.y;
      }
    }

    if (handler.canPerform && !handler.canPerform(ctx, targetX, targetY)) {
      return;
    }

    handler.setCooldownEndsAt(player, now + handler.getCooldownMs(ctx));
    const castTimeMs = handler.getCastTimeMs ? handler.getCastTimeMs(ctx) : this.getPlayerCastTimeMs(player);

    if (castTimeMs > 0) {
      player.castingSkillId = skillId;
      player.castStartedAt = now;
      player.castEndsAt = now + castTimeMs;
      this.clearPlayerMovement(sessionId);
      this.skillCastSystem.queueSkillCast(sessionId, {
        skillId: skillId as SkillId,
        targetX,
        targetY,
      });
    } else {
      const postCastLockMs = handler.performCast(ctx, targetX, targetY);
      if (postCastLockMs > 0) {
        player.castingSkillId = skillId;
        player.castStartedAt = now;
        player.castEndsAt = now + postCastLockMs;
      }
    }
  }

  protected createSkillCastContext(
    sessionId: string,
    player: BasePlayerState,
    now: number,
    lagCompensation: LagCompensatedCastTiming = { at: now, enabled: false },
  ): SkillCastContext {
    return {
      sessionId,
      player,
      profile: this.profile,
      now,
      lagCompensatedAt: lagCompensation.at,
      lagCompensationEnabled: lagCompensation.enabled,
      getPlayerCastTimeMs: (p) => this.getPlayerCastTimeMs(p),
      clampTargetToCastRange: (p, ox, oy, tx, ty) => clampTargetToCastRangeRuntime(this.profile, p, ox, oy, tx, ty),
      clearPlayerMovement: (sid) => this.clearPlayerMovement(sid),
      performWoodStaffStrike: (p, tx, ty) =>
        this.performWoodStaffStrike(sessionId, p, tx, ty, lagCompensation.at, lagCompensation.enabled),
      getOwnerProjectileGemConfig: (oid, sid) => this.getOwnerProjectileGemConfig(oid, sid),
      hasSplitProjectileGem: (oid) => this.hasSplitProjectileGem(oid),
      spawnProjectile: (oid, sid, x, y, dx, dy, lt, ds, ss) =>
        this.spawnProjectile(oid, sid, x, y, dx, dy, lt, ds, ss),
      queueBurstSpawns: (bursts) => this.projectileSystem.queueBurstSpawns(bursts),
      createFireField: (p, tx, ty, n) => this.createFireField(p, tx, ty, n),
    };
  }

  // ── Consumables ──────────────────────────────────────────────────
  protected handleUseConsumableShared(
    sessionId: string,
    player: BasePlayerState,
    sourceSlots: string[],
    slotIndex: number,
    commitSlots: (nextSlots: string[]) => void,
    options: { mode?: "self" | "throw"; targetX?: number; targetY?: number } = {},
  ) {
    handleUseConsumableRuntime(this.consumableContext(), sessionId, player, sourceSlots, slotIndex, commitSlots, options);
  }

  private consumableContext(): ConsumableRuntimeContext {
    return {
      profile: this.profile,
      consumableCooldownEndsAt: this.consumableCooldownEndsAt,
      statusEffects: this.statusEffects,
      skillCastSystem: this.skillCastSystem,
      roomPlayers: this.roomPlayers as unknown as ConsumableRuntimeContext["roomPlayers"],
      clients: this.clients,
      getMapWidthPx: () => this.getMapWidthPx(),
      getMapHeightPx: () => this.getMapHeightPx(),
      clearPlayerMovement: (sid) => this.clearPlayerMovement(sid),
    };
  }

  // ── SyncChest (identical in both rooms) ──────────────────────────
  protected removeChestIfEmptyLootBag(chestId: string) {
    removeChestIfEmptyLootBagRuntime(this.roomChests, chestId);
  }

  protected publishPlayerProfileSnapshot(options: {
    sessionId: string;
    equipment: EquipmentState;
    inventory: InventoryState;
    gold?: number;
    quests?: QuestLog;
    source: "world" | "raid";
    force?: boolean;
  }) {
    const verified = this.verifiedPlayers.get(options.sessionId);
    if (!verified) {
      return;
    }

    const snapshotKey = JSON.stringify({
      equipment: options.equipment,
      inventory: options.inventory,
      gold: options.gold,
      quests: options.quests,
    });
    if (!options.force && this.lastPersistedProfileSnapshots.get(verified.id) === snapshotKey) {
      return;
    }

    this.lastPersistedProfileSnapshots.set(verified.id, snapshotKey);
    void this.trackPendingPublish(
      this.kafkaPublisher.publish("player.profile.updated", {
        playerId: verified.id,
        equipment: options.equipment,
        inventory: options.inventory,
        gold: options.gold,
        quests: options.quests,
        source: options.source,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  // ── Pending cast resolution ──────────────────────────────────────
  protected isEntityOnGroundEffect(x: number, y: number, effect: GroundEffectState) {
    const tileSize = this.profile.tileSize;
    return Math.abs(x - effect.x) <= tileSize / 2 && Math.abs(y - effect.y) <= tileSize / 2;
  }

  // ── Mob AI loop ──────────────────────────────────────────────────
  protected updateMobsShared(
    deltaSeconds: number,
    players: BasePlayerState[],
    getDesiredTarget?: (mob: MobState, targetPlayer: BasePlayerState | null, now: number) => { x: number; y: number } | null,
    now = Date.now(),
  ) {
    updateRoomMobs(this.mobContext(), deltaSeconds, players, getDesiredTarget, now);
  }

  private mobContext(): MobRuntimeContext {
    return {
      state: {
        profile: this.profile,
        roomMobs: this.roomMobs,
        roomChests: this.roomChests,
        mobSpatialGrid: this.mobSpatialGrid,
        mobSpatialOrder: this.mobSpatialOrder,
        mobPathCache: this.mobPathCache,
        losCache: this.losCache,
        mobSkillHitTargets: this.mobSkillHitTargets,
        statusEffects: this.statusEffects,
        resolveMobKind: (mob) => this.resolveMobKind(mob),
      },
      spatial: {
        getMapWidthPx: () => this.getMapWidthPx(),
        getMapHeightPx: () => this.getMapHeightPx(),
        getMapWidthTiles: () => this.getMapWidthTiles(),
        getMapHeightTiles: () => this.getMapHeightTiles(),
        isBlockedTile: (tx, ty) => this.isBlockedTile(tx, ty),
        canTeleportTo: (x, y, pid) => this.canTeleportTo(x, y, pid),
        getPlayerPositionAt: (playerId, at) => this.getPlayerPositionAt(playerId, at),
        getPlayerLatencyMs: (playerId) => this.playerLatencyMs.get(playerId) ?? 0,
        ensureMobSpatialGrid: () => this.ensureMobSpatialGrid(),
        markMobSpatialDirty: () => this.markMobSpatialDirty(),
      },
      combat: {
        applyDamageToPlayer: (player, amount, dt) => this.applyDamageToPlayer(player, amount, dt),
        handlePlayerKilled: (player) => this.handlePlayerKilled(player),
        onCombatLog: (text) => this.onCombatLog(text),
      },
    };
  }

  protected canMobMoveTo(x: number, y: number, mobId: string) {
    return canMobMoveToRuntime(this.mobContext(), x, y, mobId);
  }

  protected performWoodStaffStrike(
    ownerId: string,
    player: BasePlayerState,
    targetX: number,
    targetY: number,
    lagCompensatedAt = Date.now(),
    lagCompensationEnabled = false,
  ) {
    performWoodStaffStrikeRuntime(
      this.woodStaffStrikeContext(),
      ownerId,
      player,
      targetX,
      targetY,
      lagCompensatedAt,
      lagCompensationEnabled,
    );
  }

  private woodStaffStrikeContext(): WoodStaffStrikeContext {
    return {
      profile: this.profile,
      roomPlayers: this.roomPlayers as unknown as WoodStaffStrikeContext["roomPlayers"],
      queryNearbyMobs: (x, y, radius) => this.queryNearbyMobs(x, y, radius),
      getPlayerPositionAt: (playerId, at) => this.getPlayerPositionAt(playerId, at),
      applyDamageToPlayer: (p, a, dt) => this.applyDamageToPlayer(p, a, dt),
      handlePlayerKilled: (p) => this.handlePlayerKilled(p),
      handleMobDeath: (m) => this.handleMobDeath(m),
      awardExperience: (pid, amt) => this.awardExperience(pid, amt),
      broadcastDamageText: (x, y, text, color) => this.broadcastDamageText(x, y, text, color),
      onCombatLog: (text) => this.onCombatLog(text),
    };
  }

  // ── Projectile system ────────────────────────────────────────────
  protected updateProjectilesShared(deltaSeconds: number, now = Date.now()) {
    updateRoomProjectiles(this.projectileContext(), deltaSeconds, now);
  }

  /** Clean up both schema and server data for a projectile. */
  protected deleteProjectile(projectileId: string) {
    deleteProjectileRuntime(this.projectileContext(), projectileId);
  }

  protected spawnProjectile(
    ownerId: string,
    skillId: string,
    x: number,
    y: number,
    directionX: number,
    directionY: number,
    lifetime: number,
    damageScale = 1,
    sizeScale = 1,
  ) {
    spawnProjectileRuntime(
      this.projectileContext(),
      ownerId,
      skillId,
      x,
      y,
      directionX,
      directionY,
      lifetime,
      damageScale,
      sizeScale,
    );
  }

  /** Subclasses must provide the concrete ProjectileState constructor. */
  protected abstract createProjectileState(): ProjectileState;

  private projectileContext(): ProjectileRuntimeContext {
    return {
      state: {
        profile: this.profile,
        roomProjectiles: this.roomProjectiles,
        projectileServerData: this.projectileServerData,
        projectileHitHistory: this.projectileHitHistory,
        projectileSystem: this.projectileSystem,
        getPlayer: (playerId) => this.getPlayer(playerId),
        createProjectileState: () => this.createProjectileState(),
      },
      spatial: {
        getMapWidthPx: () => this.getMapWidthPx(),
        getMapHeightPx: () => this.getMapHeightPx(),
        isBlockedTile: (tx, ty) => this.isBlockedTile(tx, ty),
        queryNearbyPlayers: (x, y, radius) => this.queryNearbyPlayers(x, y, radius),
        queryNearbyMobs: (x, y, radius) => this.queryNearbyMobs(x, y, radius),
        ensureSpatialGrids: () => this.ensureSpatialGrids(),
        findNearestProjectileTarget: (projectile, maxDistance, excludedEntityId) =>
          this.findNearestProjectileTarget(projectile, maxDistance, excludedEntityId),
      },
      combat: {
        applyDamageToPlayer: (player, amount, damageType) => this.applyDamageToPlayer(player, amount, damageType),
        handlePlayerKilled: (player) => this.handlePlayerKilled(player),
        handleMobDeath: (mob) => this.handleMobDeath(mob),
        markMobSpatialDirty: () => this.markMobSpatialDirty(),
        awardExperience: (playerId, amount) => this.awardExperience(playerId, amount),
        applyBurnToPlayer: (player, sourceSkill, ownerId) => this.statusEffects.applyBurnToPlayer(player, sourceSkill, ownerId),
        applyBurnToMob: (mob, sourceSkill, ownerId) => this.applyBurnToMob(mob, sourceSkill, ownerId),
        applyProjectileLifesteal: (ownerId, resolvedDamage, targetPlayerId) =>
          this.applyProjectileLifesteal(ownerId, resolvedDamage, targetPlayerId),
        pushTargetByKnockback: (fromX, fromY, target, knockbackDistance, applyPosition) =>
          pushTargetByKnockbackRuntime(fromX, fromY, target, knockbackDistance, applyPosition),
        broadcastDamageText: (x, y, text, color) => this.broadcastDamageText(x, y, text, color),
        onCombatLog: (text) => this.onCombatLog(text),
        createFireTrail: (ownerId, tileX, tileY, now) => this.createFireTrail(ownerId, tileX, tileY, now),
      },
      skills: {
        getProjectileDamageScale: (projectile, sd) => this.getProjectileDamageScale(projectile, sd),
        getProjectileDirectDamage: (projectile, sd, targetHealth, targetMaxHealth) =>
          this.getProjectileDirectDamage(projectile, sd, targetHealth, targetMaxHealth),
        getSkillBalanceKey: (skillId) => this.getSkillBalanceKey(skillId),
        getSkillDirectDamage: (skillId) => this.getSkillDirectDamage(skillId),
        getOwnerProjectileGemConfig: (ownerId, skillId) => this.getOwnerProjectileGemConfig(ownerId, skillId),
        getProjectileBounceCount: (ownerId, skillId) => this.getProjectileBounceCount(ownerId, skillId),
        getProjectileRangeMultiplier: (ownerId, skillId) => this.getProjectileRangeMultiplier(ownerId, skillId),
        canProjectileLeaveTrail: (projectile) => this.canProjectileLeaveTrail(projectile),
        canProjectileShatter: (projectile) => this.canProjectileShatter(projectile),
        isProjectileReturningEnabled: (projectile) => this.isProjectileReturningEnabled(projectile),
      },
    };
  }

  // ── Skill cast helpers ───────────────────────────────────────────

  protected performFireballCast(ownerId: string, player: BasePlayerState, targetX: number, targetY: number) {
    const p = this.profile;
    const gemConfig = this.getOwnerProjectileGemConfig(ownerId, "fireball");
    const plan = buildFireballCastPlan({
      ownerId,
      startX: player.x,
      startY: player.y + p.fireballSpawnOffsetY,
      targetX,
      targetY,
      now: Date.now(),
      fireballLifetime: p.fireballLifetime,
      splitAngleOffsetRad: p.fireSplitAngleOffsetRad,
      splitProjectile: this.hasSplitProjectileGem(ownerId),
      gemConfig,
    });

    this.projectileSystem.queueBurstSpawns(plan.delayedSpawns);
    plan.immediateSpawns.forEach((spawn) => {
      this.spawnProjectile(
        spawn.ownerId,
        spawn.skillId,
        spawn.x,
        spawn.y,
        spawn.directionX,
        spawn.directionY,
        spawn.lifetime,
        spawn.damageScale ?? 1,
        spawn.sizeScale ?? 1,
      );
    });

    return plan.postCastLockMs;
  }

  protected performFireNovaCast(ownerId: string, player: BasePlayerState) {
    const p = this.profile;
    const originX = player.x;
    const originY = player.y + p.fireballSpawnOffsetY;

    for (let index = 0; index < p.fireNovaProjectileCount; index += 1) {
      const angle = (Math.PI * 2 * index) / p.fireNovaProjectileCount;
      this.spawnProjectile(
        ownerId,
        "fireNova",
        originX,
        originY,
        Math.cos(angle),
        Math.sin(angle),
        p.fireballLifetime,
      );
    }
    return 0;
  }

  // ── Fire field / trail ───────────────────────────────────────────

  protected createFireField(player: BasePlayerState, targetX: number, targetY: number, now: number) {
    createFireFieldRuntime({
      profile: this.profile,
      playerId: player.id,
      targetX,
      targetY,
      now,
      groundEffects: this.roomGroundEffects,
      getMapWidthTiles: () => this.getMapWidthTiles(),
      getMapHeightTiles: () => this.getMapHeightTiles(),
      isBlockedTile: (tx, ty) => this.isBlockedTile(tx, ty),
    });
  }

  protected createFireTrail(ownerId: string, tileX: number, tileY: number, now: number) {
    createFireTrailRuntime({
      profile: this.profile,
      ownerId,
      tileX,
      tileY,
      now,
      groundEffects: this.roomGroundEffects,
      getMapWidthTiles: () => this.getMapWidthTiles(),
      getMapHeightTiles: () => this.getMapHeightTiles(),
      isBlockedTile: (tx, ty) => this.isBlockedTile(tx, ty),
      durationMultiplier: this.getOwnerProjectileGemConfig(ownerId, "fireball").durationMultiplier,
    });
  }

  // ── Burn helpers ─────────────────────────────────────────────────

  protected applyBurnToMob(mob: MobState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string) {
    this.statusEffects.applyBurnToMob(mob, sourceSkill, ownerId);
  }

  // ── Damage (overridable for tutorial protection) ─────────────────
  protected applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number {
    return applyDamageToPlayerService(
      player as BasePlayerState & ArmorGemCarrier,
      amount,
      damageType,
      this.itemFireResistance,
    );
  }

  // ── Mob death (overridable for room-specific cleanup) ────────────
  protected handleMobDeath(mob: MobState) {
    handleMobDeathRuntime(this.mobContext(), mob);
    this.markMobSpatialDirty();
  }

  // ── Experience (overridable for chat in world room) ──────────────
  protected awardExperience(playerId: string, amount: number) {
    const player = this.getPlayer(playerId);
    if (!player || player.dead || amount <= 0) {
      return;
    }
    awardSharedExperience(player, amount);
  }

  // ── Cast state ───────────────────────────────────────────────────
  protected clearPlayerCastState(player: BasePlayerState) {
    player.castingSkillId = "";
    player.castStartedAt = 0;
    player.castEndsAt = 0;
    this.skillCastSystem.clearPlayer(player.id);
  }

  // ── Skill runtime delegates ──────────────────────────────────────

  protected getPlayerCastTimeMs(player: BasePlayerState) {
    return getRoomPlayerCastTimeMs(player, this.profile.fireTrailCastPenaltyMs);
  }

  protected canProjectileLeaveTrail(projectile: ProjectileState) {
    return canRoomProjectileLeaveTrail(projectile, (id) => this.getPlayer(id));
  }

  protected canProjectileShatter(projectile: ProjectileState) {
    return canRoomProjectileShatter(projectile, (id) => this.getPlayer(id));
  }

  protected getProjectileBounceCount(ownerId: string, skillId: string) {
    return getRoomProjectileBounceCount(
      ownerId, skillId,
      (id) => this.getPlayer(id),
      this.profile.fireBounceCount,
    );
  }

  protected isProjectileReturningEnabled(projectile: ProjectileState) {
    return isRoomProjectileReturningEnabled(projectile, (id) => this.getPlayer(id));
  }

  protected getProjectileRangeMultiplier(ownerId: string, skillId: string) {
    return getRoomProjectileRangeMultiplier(
      ownerId, skillId,
      (id) => this.getPlayer(id),
      this.profile.fireLongshotRangeMultiplier,
    );
  }

  protected hasSplitProjectileGem(ownerId: string) {
    return hasRoomSplitProjectileGem(ownerId, (id) => this.getPlayer(id));
  }

  protected getOwnerProjectileGemConfig(ownerId: string, skillId: string) {
    const p = this.profile;
    return getRoomOwnerProjectileGemConfig(
      ownerId, skillId,
      (id) => this.getPlayer(id),
      {
        fireTrailCastPenaltyMs: p.fireTrailCastPenaltyMs,
        longshotRangeMultiplier: p.fireLongshotRangeMultiplier,
        bounceCount: p.fireBounceCount,
      },
    );
  }

  protected getSkillBalanceKey(skillId: string): keyof SkillBalanceConfig {
    return getRoomSkillBalanceKey(skillId);
  }

  protected getSkillDirectDamage(skillId: string) {
    return getRoomSkillDirectDamage(this.skillBalance, skillId);
  }

  protected getSkillBurnDamage(skillId: string) {
    return getRoomSkillBurnDamage(this.skillBalance, skillId);
  }

  // ── Spatial grid ─────────────────────────────────────────────────

  protected recordPlayerPositionHistory(now: number) {
    recordPlayerPositionHistoryRuntime(
      this.lagCompensationTracker,
      this.roomPlayers.values(),
      now,
      {
        historyDurationMs: this.profile.positionHistoryDurationMs,
        minSampleIntervalMs: this.simulationIntervalMs,
      },
    );
  }

  protected getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null {
    return getPlayerPositionAtRuntime(this.lagCompensationTracker, playerId, at);
  }

  protected rebuildMobSpatialGrid() {
    rebuildRoomSpatialGrid(this.mobSpatialGrid, this.mobSpatialOrder, this.roomMobs.values());
    this.mobSpatialDirty = false;
  }

  protected ensureMobSpatialGrid() {
    if (this.mobSpatialDirty) {
      this.rebuildMobSpatialGrid();
    }
  }

  protected ensureSpatialGrids() {
    rebuildRoomSpatialGrid(this.playerSpatialGrid, this.playerSpatialOrder, this.roomPlayers.values());
    this.ensureMobSpatialGrid();
  }

  protected markMobSpatialDirty() {
    this.mobSpatialDirty = true;
  }

  protected queryNearbyPlayers(x: number, y: number, radius: number) {
    return queryNearbyRoomEntities(this.playerSpatialGrid, this.playerSpatialOrder, x, y, radius);
  }

  protected queryNearbyMobs(x: number, y: number, radius: number) {
    this.ensureMobSpatialGrid();
    return queryNearbyRoomEntities(this.mobSpatialGrid, this.mobSpatialOrder, x, y, radius);
  }

  protected findNearestProjectileTarget(
    projectile: ProjectileState,
    maxDistance: number,
    excludedEntityId?: string,
  ) {
    return findNearestRoomProjectileTarget(
      projectile,
      maxDistance,
      this.playerSpatialGrid,
      this.mobSpatialGrid,
      excludedEntityId,
    );
  }

  protected getProjectileDamageScale(projectile: ProjectileState, sd: ProjectileServerData) {
    return getRoomProjectileDamageScale(projectile, sd);
  }

  protected getProjectileDirectDamage(projectile: ProjectileState, sd: ProjectileServerData, targetHealth: number, targetMaxHealth: number) {
    return getRoomProjectileDirectDamage(this.skillBalance, projectile, sd, targetHealth, targetMaxHealth);
  }

  protected applyProjectileLifesteal(ownerId: string, resolvedDamage: number, targetPlayerId?: string) {
    const healedAmount = applyRoomProjectileLifesteal(
      ownerId,
      resolvedDamage,
      targetPlayerId,
      (id) => this.getPlayer(id),
      (nextOwnerId, skillId) => this.getOwnerProjectileGemConfig(nextOwnerId, skillId),
    );
    if (healedAmount <= 0) {
      return;
    }

    const owner = this.getPlayer(ownerId);
    if (!owner) {
      return;
    }

    this.broadcastHealingText(owner.x, owner.y - 18, healedAmount);
  }

  protected getProjectileHitHistory(projectileId: string) {
    let history = this.projectileHitHistory.get(projectileId);
    if (!history) {
      history = new Set<string>();
      this.projectileHitHistory.set(projectileId, history);
    }
    return history;
  }

  // ── Damage text broadcast ────────────────────────────────────────

  protected broadcastDamageText(x: number, y: number, text: string, color = "#ff5959") {
    broadcastDamageTextRuntime(this, x, y, text, color);
  }

  protected broadcastHealingText(x: number, y: number, amount: number) {
    if (amount <= 0) {
      return;
    }

    this.broadcastDamageText(x, y, `+${amount}`, "#6dff8f");
  }

  // ── Balance config ───────────────────────────────────────────────

  protected serializeSkillBalanceConfig() {
    return serializeSkillBalanceConfigRuntime(this.skillBalance);
  }

  protected serializeMobBalanceConfig() {
    return serializeMobBalanceConfigRuntime(this.mobBalance);
  }

  protected applyBackendSkillBalance(data: Record<string, unknown>) {
    const nextConfig = applyBackendSkillBalanceRuntime(this.skillBalance, data);
    this.broadcast("skillBalanceConfig", nextConfig);
  }

  protected applyBackendMobBalance(data: Record<string, unknown>) {
    const nextConfig = applyBackendMobBalanceRuntime(
      this.mobBalance,
      data,
      this.roomMobs.values(),
    );
    this.broadcast("mobBalanceConfig", nextConfig);
  }

  protected applyMobBalanceToLiveMobs() {
    applyMobBalanceToLiveMobsRuntime(this.mobBalance, this.roomMobs.values());
  }

  protected applyMobBalance(mob: MobState, balance: MobBalanceSection) {
    applyMobBalanceRuntime(mob, balance);
  }

  protected resolveMobKind(mob: MobState): MobKind {
    return resolveMobKindRuntime(mob);
  }

  protected getMobBalanceForMob(mob: MobState): MobBalanceSection {
    return getMobBalanceForMobRuntime(this.mobBalance, mob);
  }

  protected applyBackendItemBalance(data: Record<string, unknown>) {
    applyBackendItemBalanceRuntime(this.itemFireResistance, data);
  }

  // ── Convenience ──────────────────────────────────────────────────

  protected getPlayer(sessionId: string): TPlayer | undefined {
    return this.roomPlayers.get(sessionId);
  }
}
