import { Client, Room } from "colyseus";
import {
  type CastSkillMessage,
  type SyncChestMessage,
} from "@mmorpg/shared/realtime/contracts";
import {
  isMobKind,
  MOB_KINDS,
  type MobKind,
} from "@mmorpg/shared/mobs/catalog";
import {
  SKELETON_DASH_SKILL,
  SKELETON_DASH_SKILL_ID,
} from "@mmorpg/shared/mobs/skills";
import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { type SkillBalanceConfig } from "./skillBalance.js";
import {
  cloneSkillBalanceConfig,
  DEFAULT_SKILL_BALANCE_CONFIG,
} from "./skillBalance.js";
import {
  cloneMobBalanceConfig,
  DEFAULT_MOB_BALANCE_CONFIG,
  type MobBalanceConfig,
  type MobBalanceSection,
} from "./mobBalance.js";
import { type ArmorGemCarrier } from "./armorGems.js";
import {
  FIREBALL_SHARD_SKILL_ID,
  FIREBALL_SPLIT_SKILL_ID,
  getFireballCastRange,
  getFireballCooldownMs,
} from "./fireballGems.js";
import { createSkillHandlers, type SkillCastContext, type SkillHandler } from "./skills/index.js";
import {
  getEffectiveMobAttackRange,
  getMobDesiredTargetPosition,
  moveMobTowards,
  resetMobToSpawn,
  resolveMobAggroTarget,
  setMobAggroTarget,
} from "./mobAi.js";
import {
  clearMobPath,
  hasGridLineOfSight,
  resolveMobPathTarget,
  type MobPathCacheEntry,
} from "./mobPathing.js";
import {
  applyItemBalanceUpdate,
  createDefaultItemFireResistanceMap,
  type ItemBalanceConfig,
} from "./itemBalance.js";
import {
  applyGemConfigToProjectile,
  buildFireballCastPlan,
  buildOnHitProjectileEffects,
  shouldProjectileDealDirectDamage,
  type DamageType,
} from "./projectileSkills.js";
import {
  awardExperience as awardSharedExperience,
  buildGroundEffectTileArea,
  canProjectileHitOwner,
  startProjectileReturn as startSharedProjectileReturn,
  tryBounceProjectile as trySharedProjectileBounce,
} from "./sharedGameplay.js";
import {
  HEALING_POTION_ID,
  TELEPORT_SCROLL_ID,
  parseRoomInventoryEntry,
} from "./roomItems.js";
import {
  verifySessionToken,
  applyVerifiedProfile,
  type VerifiedPlayer,
} from "./auth.js";
import { BurnService } from "./services/BurnService.js";
import { HealingService } from "./services/HealingService.js";
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
  applyRoomBurnToEntity,
  updateRoomBurningEntities,
  updateRoomHealingTargets,
} from "./runtime/statusRuntime.js";
import {
  consumeSupportedRoomConsumable,
  replaceRoomStringSlots,
  syncRoomChestSlots,
} from "./runtime/inventoryRuntime.js";
import {
  applyRoomZeroHealthState,
  initializeRoomPlayerTransientState,
} from "./runtime/profileRuntime.js";
import {
  sendRoomBalanceSnapshots,
} from "./runtime/sessionRuntime.js";
import type { BasePlayerState } from "./schema/BasePlayerState.js";
import type { MobState } from "./schema/MobState.js";
import type { ChestState } from "./schema/ChestState.js";
import { GroundEffectState } from "./schema/GroundEffectState.js";
import { type ProjectileState, type ProjectileServerData, createDefaultProjectileServerData } from "./schema/ProjectileState.js";
import { applyDamageToPlayer as applyDamageToPlayerService } from "./services/CombatService.js";
import { SharedCombatTickSystem } from "./systems/RoomTickSystems.js";

// Re-export types subclasses need
export type { DamageType } from "./projectileSkills.js";
export type { VerifiedPlayer } from "./auth.js";
export type { MobPathCacheEntry } from "./mobPathing.js";
export type { SkillId } from "@mmorpg/shared/skills/registry";

type WoodStaffStrikeTarget =
  | { kind: "player"; entity: BasePlayerState; distance: number }
  | { kind: "mob"; entity: MobState; distance: number };

type PlayerPositionHistorySample = {
  at: number;
  x: number;
  y: number;
};

type LagCompensatedCastTiming = {
  at: number;
  enabled: boolean;
};

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
  protected readonly playerBurns = new BurnService();
  protected readonly mobBurns = new BurnService();
  protected readonly playerHealing = new HealingService();
  protected readonly pendingSkillCasts = new Map<string, {
    skillId: SkillId;
    targetX?: number;
    targetY?: number;
  }>();
  protected readonly playerPositionHistory = new Map<string, PlayerPositionHistorySample[]>();
  protected readonly projectileHitHistory = new Map<string, Set<string>>();
  protected readonly projectileServerData = new Map<string, ProjectileServerData>();
  protected readonly pendingBurstSpawns: {
    ownerId: string;
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    spawnAt: number;
  }[] = [];
  protected readonly pendingAftershocks: {
    ownerId: string;
    x: number;
    y: number;
    damageScale: number;
    triggerAt: number;
  }[] = [];
  protected readonly consumableCooldownEndsAt = new Map<string, number>();
  protected readonly pendingTeleportScrollCasts = new Set<string>();
  protected readonly mobPathCache = new Map<string, MobPathCacheEntry>();
  protected readonly losCache = new Map<string, boolean>();
  protected readonly itemFireResistance = createDefaultItemFireResistanceMap();
  protected readonly mobSkillHitTargets = new Map<string, Set<string>>();
  protected readonly playerSpatialGrid = new SpatialGrid<BasePlayerState>(64);
  protected readonly mobSpatialGrid = new SpatialGrid<MobState>(64);
  protected readonly playerSpatialOrder = new Map<string, number>();
  protected readonly mobSpatialOrder = new Map<string, number>();
  protected readonly contentSnapshotPoller = new ContentSnapshotPoller({
    onSnapshot: (snapshot) => {
      this.applyBackendSkillBalance(snapshot.skillBalance);
      this.applyBackendMobBalance(snapshot.mobBalance);
      this.applyBackendItemBalance(snapshot.itemBalance);
    },
  });
  protected readonly verifiedPlayers = new Map<string, VerifiedPlayer>();
  protected readonly skillHandlers = createSkillHandlers();
  protected readonly sharedCombatTickSystem = new SharedCombatTickSystem({
    updatePendingCasts: (now) => this.updatePendingCasts(now),
    updatePendingBurstSpawns: (now) => this.updatePendingBurstSpawns(now),
    updatePendingAftershocks: (now) => this.updatePendingAftershocks(now),
    updateBurningTargets: (now) => this.updateBurningTargets(now),
    updateHealingTargets: (now) => this.updateHealingTargets(now),
    updateGroundEffects: (now) => this.updateGroundEffects(now),
    updateProjectiles: (deltaSeconds, now) => this.updateProjectilesShared(deltaSeconds, now),
  });
  protected readonly sharedRaidCombatTickSystem = new SharedCombatTickSystem(
    {
      updatePendingCasts: (now) => this.updatePendingCasts(now),
      updatePendingBurstSpawns: (now) => this.updatePendingBurstSpawns(now),
      updatePendingAftershocks: (now) => this.updatePendingAftershocks(now),
      updateBurningTargets: (now) => this.updateBurningTargets(now),
      updateHealingTargets: (now) => this.updateHealingTargets(now),
      updateGroundEffects: (now) => this.updateGroundEffects(now),
      updateProjectiles: (deltaSeconds, now) => this.updateProjectilesShared(deltaSeconds, now),
      updateBurningMobs: (now) => this.updateBurningMobs(now),
    },
  );

  // ── Auth (identical in both rooms) ───────────────────────────────
  protected async verifyAuth(options?: Record<string, unknown>) {
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
    this.playerBurns.clear();
    this.mobBurns.clear();
    this.playerHealing.clear();
    this.playerSpatialGrid.clear();
    this.mobSpatialGrid.clear();
    this.playerPositionHistory.clear();
    this.projectileServerData.clear();
    this.mobSkillHitTargets.clear();
  }

  // ── Shared message handlers ──────────────────────────────────────
  protected registerSharedMessageHandlers() {
    this.onMessage("syncChest", (_client: Client, message: SyncChestMessage) => {
      this.handleSyncChest(message);
    });

    this.onMessage("castSkill", (client: Client, message: CastSkillMessage) => {
      this.handleCastSkillMessage(client.sessionId, message);
    });
  }

  // ── Skill casting ────────────────────────────────────────────────
  protected handleCastSkillMessage(
    sessionId: string,
    message: CastSkillMessage,
  ) {
    const skillId = typeof message?.skillId === "string" ? message.skillId : "";
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

    const lagCompensation = this.resolveLagCompensatedCastTiming(message, now);
    const ctx = this.createSkillCastContext(sessionId, player, now, lagCompensation);

    let targetX = player.x;
    let targetY = player.y;
    if (handler.needsTarget) {
      const requestedTargetX = Number.isFinite(message.targetX) ? message.targetX! : player.x;
      const requestedTargetY = Number.isFinite(message.targetY) ? message.targetY! : player.y;
      const clamped = this.clampTargetToCastRange(player, player.x, player.y, requestedTargetX, requestedTargetY);
      targetX = clamped.x;
      targetY = clamped.y;
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
      this.pendingSkillCasts.set(sessionId, {
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
      clampTargetToCastRange: (p, ox, oy, tx, ty) => this.clampTargetToCastRange(p, ox, oy, tx, ty),
      clearPlayerMovement: (sid) => this.clearPlayerMovement(sid),
      performWoodStaffStrike: (p, tx, ty) =>
        this.performWoodStaffStrike(sessionId, p, tx, ty, lagCompensation.at, lagCompensation.enabled),
      getOwnerProjectileGemConfig: (oid, sid) => this.getOwnerProjectileGemConfig(oid, sid),
      hasSplitProjectileGem: (oid) => this.hasSplitProjectileGem(oid),
      spawnProjectile: (oid, sid, x, y, dx, dy, lt, ds, ss) =>
        this.spawnProjectile(oid, sid, x, y, dx, dy, lt, ds, ss),
      pendingBurstSpawns: this.pendingBurstSpawns,
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
  ) {
    const consumedEntry = consumeSupportedRoomConsumable(sourceSlots[slotIndex]);
    const parsed = consumedEntry?.parsed;
    if (!consumedEntry || !parsed) {
      return;
    }

    const now = Date.now();
    const p = this.profile;

    if (parsed.code === HEALING_POTION_ID) {
      const activeCooldownEndsAt = this.consumableCooldownEndsAt.get(sessionId) ?? 0;
      if (activeCooldownEndsAt > now) {
        return;
      }
    }

    sourceSlots[slotIndex] = consumedEntry.nextValue;
    commitSlots(sourceSlots);

    if (parsed.code === HEALING_POTION_ID) {
      const healingTicks = p.healingPotionDurationMs / p.healingPotionTickMs;
      const nextCooldownEndsAt = now + p.healingPotionCooldownMs;
      this.consumableCooldownEndsAt.set(sessionId, nextCooldownEndsAt);
      this.playerHealing.start(
        sessionId,
        healingTicks,
        p.healingPotionTickMs,
        p.healingPotionDurationMs,
        player as BasePlayerState & ArmorGemCarrier & { healingTicksRemaining: number; healingEndsAt: number },
        now,
      );

      const client = this.clients.find((c) => c.sessionId === sessionId);
      client?.send("consumableCooldown", {
        itemId: HEALING_POTION_ID,
        cooldownEndsAt: nextCooldownEndsAt,
      });
      return;
    }

    // Teleport scroll
    this.clearPlayerMovement(sessionId);
    player.castingSkillId = TELEPORT_SCROLL_ID;
    player.castStartedAt = now;
    player.castEndsAt = now + p.teleportScrollCastMs;
    this.pendingTeleportScrollCasts.add(sessionId);
  }

  // ── SyncChest (identical in both rooms) ──────────────────────────
  protected handleSyncChest(message: { chestId?: string; slots?: string[] }) {
    if (typeof message?.chestId !== "string" || !Array.isArray(message.slots)) {
      return;
    }
    const chest = this.roomChests.get(message.chestId);
    if (!chest) {
      return;
    }
    syncRoomChestSlots(chest, message.slots);
  }

  // ── Pending cast resolution ──────────────────────────────────────
  protected updatePendingCasts(now = Date.now()) {
    for (const [playerId, cast] of this.pendingSkillCasts.entries()) {
      const player = this.getPlayer(playerId);
      if (!player || player.dead) {
        this.pendingSkillCasts.delete(playerId);
        continue;
      }

      if (player.castEndsAt > now) {
        continue;
      }

      const handler = this.skillHandlers.get(cast.skillId);
      const ctx = this.createSkillCastContext(playerId, player, now);
      const postCastLockMs = handler
        ? handler.performCast(ctx, cast.targetX ?? player.x, cast.targetY ?? player.y)
        : 0;

      this.pendingSkillCasts.delete(playerId);
      if (postCastLockMs > 0) {
        player.castingSkillId = cast.skillId;
        player.castStartedAt = now;
        player.castEndsAt = now + postCastLockMs;
        continue;
      }

      this.clearPlayerCastState(player);
    }

    for (const playerId of Array.from(this.pendingTeleportScrollCasts)) {
      const player = this.getPlayer(playerId);
      if (!player || player.dead) {
        this.pendingTeleportScrollCasts.delete(playerId);
        continue;
      }

      if (player.castEndsAt > now) {
        continue;
      }

      this.performTeleportScroll(playerId, player);
      this.clearPlayerCastState(player);
    }
  }

  // ── Pending burst spawns ─────────────────────────────────────────
  protected updatePendingBurstSpawns(now = Date.now()) {
    let i = 0;
    while (i < this.pendingBurstSpawns.length) {
      const burst = this.pendingBurstSpawns[i];
      if (burst.spawnAt > now) {
        i++;
        continue;
      }

      const player = this.getPlayer(burst.ownerId);
      if (!player || player.dead) {
        this.pendingBurstSpawns.splice(i, 1);
        continue;
      }

      this.spawnProjectile(
        burst.ownerId,
        "fireball",
        burst.x,
        burst.y,
        burst.directionX,
        burst.directionY,
        this.profile.fireballLifetime,
      );
      this.pendingBurstSpawns.splice(i, 1);
    }
  }

  // ── Pending aftershocks ──────────────────────────────────────────
  protected updatePendingAftershocks(now = Date.now()) {
    const AFTERSHOCK_RADIUS = 48;
    let i = 0;
    while (i < this.pendingAftershocks.length) {
      const shock = this.pendingAftershocks[i];
      if (shock.triggerAt > now) {
        i++;
        continue;
      }

      const damage = Math.max(0, Math.round(this.profile.fireballBaseDamage * shock.damageScale));
      if (damage > 0) {
        for (const player of this.roomPlayers.values()) {
          if (player.dead || player.id === shock.ownerId) {
            continue;
          }
          if (Math.hypot(player.x - shock.x, player.y - shock.y) > AFTERSHOCK_RADIUS) {
            continue;
          }
          this.applyDamageToPlayer(player, damage, "fire");
          if (player.health <= 0) {
            this.handlePlayerKilled(player);
          }
        }

        for (const mob of this.roomMobs.values()) {
          if (mob.dead) {
            continue;
          }
          if (Math.hypot(mob.x - shock.x, mob.y - shock.y) > AFTERSHOCK_RADIUS) {
            continue;
          }
          mob.health = Math.max(0, mob.health - damage);
          if (mob.health <= 0) {
            this.handleMobDeath(mob);
            this.awardExperience(shock.ownerId, mob.experienceReward);
          }
        }
      }

      this.pendingAftershocks.splice(i, 1);
    }
  }

  // ── Burn / healing updates ───────────────────────────────────────
  protected updateBurningTargets(now = Date.now()) {
    updateRoomBurningEntities({
      service: this.playerBurns,
      now,
      burnTickMs: this.profile.fireballBurnTickMs,
      skillBalance: this.skillBalance,
      getEntity: (playerId) => this.getPlayer(playerId),
      onTick: (_playerId, player, damage) => {
        const resolvedDamage = this.applyDamageToPlayer(player, damage, "fire");
        this.onCombatLog(`${player.name} burns for ${resolvedDamage}.`);
        if (player.health <= 0) {
          this.handlePlayerKilled(player);
        }
      },
    });
  }

  protected updateBurningMobs(now = Date.now()) {
    updateRoomBurningEntities({
      service: this.mobBurns,
      now,
      burnTickMs: this.profile.fireballBurnTickMs,
      skillBalance: this.skillBalance,
      getEntity: (mobId) => this.roomMobs.get(mobId),
      onTick: (_mobId, mob, damage) => {
        mob.health = Math.max(0, mob.health - damage);
        this.onCombatLog(`${mob.name} burns for ${damage}.`);
        if (mob.health <= 0) {
          this.handleMobDeath(mob);
        }
      },
    });
  }

  protected updateHealingTargets(now = Date.now()) {
    const p = this.profile;
    updateRoomHealingTargets({
      service: this.playerHealing,
      now,
      tickMs: p.healingPotionTickMs,
      healPerTick: p.healingPotionTotalHeal / (p.healingPotionDurationMs / p.healingPotionTickMs),
      getPlayer: (playerId) => this.getPlayer(playerId),
    });
  }

  // ── Ground effects ───────────────────────────────────────────────
  protected updateGroundEffects(now = Date.now()) {
    const p = this.profile;

    for (const [effectId, effect] of this.roomGroundEffects.entries()) {
      if (effect.expiresAt <= now) {
        this.roomGroundEffects.delete(effectId);
        continue;
      }

      if (effect.nextTickAt > now) {
        continue;
      }

      const owner = this.getPlayer(effect.ownerId);
      const effectDamage =
        effect.skillId === "fireTrail"
          ? this.skillBalance.fireball.burnDamage
          : this.skillBalance.fireField.damage;

      for (const player of this.roomPlayers.values()) {
        if (player.dead || !this.isEntityOnGroundEffect(player.x, player.y, effect)) {
          continue;
        }

        const resolvedDamage = this.applyDamageToPlayer(player, effectDamage, "fire");
        this.applyBurnToPlayer(player, effect.skillId === "fireTrail" ? "fireball" : "fireField", effect.ownerId);
        this.onCombatLog(`${player.name} scorches for ${resolvedDamage}.`);

        if (player.health <= 0) {
          this.handlePlayerKilled(player);
        }
      }

      for (const mob of this.roomMobs.values()) {
        if (mob.dead || !this.isEntityOnGroundEffect(mob.x, mob.y, effect)) {
          continue;
        }

        mob.health = Math.max(0, mob.health - effectDamage);
        this.applyBurnToMob(mob, effect.skillId === "fireTrail" ? "fireball" : "fireField", effect.ownerId);
        if (owner && !owner.dead) {
          setMobAggroTarget(mob, owner);
        }
        this.onCombatLog(`${mob.name} scorches for ${effectDamage}.`);

        if (mob.health <= 0) {
          this.handleMobDeath(mob);
          this.awardExperience(effect.ownerId, mob.experienceReward);
        }
      }

      effect.nextTickAt = now + (effect.skillId === "fireTrail" ? p.fireTrailTickMs : p.fireFieldTickMs);
    }
  }

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
    const tileSize = this.profile.tileSize;
    // Rebuild mob spatial grid before movement so canMobMoveTo uses it
    rebuildRoomSpatialGrid(this.mobSpatialGrid, this.mobSpatialOrder, this.roomMobs.values());
    // Clear LOS cache each tick — same tile-pair lookups within the tick are still cached
    this.losCache.clear();

    for (const mob of this.roomMobs.values()) {
      if (mob.dead) {
        if (mob.respawnAt > 0 && now >= mob.respawnAt) {
          resetMobToSpawn(mob);
          clearMobPath(this.mobPathCache, mob.id);
          this.mobBurns.delete(mob.id);
        }
        continue;
      }

      const mobTileX = Math.floor(mob.x / tileSize);
      const mobTileY = Math.floor(mob.y / tileSize);
      const targetPlayer = resolveMobAggroTarget(mob, players, {
        now,
        canAcquireTarget: (player) => {
          const playerTileX = Math.floor(player.x / tileSize);
          const playerTileY = Math.floor(player.y / tileSize);
          const cacheKey = `${mobTileX}:${mobTileY}:${playerTileX}:${playerTileY}`;
          const cached = this.losCache.get(cacheKey);
          if (cached !== undefined) {
            return cached;
          }
          const result = hasGridLineOfSight(
            { x: mobTileX, y: mobTileY },
            { x: playerTileX, y: playerTileY },
            {
              tileSize,
              width: this.getMapWidthTiles(),
              height: this.getMapHeightTiles(),
              isBlocked: (tx, ty) => this.isBlockedTile(tx, ty),
            },
          );
          this.losCache.set(cacheKey, result);
          return result;
        },
      });

      if (this.tryRunSkeletonDash(mob, targetPlayer, players, now)) {
        continue;
      }

      if (targetPlayer) {
        const distance = Math.hypot(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
        if (this.resolveMobKind(mob) !== "skeleton" && distance <= getEffectiveMobAttackRange(mob)) {
          this.attackPlayerFromMob(mob, targetPlayer, now);
          continue;
        }
      }

      const customTarget = getDesiredTarget?.(mob, targetPlayer, now);
      const desiredTarget = customTarget ?? getMobDesiredTargetPosition(mob, targetPlayer, now);
      const movementTarget = resolveMobPathTarget(mob, {
        now,
        desiredX: desiredTarget.x,
        desiredY: desiredTarget.y,
        cache: this.mobPathCache,
        grid: {
          tileSize,
          width: this.getMapWidthTiles(),
          height: this.getMapHeightTiles(),
          isBlocked: (tx, ty) => this.isBlockedTile(tx, ty),
        },
      });
      moveMobTowards(mob, {
        deltaSeconds,
        desiredX: movementTarget.x,
        desiredY: movementTarget.y,
        canMoveTo: (x, y) => this.canMobMoveTo(x, y, mob.id),
      });
    }
  }

  protected canMobMoveTo(x: number, y: number, mobId: string) {
    const tileSize = this.profile.tileSize;
    const widthPx = this.getMapWidthPx();
    const heightPx = this.getMapHeightPx();
    const clampedX = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, x));
    const clampedY = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, y));
    const tileX = Math.floor(clampedX / tileSize);
    const tileY = Math.floor(clampedY / tileSize);

    if (this.isBlockedTile(tileX, tileY)) {
      return false;
    }

    const hitRadius = this.profile.mobHitRadius;
    for (const nearby of this.mobSpatialGrid.queryRadius(clampedX, clampedY, hitRadius)) {
      if (nearby.id === mobId) {
        continue;
      }
      return false;
    }

    return true;
  }

  protected attackPlayerFromMob(mob: MobState, player: BasePlayerState, now = Date.now()) {
    if (!player || player.dead) {
      return;
    }
    if (mob.attackCooldownEndsAt > now) {
      return;
    }

    mob.attackCooldownEndsAt = now + mob.attackCooldownMs;
    const resolvedDamage = this.applyDamageToPlayer(player, mob.attackDamage, "physical");
    this.onCombatLog(`${mob.name} hits ${player.name} for ${resolvedDamage}.`);

    if (player.health <= 0) {
      this.handlePlayerKilled(player);
    }
  }

  protected performWoodStaffStrike(
    ownerId: string,
    player: BasePlayerState,
    targetX: number,
    targetY: number,
    lagCompensatedAt = Date.now(),
    lagCompensationEnabled = false,
  ) {
    const target = this.findWoodStaffStrikeTarget(player, targetX, targetY, lagCompensatedAt, lagCompensationEnabled);
    if (!target) {
      return;
    }

    const baseDamage = Math.max(1, this.profile.meleeStrikeDamage);
    const strengthBonus = Math.max(0, player.strength - 1) * 2;
    const damage = baseDamage + strengthBonus;
    const knockbackDistance = this.profile.tileSize; // 1 tile
    const tileSize = this.profile.tileSize;
    const widthPx = this.getMapWidthPx();
    const heightPx = this.getMapHeightPx();

    if (target.kind === "player") {
      const resolvedDamage = this.applyDamageToPlayer(target.entity, damage, "physical");
      this.onCombatLog(`${player.name} hits ${target.entity.name} for ${resolvedDamage}.`);
      if (resolvedDamage > 0) {
        this.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${resolvedDamage}`, "#ffd089");
      }
      if (resolvedDamage > 0) {
        this.pushTargetByKnockback(player.x, player.y, target.entity, knockbackDistance, (nx, ny) => {
          target.entity.x = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, nx));
          target.entity.y = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, ny));
        });
      }

      if (target.entity.health <= 0) {
        this.handlePlayerKilled(target.entity);
      }
      return;
    }

    target.entity.health = Math.max(0, target.entity.health - damage);
    setMobAggroTarget(target.entity, player);
    this.onCombatLog(`${player.name} hits ${target.entity.name} for ${damage}.`);
    if (damage > 0) {
      this.broadcastDamageText(target.entity.x, target.entity.y - 18, `-${damage}`, "#ffd089");
      this.pushTargetByKnockback(player.x, player.y, target.entity, knockbackDistance, (nx, ny) => {
        target.entity.x = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, nx));
        target.entity.y = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, ny));
      });
    }
    if (target.entity.health <= 0) {
      this.handleMobDeath(target.entity);
      this.awardExperience(ownerId, target.entity.experienceReward);
    }
  }

  protected findWoodStaffStrikeTarget(
    player: BasePlayerState,
    targetX: number,
    targetY: number,
    lagCompensatedAt = Date.now(),
    lagCompensationEnabled = false,
  ): WoodStaffStrikeTarget | null {
    const maxRange = this.profile.meleeStrikeRange;
    const hitSlack = 4;
    const playerPosition = lagCompensationEnabled
      ? this.getPlayerPositionAt(player.id, lagCompensatedAt) ?? player
      : player;
    const directionX = targetX - playerPosition.x;
    const directionY = targetY - playerPosition.y;
    const directionLength = Math.hypot(directionX, directionY);
    const hasAimDirection = directionLength > 0.001;
    const normalizedX = hasAimDirection ? directionX / directionLength : 0;
    const normalizedY = hasAimDirection ? directionY / directionLength : 0;
    const minimumDot = Math.cos(this.profile.meleeStrikeArcHalfAngleRad);
    const isTargetWithinArc = (deltaX: number, deltaY: number, distance: number, hitRadius: number) => {
      if (!hasAimDirection || distance <= hitRadius + hitSlack) {
        return true;
      }

      const forwardDistance = deltaX * normalizedX + deltaY * normalizedY;
      if (forwardDistance < -hitSlack) {
        return false;
      }
      const dot = forwardDistance / Math.max(distance, 0.001);
      return dot >= minimumDot;
    };

    let nearestMob: WoodStaffStrikeTarget | null = null;
    for (const mob of this.queryNearbyMobs(playerPosition.x, playerPosition.y, maxRange + this.profile.mobHitRadius)) {
      if (mob.dead) {
        continue;
      }

      const deltaX = mob.x - playerPosition.x;
      const deltaY = mob.y - playerPosition.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > maxRange + this.profile.mobHitRadius || !isTargetWithinArc(deltaX, deltaY, distance, this.profile.mobHitRadius)) {
        continue;
      }

      if (!nearestMob || distance < nearestMob.distance) {
        nearestMob = { kind: "mob", entity: mob, distance };
      }
    }

    if (nearestMob) {
      return nearestMob;
    }

    let nearestPlayer: WoodStaffStrikeTarget | null = null;
    for (const candidate of this.roomPlayers.values()) {
      if (candidate.id === player.id || candidate.dead) {
        continue;
      }

      const candidatePosition = lagCompensationEnabled
        ? this.getPlayerPositionAt(candidate.id, lagCompensatedAt) ?? candidate
        : candidate;
      const deltaX = candidatePosition.x - playerPosition.x;
      const deltaY = candidatePosition.y - playerPosition.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > maxRange + this.profile.playerHitRadius || !isTargetWithinArc(deltaX, deltaY, distance, this.profile.playerHitRadius)) {
        continue;
      }

      if (!nearestPlayer || distance < nearestPlayer.distance) {
        nearestPlayer = { kind: "player", entity: candidate, distance };
      }
    }

    return nearestPlayer;
  }

  protected clearMobSkillState(mob: MobState) {
    mob.castingSkillId = "";
    mob.castStartedAt = 0;
    mob.castEndsAt = 0;
    mob.skillLungeStartedAt = 0;
    mob.skillLungeEndsAt = 0;
    mob.skillLungeFromX = 0;
    mob.skillLungeFromY = 0;
    mob.skillLungeToX = 0;
    mob.skillLungeToY = 0;
    this.mobSkillHitTargets.delete(mob.id);
  }

  protected startSkeletonDashCast(mob: MobState, now: number) {
    mob.castingSkillId = SKELETON_DASH_SKILL_ID;
    mob.castStartedAt = now;
    mob.castEndsAt = now + SKELETON_DASH_SKILL.castMs;
    mob.skillLungeStartedAt = 0;
    mob.skillLungeEndsAt = 0;
    mob.skillLungeFromX = mob.x;
    mob.skillLungeFromY = mob.y;
    mob.skillLungeToX = mob.x;
    mob.skillLungeToY = mob.y;
    mob.targetX = mob.x;
    mob.targetY = mob.y;
    mob.attackCooldownEndsAt = now + SKELETON_DASH_SKILL.cooldownMs;
  }

  protected resolveSkeletonDashDestination(mob: MobState, target: BasePlayerState | null) {
    const tileSize = this.profile.tileSize;
    const maxDistance = tileSize * SKELETON_DASH_SKILL.lungeDistanceTiles;
    const desiredX = target ? target.x : mob.targetX;
    const desiredY = target ? target.y : mob.targetY;
    const deltaX = desiredX - mob.x;
    const deltaY = desiredY - mob.y;
    const length = Math.hypot(deltaX, deltaY);
    const directionX = length > 0.001 ? deltaX / length : 1;
    const directionY = length > 0.001 ? deltaY / length : 0;
    const stepDistance = Math.max(4, tileSize / 4);
    const steps = Math.max(1, Math.ceil(maxDistance / stepDistance));
    let resolvedX = mob.x;
    let resolvedY = mob.y;

    for (let step = 1; step <= steps; step += 1) {
      const travelled = Math.min(maxDistance, step * stepDistance);
      const candidateX = mob.x + directionX * travelled;
      const candidateY = mob.y + directionY * travelled;
      if (!this.canMobMoveTo(candidateX, candidateY, mob.id)) {
        break;
      }
      resolvedX = candidateX;
      resolvedY = candidateY;
    }

    return {
      x: resolvedX,
      y: resolvedY,
      directionX,
      directionY,
    };
  }

  protected getDistanceToSegment(
    pointX: number,
    pointY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (lengthSquared <= 0.0001) {
      return Math.hypot(pointX - startX, pointY - startY);
    }

    const projection = ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared;
    const clamped = Math.max(0, Math.min(1, projection));
    const closestX = startX + segmentX * clamped;
    const closestY = startY + segmentY * clamped;
    return Math.hypot(pointX - closestX, pointY - closestY);
  }

  protected getSegmentCircleCollisionT(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    centerX: number,
    centerY: number,
    radius: number,
  ) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    if (lengthSquared <= 0.0001) {
      return Math.hypot(startX - centerX, startY - centerY) <= radius ? 0 : null;
    }

    const offsetX = startX - centerX;
    const offsetY = startY - centerY;
    const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
    if (c <= 0) {
      return 0;
    }

    const b = 2 * (offsetX * deltaX + offsetY * deltaY);
    const discriminant = b * b - 4 * lengthSquared * c;
    if (discriminant < 0) {
      return null;
    }

    const root = Math.sqrt(discriminant);
    const first = (-b - root) / (2 * lengthSquared);
    const second = (-b + root) / (2 * lengthSquared);
    if (first >= 0 && first <= 1) {
      return first;
    }
    if (second >= 0 && second <= 1) {
      return second;
    }

    return null;
  }

  protected resolvePlayerMobOverlap(player: BasePlayerState, mob: MobState) {
    const minDistance = this.profile.playerMobCollisionRadius + 2;
    const deltaX = player.x - mob.x;
    const deltaY = player.y - mob.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance >= minDistance) {
      return;
    }

    const directionX = distance > 0.001 ? deltaX / distance : 1;
    const directionY = distance > 0.001 ? deltaY / distance : 0;
    const targetX = mob.x + directionX * minDistance;
    const targetY = mob.y + directionY * minDistance;
    if (this.canTeleportTo(targetX, targetY, player.id)) {
      player.x = targetX;
      player.y = targetY;
    }
  }

  protected applySkeletonDashHits(
    mob: MobState,
    players: BasePlayerState[],
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ) {
    const hitTargets = this.mobSkillHitTargets.get(mob.id) ?? new Set<string>();
    const collisionRadius = this.profile.playerMobCollisionRadius;
    let firstCollision:
      | {
        player: BasePlayerState;
        t: number;
      }
      | null = null;

    for (const player of players) {
      if (player.dead || hitTargets.has(player.id)) {
        continue;
      }

      const collisionT = this.getSegmentCircleCollisionT(
        fromX,
        fromY,
        toX,
        toY,
        player.x,
        player.y,
        collisionRadius,
      );
      if (collisionT === null) {
        continue;
      }

      if (!firstCollision || collisionT < firstCollision.t) {
        firstCollision = { player, t: collisionT };
      }
    }

    if (!firstCollision) {
      this.mobSkillHitTargets.set(mob.id, hitTargets);
      return false;
    }

    const collisionX = fromX + (toX - fromX) * firstCollision.t;
    const collisionY = fromY + (toY - fromY) * firstCollision.t;
    mob.x = collisionX;
    mob.y = collisionY;
    mob.targetX = collisionX;
    mob.targetY = collisionY;

    const resolvedDamage = this.applyDamageToPlayer(
      firstCollision.player,
      SKELETON_DASH_SKILL.damage,
      SKELETON_DASH_SKILL.damageType,
    );
    hitTargets.add(firstCollision.player.id);
    this.onCombatLog(
      `${mob.name} uses ${SKELETON_DASH_SKILL.name} on ${firstCollision.player.name} for ${resolvedDamage}.`,
    );

    if (firstCollision.player.health <= 0) {
      this.handlePlayerKilled(firstCollision.player);
    }

    const knockbackDistance = this.profile.tileSize; // 1 tile
    const tileSize = this.profile.tileSize;
    const widthPx = this.getMapWidthPx();
    const heightPx = this.getMapHeightPx();
    this.pushTargetByKnockback(collisionX, collisionY, firstCollision.player, knockbackDistance, (nx, ny) => {
      firstCollision!.player.x = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, nx));
      firstCollision!.player.y = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, ny));
    });

    this.resolvePlayerMobOverlap(firstCollision.player, mob);
    this.mobSkillHitTargets.set(mob.id, hitTargets);
    return true;
  }

  protected tryRunSkeletonDash(
    mob: MobState,
    targetPlayer: BasePlayerState | null,
    players: BasePlayerState[],
    now: number,
  ) {
    if (this.resolveMobKind(mob) !== "skeleton") {
      return false;
    }

    if (mob.skillLungeEndsAt > now && mob.skillLungeStartedAt > 0) {
      const duration = Math.max(1, mob.skillLungeEndsAt - mob.skillLungeStartedAt);
      const progress = Math.max(0, Math.min(1, (now - mob.skillLungeStartedAt) / duration));
      const previousX = mob.x;
      const previousY = mob.y;
      mob.x = mob.skillLungeFromX + (mob.skillLungeToX - mob.skillLungeFromX) * progress;
      mob.y = mob.skillLungeFromY + (mob.skillLungeToY - mob.skillLungeFromY) * progress;
      mob.targetX = mob.skillLungeToX;
      mob.targetY = mob.skillLungeToY;
      const hitAnyTarget = this.applySkeletonDashHits(mob, players, previousX, previousY, mob.x, mob.y);
      if (hitAnyTarget) {
        this.clearMobSkillState(mob);
      }
      return true;
    }

    if (mob.skillLungeEndsAt > 0 && now >= mob.skillLungeEndsAt) {
      const previousX = mob.x;
      const previousY = mob.y;
      mob.x = mob.skillLungeToX;
      mob.y = mob.skillLungeToY;
      this.applySkeletonDashHits(mob, players, previousX, previousY, mob.x, mob.y);
      this.clearMobSkillState(mob);
      return true;
    }

    if (mob.castingSkillId === SKELETON_DASH_SKILL_ID && mob.castEndsAt > now) {
      mob.targetX = mob.x;
      mob.targetY = mob.y;
      return true;
    }

    if (mob.castingSkillId === SKELETON_DASH_SKILL_ID && mob.castEndsAt > 0 && now >= mob.castEndsAt) {
      const destination = this.resolveSkeletonDashDestination(mob, targetPlayer);
      const distance = Math.hypot(destination.x - mob.x, destination.y - mob.y);
      const lungeDurationMs =
        distance <= 0.001
          ? 1
          : Math.max(120, Math.round((distance / SKELETON_DASH_SKILL.lungeSpeedPxPerSec) * 1000));
      mob.skillLungeStartedAt = now;
      mob.skillLungeEndsAt = now + lungeDurationMs;
      mob.skillLungeFromX = mob.x;
      mob.skillLungeFromY = mob.y;
      mob.skillLungeToX = destination.x;
      mob.skillLungeToY = destination.y;
      mob.targetX = destination.x;
      mob.targetY = destination.y;
      this.mobSkillHitTargets.set(mob.id, new Set<string>());
      return true;
    }

    if (!targetPlayer || targetPlayer.dead) {
      return false;
    }

    const triggerDistance = this.profile.tileSize * SKELETON_DASH_SKILL.triggerDistanceTiles;
    const distanceToTarget = Math.hypot(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
    if (distanceToTarget > triggerDistance) {
      return false;
    }

    if (mob.attackCooldownEndsAt > now) {
      mob.targetX = mob.x;
      mob.targetY = mob.y;
      return true;
    }

    this.startSkeletonDashCast(mob, now);
    return true;
  }

  // ── Projectile system ────────────────────────────────────────────
  protected updateProjectilesShared(deltaSeconds: number, now = Date.now()) {
    this.rebuildSpatialGrids();
    const tileSize = this.profile.tileSize;
    const widthPx = this.getMapWidthPx();
    const heightPx = this.getMapHeightPx();
    const p = this.profile;

    for (const [projectileId, projectile] of this.roomProjectiles.entries()) {
      const sd = this.projectileServerData.get(projectileId);
      if (!sd) {
        this.roomProjectiles.delete(projectileId);
        continue;
      }

      // Homing
      if (sd.homingStrength > 0) {
        const closestTarget = this.findNearestProjectileTarget(projectile, 180);
        if (closestTarget) {
          const desiredX = (closestTarget.entity.x - projectile.x) / Math.max(closestTarget.distance, 0.001);
          const desiredY = (closestTarget.entity.y - projectile.y) / Math.max(closestTarget.distance, 0.001);
          const steer = Math.min(1, sd.homingStrength * deltaSeconds);
          const nextDirX = projectile.directionX + (desiredX - projectile.directionX) * steer;
          const nextDirY = projectile.directionY + (desiredY - projectile.directionY) * steer;
          const length = Math.hypot(nextDirX, nextDirY);
          if (length > 0.001) {
            projectile.directionX = nextDirX / length;
            projectile.directionY = nextDirY / length;
          }
        }
      }

      // Orbit
      if (sd.orbitTimeRemaining > 0) {
        const owner = this.getPlayer(projectile.ownerId);
        if (owner && !owner.dead) {
          const elapsed = sd.orbitTimeRemaining > deltaSeconds * 1000
            ? deltaSeconds * 1000
            : sd.orbitTimeRemaining;
          sd.orbitTimeRemaining -= elapsed;
          const angle = (now / 1000) * Math.PI * 4;
          projectile.x = owner.x + Math.cos(angle) * sd.orbitRadius;
          projectile.y = owner.y + Math.sin(angle) * sd.orbitRadius;
          projectile.originX = owner.x;
          projectile.originY = owner.y;
          continue;
        }
        sd.orbitTimeRemaining = 0;
      }

      const previousX = projectile.x;
      const previousY = projectile.y;
      const speed = projectile.speed > 0 ? projectile.speed : p.fireballSpeed;

      // Spiral movement
      if (projectile.spiralAmplitude > 0 && projectile.spiralFrequency > 0) {
        const prevOffset = Math.sin(projectile.spiralPhase) * projectile.spiralAmplitude;
        projectile.spiralPhase += speed * deltaSeconds * projectile.spiralFrequency * 0.01;
        const nextOffset = Math.sin(projectile.spiralPhase) * projectile.spiralAmplitude;
        const offsetDelta = nextOffset - prevOffset;
        sd.distanceTraveled += speed * deltaSeconds;
        const perpX = -projectile.directionY;
        const perpY = projectile.directionX;
        projectile.x += projectile.directionX * speed * deltaSeconds + perpX * offsetDelta;
        projectile.y += projectile.directionY * speed * deltaSeconds + perpY * offsetDelta;
      } else {
        projectile.x += projectile.directionX * speed * deltaSeconds;
        projectile.y += projectile.directionY * speed * deltaSeconds;
      }

      projectile.lifetime -= deltaSeconds;

      // Lifetime expired
      if (projectile.lifetime <= 0) {
        if (this.canProjectileReturn(projectile) && this.startProjectileReturn(projectile)) {
          continue;
        }
        this.deleteProjectile(projectileId);
        continue;
      }

      // Out of bounds
      const pad = p.projectileBoundsPadding;
      if (
        projectile.x < -pad ||
        projectile.y < -pad ||
        projectile.x > widthPx + pad ||
        projectile.y > heightPx + pad
      ) {
        this.deleteProjectile(projectileId);
        continue;
      }

      // Returned to origin
      if (
        projectile.returning &&
        Math.hypot(projectile.x - projectile.originX, projectile.y - projectile.originY) <= 12
      ) {
        this.deleteProjectile(projectileId);
        continue;
      }

      // Tile collision
      const tileX = Math.floor(projectile.x / tileSize);
      const tileY = Math.floor(projectile.y / tileSize);
      if (this.isBlockedTile(tileX, tileY)) {
        if (this.tryBounceProjectile(projectile, previousX, previousY)) {
          continue;
        }
        this.applyProjectileSplash(projectile, sd, projectile.x, projectile.y, null);
        this.explodeFireballIntoShards(projectile);
        this.deleteProjectile(projectileId);
        continue;
      }

      // Fire trail
      if (this.canProjectileLeaveTrail(projectile)) {
        this.createFireTrail(projectile.ownerId, tileX, tileY, now);
      }

      if (!shouldProjectileDealDirectDamage(projectile.skillId)) {
        continue;
      }

      // Hit detection
      const hitHistory = this.getProjectileHitHistory(projectileId);
      let hitPlayer = false;

      for (const player of this.queryNearbyPlayers(projectile.x, projectile.y, p.playerHitRadius)) {
        if (player.dead || !this.canProjectileHitPlayer(projectile, sd, player) || hitHistory.has(`player:${player.id}`)) {
          continue;
        }

        const attacker = this.getPlayer(projectile.ownerId);
        const { damage: resolvedDamage, isCritical } = this.getProjectileDirectDamage(projectile, sd, player.health, player.maxHealth);
        const finalDamage = this.applyDamageToPlayer(player, resolvedDamage, "fire");
        this.applyProjectileLifesteal(projectile.ownerId, finalDamage, player.id);
        this.onCombatLog(`${attacker?.name || "Wanderer"} hits ${player.name} for ${finalDamage}.`);
        if (isCritical && finalDamage > 0) {
          this.broadcastDamageText(player.x, player.y - 18, `-${finalDamage}`);
        }
        this.applyBurnToPlayer(player, this.getSkillBalanceKey(projectile.skillId), projectile.ownerId);
        this.pushTargetByKnockback(projectile.x, projectile.y, player, sd.knockbackDistance, (nx, ny) => {
          player.x = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, nx));
          player.y = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, ny));
        });
        this.applyProjectileSplash(projectile, sd, projectile.x, projectile.y, `player:${player.id}`);
        hitHistory.add(`player:${player.id}`);

        if (player.health <= 0) {
          this.handlePlayerKilled(player);
        }

        if (sd.piercesRemaining > 0) {
          sd.piercesRemaining -= 1;
          hitPlayer = true;
          break;
        }

        if (this.tryChainProjectile(projectile, sd, `player:${player.id}`)) {
          hitPlayer = true;
          break;
        }

        this.applyOnHitGemEffects(projectile, sd);
        this.explodeFireballIntoShards(projectile);
        this.deleteProjectile(projectileId);
        hitPlayer = true;
        break;
      }

      if (hitPlayer) {
        continue;
      }

      let hitMob = false;
      for (const mob of this.queryNearbyMobs(projectile.x, projectile.y, p.mobHitRadius)) {
        if (mob.dead || hitHistory.has(`mob:${mob.id}`)) {
          continue;
        }

        const attacker = this.getPlayer(projectile.ownerId);
        const { damage: resolvedDamage, isCritical } = this.getProjectileDirectDamage(projectile, sd, mob.health, mob.maxHealth);
        mob.health = Math.max(0, mob.health - resolvedDamage);
        this.applyProjectileLifesteal(projectile.ownerId, resolvedDamage);
        if (attacker && !attacker.dead) {
          setMobAggroTarget(mob, attacker);
        }
        this.onCombatLog(`${attacker?.name || "Wanderer"} hits ${mob.name} for ${resolvedDamage}.`);
        if (isCritical && resolvedDamage > 0) {
          this.broadcastDamageText(mob.x, mob.y - 18, `-${resolvedDamage}`);
        }
        this.applyBurnToMob(mob, this.getSkillBalanceKey(projectile.skillId), projectile.ownerId);
        this.pushTargetByKnockback(projectile.x, projectile.y, mob, sd.knockbackDistance, (nx, ny) => {
          mob.x = nx;
          mob.y = ny;
        });
        this.applyProjectileSplash(projectile, sd, projectile.x, projectile.y, `mob:${mob.id}`);
        hitHistory.add(`mob:${mob.id}`);
        hitMob = true;

        if (mob.health <= 0) {
          this.handleMobDeath(mob);
          this.awardExperience(projectile.ownerId, mob.experienceReward);
        }

        if (sd.piercesRemaining > 0) {
          sd.piercesRemaining -= 1;
          break;
        }

        if (this.tryChainProjectile(projectile, sd, `mob:${mob.id}`)) {
          break;
        }

        this.applyOnHitGemEffects(projectile, sd);
        this.explodeFireballIntoShards(projectile);
        this.deleteProjectile(projectileId);
        break;
      }

      if (hitMob) {
        continue;
      }
    }
  }

  /** Clean up both schema and server data for a projectile. */
  protected deleteProjectile(projectileId: string) {
    this.projectileHitHistory.delete(projectileId);
    this.projectileServerData.delete(projectileId);
    this.roomProjectiles.delete(projectileId);
  }

  // ── Projectile helpers ───────────────────────────────────────────

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
    const p = this.profile;
    const gemConfig = this.getOwnerProjectileGemConfig(ownerId, skillId);
    const projectile = this.createProjectileState();
    projectile.id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    projectile.ownerId = ownerId;
    projectile.skillId = skillId;
    projectile.x = x;
    projectile.y = y;
    projectile.directionX = directionX;
    projectile.directionY = directionY;
    projectile.originX = x;
    projectile.originY = y;
    const serverData = createDefaultProjectileServerData();
    applyGemConfigToProjectile(projectile, serverData, gemConfig, {
      bounceCount: this.getProjectileBounceCount(ownerId, skillId),
      rangeMultiplier: this.getProjectileRangeMultiplier(ownerId, skillId),
      fireballSpeed: p.fireballSpeed,
      selfHitGraceMs: p.fireballSelfHitGraceMs,
      now: Date.now(),
      lifetime,
      damageScale,
      sizeScale,
    });
    this.roomProjectiles.set(projectile.id, projectile);
    this.projectileServerData.set(projectile.id, serverData);
  }

  /** Subclasses must provide the concrete ProjectileState constructor. */
  protected abstract createProjectileState(): ProjectileState;

  protected canProjectileReturn(projectile: ProjectileState) {
    return !projectile.returning && this.isProjectileReturningEnabled(projectile);
  }

  protected startProjectileReturn(projectile: ProjectileState) {
    return startSharedProjectileReturn(projectile, this.profile.fireballSpeed);
  }

  protected explodeFireballIntoShards(projectile: ProjectileState) {
    if (!this.canProjectileShatter(projectile)) {
      return;
    }
    const p = this.profile;
    for (let index = 0; index < p.fireballShardCount; index += 1) {
      const angle = (Math.PI * 2 * index) / p.fireballShardCount;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      this.spawnProjectile(
        projectile.ownerId,
        FIREBALL_SHARD_SKILL_ID,
        projectile.x + dirX * 6,
        projectile.y + dirY * 6,
        dirX,
        dirY,
        p.fireballShardLifetime,
        0,
        0.6,
      );
    }
  }

  protected tryBounceProjectile(projectile: ProjectileState, previousX: number, previousY: number) {
    const tileSize = this.profile.tileSize;
    return trySharedProjectileBounce(
      projectile,
      previousX,
      previousY,
      this.isBlockedTile(Math.floor(projectile.x / tileSize), Math.floor(previousY / tileSize)),
      this.isBlockedTile(Math.floor(previousX / tileSize), Math.floor(projectile.y / tileSize)),
    );
  }

  protected tryChainProjectile(projectile: ProjectileState, sd: ProjectileServerData, excludeEntityId: string) {
    if (sd.chainRemaining <= 0) {
      return false;
    }
    const bestTarget = this.findNearestProjectileTarget(projectile, 180, excludeEntityId);
    if (!bestTarget) {
      return false;
    }
    const dx = bestTarget.entity.x - projectile.x;
    const dy = bestTarget.entity.y - projectile.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) {
      return false;
    }
    projectile.directionX = dx / distance;
    projectile.directionY = dy / distance;
    sd.chainRemaining -= 1;
    return true;
  }

  protected applyProjectileSplash(projectile: ProjectileState, sd: ProjectileServerData, hitX: number, hitY: number, excludedEntityId: string | null) {
    if (sd.splashRadius <= 0 || sd.splashDamageScale <= 0) {
      return;
    }

    const splashDamage = Math.max(
      0,
      Math.round(this.getSkillDirectDamage(projectile.skillId) * sd.splashDamageScale * this.getProjectileDamageScale(projectile, sd)),
    );
    if (splashDamage <= 0) {
      return;
    }

    for (const player of this.queryNearbyPlayers(hitX, hitY, sd.splashRadius)) {
      if (player.dead || `player:${player.id}` === excludedEntityId) {
        continue;
      }
      const dealt = this.applyDamageToPlayer(player, splashDamage, "fire");
      this.applyProjectileLifesteal(projectile.ownerId, dealt, player.id);
      if (player.health <= 0) {
        this.handlePlayerKilled(player);
      }
    }

    for (const mob of this.queryNearbyMobs(hitX, hitY, sd.splashRadius)) {
      if (mob.dead || `mob:${mob.id}` === excludedEntityId) {
        continue;
      }
      mob.health = Math.max(0, mob.health - splashDamage);
      this.applyProjectileLifesteal(projectile.ownerId, splashDamage);
      if (mob.health <= 0) {
        this.handleMobDeath(mob);
        this.awardExperience(projectile.ownerId, mob.experienceReward);
      }
    }
  }

  protected applyOnHitGemEffects(projectile: ProjectileState, sd: ProjectileServerData) {
    const p = this.profile;
    const { spawns, aftershock } = buildOnHitProjectileEffects(projectile, sd, {
      fireballLifetime: p.fireballLifetime,
      fireballShardLifetime: p.fireballShardLifetime,
      shardSkillId: FIREBALL_SHARD_SKILL_ID,
    });

    spawns.forEach((spawn) => {
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

    if (aftershock) {
      this.pendingAftershocks.push(aftershock);
    }
  }

  protected canProjectileHitPlayer(projectile: ProjectileState, sd: ProjectileServerData, player: BasePlayerState) {
    return canProjectileHitOwner(projectile, sd.selfHitGraceEndsAt, player.id, this.profile.fireballSelfHitArmDistance);
  }

  // ── Skill cast helpers ───────────────────────────────────────────

  protected canPerformFireballCast(player: BasePlayerState, targetX: number, targetY: number) {
    const startX = player.x;
    const startY = player.y + this.profile.fireballSpawnOffsetY;
    return Math.hypot(targetX - startX, targetY - startY) > 0.001;
  }

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

    plan.delayedSpawns.forEach((burst) => this.pendingBurstSpawns.push(burst));
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

  protected performFireFieldCast(player: BasePlayerState, targetX: number, targetY: number, now = Date.now()) {
    this.createFireField(player, targetX, targetY, now);
    return 0;
  }

  protected clampTargetToCastRange(
    player: BasePlayerState,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
  ) {
    const deltaX = targetX - originX;
    const deltaY = targetY - originY;
    const distance = Math.hypot(deltaX, deltaY);
    const castRange = getFireballCastRange(this.profile.staffCastRange, player);

    if (distance <= castRange || distance <= 0.001) {
      return { x: targetX, y: targetY };
    }

    const scale = castRange / distance;
    return {
      x: originX + deltaX * scale,
      y: originY + deltaY * scale,
    };
  }

  // ── Fire field / trail ───────────────────────────────────────────

  protected createFireField(player: BasePlayerState, targetX: number, targetY: number, now: number) {
    const tileSize = this.profile.tileSize;
    const p = this.profile;
    const centerTileX = Math.max(0, Math.min(this.getMapWidthTiles() - 1, Math.floor(targetX / tileSize)));
    const centerTileY = Math.max(0, Math.min(this.getMapHeightTiles() - 1, Math.floor(targetY / tileSize)));

    for (const { tileX, tileY } of buildGroundEffectTileArea({
      centerTileX,
      centerTileY,
      radiusTiles: p.fireFieldRadiusTiles,
      width: this.getMapWidthTiles(),
      height: this.getMapHeightTiles(),
      isBlocked: (tx, ty) => this.isBlockedTile(tx, ty),
    })) {
      const effectId = `fire-field-${player.id}-${tileX}-${tileY}`;
      let effect = this.roomGroundEffects.get(effectId);
      if (!effect) {
        effect = new GroundEffectState();
        effect.id = effectId;
        effect.ownerId = player.id;
        effect.skillId = "fireField";
        effect.tileX = tileX;
        effect.tileY = tileY;
        effect.x = tileX * tileSize + tileSize / 2;
        effect.y = tileY * tileSize + tileSize / 2;
        this.roomGroundEffects.set(effectId, effect);
      }

      effect.ownerId = player.id;
      effect.expiresAt = now + p.fireFieldDurationMs;
      effect.nextTickAt = now + p.fireFieldTickMs;
    }
  }

  protected createFireTrail(ownerId: string, tileX: number, tileY: number, now: number) {
    const tileSize = this.profile.tileSize;
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= this.getMapWidthTiles() ||
      tileY >= this.getMapHeightTiles() ||
      this.isBlockedTile(tileX, tileY)
    ) {
      return;
    }

    const p = this.profile;
    const effectId = `fire-trail-${ownerId}-${tileX}-${tileY}`;
    let effect = this.roomGroundEffects.get(effectId);
    if (!effect) {
      effect = new GroundEffectState();
      effect.id = effectId;
      effect.ownerId = ownerId;
      effect.skillId = "fireTrail";
      effect.tileX = tileX;
      effect.tileY = tileY;
      effect.x = tileX * tileSize + tileSize / 2;
      effect.y = tileY * tileSize + tileSize / 2;
      this.roomGroundEffects.set(effectId, effect);
    }

    effect.ownerId = ownerId;
    effect.expiresAt = now + Math.round(p.fireTrailDurationMs * this.getOwnerProjectileGemConfig(ownerId, "fireball").durationMultiplier);
    effect.nextTickAt = now + p.fireTrailTickMs;
  }

  // ── Burn helpers ─────────────────────────────────────────────────

  protected applyBurnToPlayer(player: BasePlayerState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string) {
    applyRoomBurnToEntity({
      service: this.playerBurns,
      entityId: player.id,
      entity: player,
      sourceSkill,
      ownerId,
      skillBalance: this.skillBalance,
      burnTickMs: this.profile.fireballBurnTickMs,
      getDurationMultiplier: (nextOwnerId) => this.getOwnerProjectileGemConfig(nextOwnerId, "fireball").durationMultiplier,
    });
  }

  protected applyBurnToMob(mob: MobState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string) {
    applyRoomBurnToEntity({
      service: this.mobBurns,
      entityId: mob.id,
      entity: mob,
      sourceSkill,
      ownerId,
      skillBalance: this.skillBalance,
      burnTickMs: this.profile.fireballBurnTickMs,
      getDurationMultiplier: (nextOwnerId) => this.getOwnerProjectileGemConfig(nextOwnerId, "fireball").durationMultiplier,
    });
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
    mob.dead = true;
    mob.aggroTargetId = "";
    mob.aggroLockedUntil = 0;
    mob.health = 0;
    mob.burnTicksRemaining = 0;
    mob.burnEndsAt = 0;
    mob.respawnAt = Date.now() + this.profile.mobRespawnMs;
    mob.attackCooldownEndsAt = 0;
    this.clearMobSkillState(mob);
    clearMobPath(this.mobPathCache, mob.id);
    this.mobBurns.delete(mob.id);
    this.onCombatLog(`${mob.name} collapses.`);
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
    this.pendingSkillCasts.delete(player.id);
    this.pendingTeleportScrollCasts.delete(player.id);
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

  protected resolveLagCompensatedCastTiming(message: CastSkillMessage, now: number): LagCompensatedCastTiming {
    const maxRewindMs = Math.max(0, this.profile.lagCompensationMaxRewindMs);
    const estimatedLatencyMs = Number.isFinite(message.clientEstimatedLatencyMs)
      ? Math.floor(message.clientEstimatedLatencyMs!)
      : NaN;
    if (Number.isFinite(estimatedLatencyMs)) {
      const rewindMs = Math.max(0, Math.min(maxRewindMs, estimatedLatencyMs));
      return rewindMs > 0
        ? { at: now - rewindMs, enabled: true }
        : { at: now, enabled: false };
    }

    const clientSentAt = Number.isFinite(message.clientSentAt)
      ? Math.floor(message.clientSentAt!)
      : NaN;
    if (!Number.isFinite(clientSentAt)) {
      return { at: now, enabled: false };
    }

    const ageMs = now - clientSentAt;
    if (ageMs < 0 || ageMs > maxRewindMs) {
      return { at: now, enabled: false };
    }

    return { at: clientSentAt, enabled: true };
  }

  protected recordPlayerPositionHistory(now: number) {
    const keepAfter = now - this.profile.positionHistoryDurationMs;

    for (const player of this.roomPlayers.values()) {
      const history = this.playerPositionHistory.get(player.id) ?? [];
      const last = history[history.length - 1];
      if (!last || last.x !== player.x || last.y !== player.y || now - last.at >= this.simulationIntervalMs) {
        history.push({
          at: now,
          x: player.x,
          y: player.y,
        });
      }

      while (history.length > 1 && history[1]!.at < keepAfter) {
        history.shift();
      }
      this.playerPositionHistory.set(player.id, history);
    }

    for (const playerId of Array.from(this.playerPositionHistory.keys())) {
      if (!this.roomPlayers.has(playerId)) {
        this.playerPositionHistory.delete(playerId);
      }
    }
  }

  protected getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null {
    const history = this.playerPositionHistory.get(playerId);
    if (!history || history.length === 0) {
      return null;
    }

    if (at <= history[0]!.at) {
      return {
        x: history[0]!.x,
        y: history[0]!.y,
      };
    }

    for (let index = history.length - 1; index >= 0; index -= 1) {
      const current = history[index]!;
      if (current.at > at) {
        continue;
      }

      const next = history[index + 1];
      if (!next) {
        return {
          x: current.x,
          y: current.y,
        };
      }

      const span = Math.max(1, next.at - current.at);
      const t = Math.max(0, Math.min(1, (at - current.at) / span));
      return {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
    }

    return null;
  }

  protected rebuildMobSpatialGrid() {
    rebuildRoomSpatialGrid(this.mobSpatialGrid, this.mobSpatialOrder, this.roomMobs.values());
  }

  protected rebuildSpatialGrids() {
    rebuildRoomSpatialGrid(this.playerSpatialGrid, this.playerSpatialOrder, this.roomPlayers.values());
    this.rebuildMobSpatialGrid();
  }

  protected queryNearbyPlayers(x: number, y: number, radius: number) {
    return queryNearbyRoomEntities(this.playerSpatialGrid, this.playerSpatialOrder, x, y, radius);
  }

  protected queryNearbyMobs(x: number, y: number, radius: number) {
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
    applyRoomProjectileLifesteal(
      ownerId,
      resolvedDamage,
      targetPlayerId,
      (id) => this.getPlayer(id),
      (nextOwnerId, skillId) => this.getOwnerProjectileGemConfig(nextOwnerId, skillId),
    );
  }

  protected getProjectileHitHistory(projectileId: string) {
    let history = this.projectileHitHistory.get(projectileId);
    if (!history) {
      history = new Set<string>();
      this.projectileHitHistory.set(projectileId, history);
    }
    return history;
  }

  // ── Knockback ────────────────────────────────────────────────────

  protected pushTargetByKnockback(
    fromX: number,
    fromY: number,
    target: { x: number; y: number },
    knockbackDistance: number,
    applyPosition: (x: number, y: number) => void,
  ) {
    if (knockbackDistance <= 0) {
      return;
    }
    const deltaX = target.x - fromX;
    const deltaY = target.y - fromY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= 0.001) {
      return;
    }
    const nextX = target.x + (deltaX / distance) * knockbackDistance;
    const nextY = target.y + (deltaY / distance) * knockbackDistance;
    applyPosition(nextX, nextY);
  }

  // ── Damage text broadcast ────────────────────────────────────────

  protected broadcastDamageText(x: number, y: number, text: string, color = "#ff5959") {
    this.broadcast("damageText", { x, y, text, color });
  }

  // ── Balance config ───────────────────────────────────────────────

  protected serializeSkillBalanceConfig() {
    return cloneSkillBalanceConfig(this.skillBalance);
  }

  protected serializeMobBalanceConfig() {
    return cloneMobBalanceConfig(this.mobBalance);
  }

  protected applyBackendSkillBalance(data: Record<string, unknown>) {
    const sections = [
      [this.skillBalance.fireball, data.fireball],
      [this.skillBalance.fireNova, data.fireNova],
      [this.skillBalance.fireField, data.fireField],
    ] as const;

    for (const [target, patch] of sections) {
      if (!patch || typeof patch !== "object") {
        continue;
      }
      const p = patch as Record<string, unknown>;
      if (typeof p.damage === "number" && Number.isFinite(p.damage)) {
        target.damage = Math.max(0, Math.floor(p.damage));
      }
      if (typeof p.burnDamage === "number" && Number.isFinite(p.burnDamage)) {
        target.burnDamage = Math.max(0, Math.floor(p.burnDamage));
      }
      if (typeof p.burnTicks === "number" && Number.isFinite(p.burnTicks)) {
        target.burnTicks = Math.max(0, Math.floor(p.burnTicks));
      }
    }

    this.broadcast("skillBalanceConfig", this.serializeSkillBalanceConfig());
  }

  protected applyBackendMobBalance(data: Record<string, unknown>) {
    for (const kind of MOB_KINDS) {
      const target = this.mobBalance[kind];
      const patch = data[kind];
      if (!patch || typeof patch !== "object") {
        continue;
      }
      const p = patch as Record<string, unknown>;
      if (typeof p.maxHealth === "number" && Number.isFinite(p.maxHealth)) {
        target.maxHealth = Math.max(1, Math.floor(p.maxHealth));
      }
      if (typeof p.moveSpeed === "number" && Number.isFinite(p.moveSpeed)) {
        target.moveSpeed = Math.max(0, Math.floor(p.moveSpeed));
      }
      if (typeof p.aggroRange === "number" && Number.isFinite(p.aggroRange)) {
        target.aggroRange = Math.max(0, Math.floor(p.aggroRange));
      }
      if (typeof p.leashRange === "number" && Number.isFinite(p.leashRange)) {
        target.leashRange = Math.max(0, Math.floor(p.leashRange));
      }
      if (typeof p.attackRange === "number" && Number.isFinite(p.attackRange)) {
        target.attackRange = Math.max(0, Math.floor(p.attackRange));
      }
      if (typeof p.attackDamage === "number" && Number.isFinite(p.attackDamage)) {
        target.attackDamage = Math.max(0, Math.floor(p.attackDamage));
      }
      if (typeof p.attackCooldownMs === "number" && Number.isFinite(p.attackCooldownMs)) {
        target.attackCooldownMs = Math.max(0, Math.floor(p.attackCooldownMs));
      }
      if (typeof p.experienceReward === "number" && Number.isFinite(p.experienceReward)) {
        target.experienceReward = Math.max(0, Math.floor(p.experienceReward));
      }
    }

    this.applyMobBalanceToLiveMobs();
    this.broadcast("mobBalanceConfig", this.serializeMobBalanceConfig());
  }

  protected applyMobBalanceToLiveMobs() {
    for (const mob of this.roomMobs.values()) {
      const balance = this.getMobBalanceForMob(mob);
      const healthRatio = mob.maxHealth > 0 ? mob.health / mob.maxHealth : 1;
      this.applyMobBalance(mob, balance);
      mob.health = mob.dead ? 0 : Math.max(0, Math.min(mob.maxHealth, Math.round(mob.maxHealth * healthRatio)));
    }
  }

  protected applyMobBalance(mob: MobState, balance: MobBalanceSection) {
    mob.moveSpeed = balance.moveSpeed;
    mob.aggroRange = balance.aggroRange;
    mob.leashRange = balance.leashRange;
    mob.attackRange = balance.attackRange;
    mob.attackDamage = balance.attackDamage;
    mob.attackCooldownMs = balance.attackCooldownMs;
    mob.maxHealth = balance.maxHealth;
    mob.health = balance.maxHealth;
    mob.experienceReward = balance.experienceReward;
  }

  protected resolveMobKind(mob: MobState): MobKind {
    if (typeof mob.kind === "string" && isMobKind(mob.kind)) {
      return mob.kind;
    }

    if (isMobKind(mob.texture)) {
      return mob.texture;
    }

    return "rat";
  }

  protected getMobBalanceForMob(mob: MobState): MobBalanceSection {
    return this.mobBalance[this.resolveMobKind(mob)];
  }

  protected applyBackendItemBalance(data: Record<string, unknown>) {
    applyItemBalanceUpdate(this.itemFireResistance, data as ItemBalanceConfig);
  }

  // ── Convenience ──────────────────────────────────────────────────

  protected getPlayer(sessionId: string): TPlayer | undefined {
    return this.roomPlayers.get(sessionId);
  }
}
