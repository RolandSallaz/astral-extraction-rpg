import { type Client } from "colyseus";
import { type MapSchema } from "@colyseus/schema";
import type { SkillBalanceConfig } from "@mmorpg/shared";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { MobKind } from "@mmorpg/shared/mobs/catalog";
import type { ThrownConsumableMessage } from "@mmorpg/shared/realtime/contracts";
import type { ProjectileGemConfig } from "./fireballGems.js";
import type { MobPathCacheEntry } from "./mobPathing.js";
import type { BurstSpawnRequest, DamageType } from "./projectileSkills.js";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { ChestState } from "../schema/ChestState.js";
import type { GroundEffectState } from "../schema/GroundEffectState.js";
import type { MobState } from "../schema/MobState.js";
import type { ProjectileServerData, ProjectileState } from "../schema/ProjectileState.js";
import type { SkillCastContext } from "../skills/SkillHandler.js";
import type { SpatialGrid } from "../services/SpatialGrid.js";
import type { ProjectileSystem } from "../systems/ProjectileSystem.js";
import type { SkillCastSystem } from "../systems/SkillCastSystem.js";
import type { StatusEffectSystem } from "../systems/StatusEffectSystem.js";
import { clampTargetToCastRange as clampTargetToCastRangeRuntime } from "./castRuntime.js";
import type { ConsumableRuntimeContext } from "./consumableRuntime.js";
import {
  createFireField as createFireFieldRuntime,
  createFireTrail as createFireTrailRuntime,
} from "./groundEffectsRuntime.js";
import type { LagCompensatedCastTiming } from "./lagRuntime.js";
import {
  broadcastDamageText,
  broadcastThrownConsumable,
  type RoomMessageBroadcaster,
} from "./messageRuntime.js";
import type { MobRuntimeContext } from "./mobRuntime.js";
import {
  deleteProjectile as deleteProjectileRuntime,
  spawnProjectile as spawnProjectileRuntime,
  type ProjectileRuntimeContext,
} from "./projectileRuntime.js";
import {
  performWoodStaffStrike as performWoodStaffStrikeRuntime,
  type WoodStaffStrikeContext,
} from "./woodStaffStrikeRuntime.js";
import {
  performWoodStaffDash as performWoodStaffDashRuntime,
  type WoodStaffDashContext,
} from "./woodStaffDashRuntime.js";

type ProjectileTarget = { entity: BasePlayerState | MobState; distance: number } | null;

export interface BaseGameRoomRuntimeBindings {
  getProfile(): RoomGameplayProfile;
  getRoomPlayers(): MapSchema<BasePlayerState>;
  getRoomMobs(): MapSchema<MobState>;
  getRoomChests(): MapSchema<ChestState>;
  getRoomGroundEffects(): MapSchema<GroundEffectState>;
  getRoomProjectiles(): MapSchema<ProjectileState>;
  getClients(): readonly Client[];
  getConsumableCooldownEndsAt(): Map<string, Map<string, number>>;
  getStatusEffects(): StatusEffectSystem;
  getSkillCastSystem(): SkillCastSystem;
  getProjectileSystem(): ProjectileSystem;
  getProjectileServerData(): Map<string, ProjectileServerData>;
  getProjectileHitHistory(): Map<string, Set<string>>;
  getPlayerLatencyMs(): Map<string, number>;
  getMobSpatialGrid(): SpatialGrid<MobState>;
  getMobSpatialOrder(): Map<string, number>;
  getMobPathCache(): Map<string, MobPathCacheEntry>;
  getLosCache(): Map<string, boolean>;
  getMobSkillHitTargets(): Map<string, Set<string>>;
  getMapWidthPx(): number;
  getMapHeightPx(): number;
  getMapWidthTiles(): number;
  getMapHeightTiles(): number;
  isBlockedTile(tileX: number, tileY: number): boolean;
  canTeleportTo(x: number, y: number, playerId: string): boolean;
  getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null;
  ensureMobSpatialGrid(): void;
  ensureSpatialGrids(): void;
  markMobSpatialDirty(): void;
  queryNearbyPlayers(x: number, y: number, radius: number): Iterable<BasePlayerState>;
  queryNearbyMobs(x: number, y: number, radius: number): Iterable<MobState>;
  findNearestProjectileTarget(
    projectile: ProjectileState,
    maxDistance: number,
    excludedEntityId?: string,
  ): ProjectileTarget;
  getPlayer(playerId: string): BasePlayerState | undefined;
  createProjectileState(): ProjectileState;
  clearPlayerMovement(sessionId: string): void;
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  handleMobDeath(mob: MobState): void;
  awardExperience(playerId: string, amount: number): void;
  applyProjectileLifesteal(ownerId: string, resolvedDamage: number, targetPlayerId?: string): void;
  onCombatLog(text: string): void;
  broadcast(type: string, payload: unknown): void;
  getPlayerCastTimeMs(player: BasePlayerState): number;
  getOwnerProjectileGemConfig(ownerId: string, skillId: string): ProjectileGemConfig;
  hasSplitProjectileGem(ownerId: string): boolean;
  getProjectileDamageScale(projectile: ProjectileState, serverData: ProjectileServerData): number;
  getProjectileDirectDamage(
    projectile: ProjectileState,
    serverData: ProjectileServerData,
    targetHealth: number,
    targetMaxHealth: number,
  ): { damage: number; isCritical: boolean };
  getSkillBalanceKey(skillId: string): keyof SkillBalanceConfig;
  getSkillDirectDamage(skillId: string): number;
  getProjectileBounceCount(ownerId: string, skillId: string): number;
  getProjectileRangeMultiplier(ownerId: string, skillId: string): number;
  canProjectileLeaveTrail(projectile: ProjectileState): boolean;
  canProjectileShatter(projectile: ProjectileState): boolean;
  isProjectileReturningEnabled(projectile: ProjectileState): boolean;
  resolveMobKind(mob: MobState): MobKind;
}

export interface BaseGameRoomRuntime {
  readonly messageBroadcaster: RoomMessageBroadcaster;
  createSkillCastContext(
    sessionId: string,
    player: BasePlayerState,
    now: number,
    lagCompensation?: LagCompensatedCastTiming,
  ): SkillCastContext;
  consumableContext(): ConsumableRuntimeContext;
  mobContext(): MobRuntimeContext;
  woodStaffStrikeContext(): WoodStaffStrikeContext;
  woodStaffDashContext(): WoodStaffDashContext;
  projectileContext(): ProjectileRuntimeContext;
  createFireField(player: BasePlayerState, targetX: number, targetY: number, now: number): void;
  createFireTrail(ownerId: string, tileX: number, tileY: number, now: number): void;
  spawnProjectile(
    ownerId: string,
    skillId: string,
    x: number,
    y: number,
    directionX: number,
    directionY: number,
    lifetime: number,
    damageScale?: number,
    sizeScale?: number,
  ): void;
  deleteProjectile(projectileId: string): void;
  queueBurstSpawns(bursts: BurstSpawnRequest[]): void;
  broadcastDamageText(x: number, y: number, text: string, color?: string): void;
  broadcastThrownConsumable(payload: ThrownConsumableMessage): void;
}

export function createBaseGameRoomRuntime(bindings: BaseGameRoomRuntimeBindings): BaseGameRoomRuntime {
  const messageBroadcaster: RoomMessageBroadcaster = {
    broadcast: (type, payload) => {
      bindings.broadcast(type, payload);
    },
  };

  const createFireField = (
    player: BasePlayerState,
    targetX: number,
    targetY: number,
    now: number,
  ) => {
    createFireFieldRuntime({
      profile: bindings.getProfile(),
      playerId: player.id,
      targetX,
      targetY,
      now,
      groundEffects: bindings.getRoomGroundEffects(),
      getMapWidthTiles: () => bindings.getMapWidthTiles(),
      getMapHeightTiles: () => bindings.getMapHeightTiles(),
      isBlockedTile: (tileX, tileY) => bindings.isBlockedTile(tileX, tileY),
    });
  };

  const createFireTrail = (
    ownerId: string,
    tileX: number,
    tileY: number,
    now: number,
  ) => {
    createFireTrailRuntime({
      profile: bindings.getProfile(),
      ownerId,
      tileX,
      tileY,
      now,
      groundEffects: bindings.getRoomGroundEffects(),
      getMapWidthTiles: () => bindings.getMapWidthTiles(),
      getMapHeightTiles: () => bindings.getMapHeightTiles(),
      isBlockedTile: (nextTileX, nextTileY) => bindings.isBlockedTile(nextTileX, nextTileY),
      durationMultiplier: bindings.getOwnerProjectileGemConfig(ownerId, "fireball").durationMultiplier,
    });
  };

  const woodStaffStrikeContext = (): WoodStaffStrikeContext => ({
    profile: bindings.getProfile(),
    roomPlayers: bindings.getRoomPlayers(),
    queryNearbyMobs: (x, y, radius) => bindings.queryNearbyMobs(x, y, radius),
    getPlayerPositionAt: (playerId, at) => bindings.getPlayerPositionAt(playerId, at),
    applyDamageToPlayer: (player, amount, damageType) => bindings.applyDamageToPlayer(player, amount, damageType),
    canPushTargetTo: (x, y) => {
      const profile = bindings.getProfile();
      const tileX = Math.floor(x / profile.tileSize);
      const tileY = Math.floor(y / profile.tileSize);
      return (
        x >= profile.tileSize / 2 &&
        y >= profile.tileSize / 2 &&
        x <= bindings.getMapWidthPx() - profile.tileSize / 2 &&
        y <= bindings.getMapHeightPx() - profile.tileSize / 2 &&
        !bindings.isBlockedTile(tileX, tileY)
      );
    },
    handlePlayerKilled: (player) => bindings.handlePlayerKilled(player),
    handleMobDeath: (mob) => bindings.handleMobDeath(mob),
    awardExperience: (playerId, amount) => bindings.awardExperience(playerId, amount),
    broadcastDamageText: (x, y, text, color) => broadcastDamageText(messageBroadcaster, x, y, text, color),
    onCombatLog: (text) => bindings.onCombatLog(text),
  });

  const woodStaffDashContext = (): WoodStaffDashContext => ({
    profile: bindings.getProfile(),
    roomPlayers: bindings.getRoomPlayers(),
    queryNearbyMobs: (x, y, radius) => bindings.queryNearbyMobs(x, y, radius),
    canDashMoveTo: (x, y) => {
      const profile = bindings.getProfile();
      const tileX = Math.floor(x / profile.tileSize);
      const tileY = Math.floor(y / profile.tileSize);
      return (
        x >= profile.tileSize / 2 &&
        y >= profile.tileSize / 2 &&
        x <= bindings.getMapWidthPx() - profile.tileSize / 2 &&
        y <= bindings.getMapHeightPx() - profile.tileSize / 2 &&
        !bindings.isBlockedTile(tileX, tileY)
      );
    },
    applyDamageToPlayer: (player, amount, damageType) => bindings.applyDamageToPlayer(player, amount, damageType),
    handlePlayerKilled: (player) => bindings.handlePlayerKilled(player),
    handleMobDeath: (mob) => bindings.handleMobDeath(mob),
    awardExperience: (playerId, amount) => bindings.awardExperience(playerId, amount),
    broadcastDamageText: (x, y, text, color) => broadcastDamageText(messageBroadcaster, x, y, text, color),
    onCombatLog: (text) => bindings.onCombatLog(text),
  });

  const projectileContext = (): ProjectileRuntimeContext => ({
    state: {
      profile: bindings.getProfile(),
      roomProjectiles: bindings.getRoomProjectiles(),
      projectileServerData: bindings.getProjectileServerData(),
      projectileHitHistory: bindings.getProjectileHitHistory(),
      projectileSystem: bindings.getProjectileSystem(),
      getPlayer: (playerId) => bindings.getPlayer(playerId),
      createProjectileState: () => bindings.createProjectileState(),
    },
    spatial: {
      getMapWidthPx: () => bindings.getMapWidthPx(),
      getMapHeightPx: () => bindings.getMapHeightPx(),
      isBlockedTile: (tileX, tileY) => bindings.isBlockedTile(tileX, tileY),
      queryNearbyPlayers: (x, y, radius) => bindings.queryNearbyPlayers(x, y, radius),
      queryNearbyMobs: (x, y, radius) => bindings.queryNearbyMobs(x, y, radius),
      ensureSpatialGrids: () => bindings.ensureSpatialGrids(),
      findNearestProjectileTarget: (projectile, maxDistance, excludedEntityId) =>
        bindings.findNearestProjectileTarget(projectile, maxDistance, excludedEntityId),
    },
    combat: {
      applyDamageToPlayer: (player, amount, damageType) => bindings.applyDamageToPlayer(player, amount, damageType),
      handlePlayerKilled: (player) => bindings.handlePlayerKilled(player),
      handleMobDeath: (mob) => bindings.handleMobDeath(mob),
      markMobSpatialDirty: () => bindings.markMobSpatialDirty(),
      awardExperience: (playerId, amount) => bindings.awardExperience(playerId, amount),
      applyBurnToPlayer: (player, sourceSkill, ownerId) =>
        bindings.getStatusEffects().applyBurnToPlayer(player, sourceSkill, ownerId),
      applyBurnToMob: (mob, sourceSkill, ownerId) =>
        bindings.getStatusEffects().applyBurnToMob(mob, sourceSkill, ownerId),
      applyProjectileLifesteal: (ownerId, resolvedDamage, targetPlayerId) =>
        bindings.applyProjectileLifesteal(ownerId, resolvedDamage, targetPlayerId),
      pushTargetByKnockback: (fromX, fromY, target, knockbackDistance, applyPosition) => {
        const distance = Math.hypot(target.x - fromX, target.y - fromY);
        if (distance <= 0.001 || knockbackDistance <= 0) {
          return;
        }

        const directionX = (target.x - fromX) / distance;
        const directionY = (target.y - fromY) / distance;
        applyPosition(
          target.x + directionX * knockbackDistance,
          target.y + directionY * knockbackDistance,
        );
      },
      broadcastDamageText: (x, y, text, color) => broadcastDamageText(messageBroadcaster, x, y, text, color),
      onCombatLog: (text) => bindings.onCombatLog(text),
      createFireTrail,
    },
    skills: {
      getProjectileDamageScale: (projectile, serverData) =>
        bindings.getProjectileDamageScale(projectile, serverData),
      getProjectileDirectDamage: (projectile, serverData, targetHealth, targetMaxHealth) =>
        bindings.getProjectileDirectDamage(projectile, serverData, targetHealth, targetMaxHealth),
      getSkillBalanceKey: (skillId) => bindings.getSkillBalanceKey(skillId),
      getSkillDirectDamage: (skillId) => bindings.getSkillDirectDamage(skillId),
      getOwnerProjectileGemConfig: (ownerId, skillId) => bindings.getOwnerProjectileGemConfig(ownerId, skillId),
      getProjectileBounceCount: (ownerId, skillId) => bindings.getProjectileBounceCount(ownerId, skillId),
      getProjectileRangeMultiplier: (ownerId, skillId) => bindings.getProjectileRangeMultiplier(ownerId, skillId),
      canProjectileLeaveTrail: (projectile) => bindings.canProjectileLeaveTrail(projectile),
      canProjectileShatter: (projectile) => bindings.canProjectileShatter(projectile),
      isProjectileReturningEnabled: (projectile) => bindings.isProjectileReturningEnabled(projectile),
    },
  });

  const createSkillCastContext = (
    sessionId: string,
    player: BasePlayerState,
    now: number,
    lagCompensation: LagCompensatedCastTiming = { at: now, enabled: false },
  ): SkillCastContext => ({
    sessionId,
    player,
    profile: bindings.getProfile(),
    now,
    lagCompensatedAt: lagCompensation.at,
    lagCompensationEnabled: lagCompensation.enabled,
    weaponProgression: null,
    getPlayerCastTimeMs: (candidate) => bindings.getPlayerCastTimeMs(candidate),
    clampTargetToCastRange: (candidate, originX, originY, targetX, targetY) =>
      clampTargetToCastRangeRuntime(bindings.getProfile(), candidate, originX, originY, targetX, targetY),
    clearPlayerMovement: (nextSessionId) => bindings.clearPlayerMovement(nextSessionId),
    performWoodStaffStrike: (candidate, targetX, targetY) =>
      performWoodStaffStrikeRuntime(
        woodStaffStrikeContext(),
        sessionId,
        candidate,
        targetX,
        targetY,
        lagCompensation.at,
        lagCompensation.enabled,
      ),
    performWoodStaffDash: (candidate, targetX, targetY) =>
      performWoodStaffDashRuntime(
        woodStaffDashContext(),
        sessionId,
        candidate,
        targetX,
        targetY,
      ),
    getOwnerProjectileGemConfig: (ownerId, skillId) => bindings.getOwnerProjectileGemConfig(ownerId, skillId),
    hasSplitProjectileGem: (ownerId) => bindings.hasSplitProjectileGem(ownerId),
    spawnProjectile: (ownerId, skillId, x, y, directionX, directionY, lifetime, damageScale, sizeScale) =>
      spawnProjectileRuntime(
        projectileContext(),
        ownerId,
        skillId,
        x,
        y,
        directionX,
        directionY,
        lifetime,
        damageScale,
        sizeScale,
      ),
    queueBurstSpawns: (bursts) => bindings.getProjectileSystem().queueBurstSpawns(bursts),
    createFireField,
  });

  return {
    messageBroadcaster,
    createSkillCastContext,
    consumableContext: () => ({
      profile: bindings.getProfile(),
      consumableCooldownEndsAt: bindings.getConsumableCooldownEndsAt(),
      statusEffects: bindings.getStatusEffects(),
      skillCastSystem: bindings.getSkillCastSystem(),
      roomPlayers: bindings.getRoomPlayers(),
      roomMobs: bindings.getRoomMobs(),
      clients: bindings.getClients(),
      getMapWidthPx: () => bindings.getMapWidthPx(),
      getMapHeightPx: () => bindings.getMapHeightPx(),
      clearPlayerMovement: (sessionId) => bindings.clearPlayerMovement(sessionId),
      broadcastThrownConsumable: (payload) => broadcastThrownConsumable(messageBroadcaster, payload),
    }),
    mobContext: () => ({
      state: {
        profile: bindings.getProfile(),
        roomMobs: bindings.getRoomMobs(),
        roomChests: bindings.getRoomChests(),
        mobSpatialGrid: bindings.getMobSpatialGrid(),
        mobSpatialOrder: bindings.getMobSpatialOrder(),
        mobPathCache: bindings.getMobPathCache(),
        losCache: bindings.getLosCache(),
        mobSkillHitTargets: bindings.getMobSkillHitTargets(),
        statusEffects: bindings.getStatusEffects(),
        resolveMobKind: (mob) => bindings.resolveMobKind(mob),
      },
      spatial: {
        getMapWidthPx: () => bindings.getMapWidthPx(),
        getMapHeightPx: () => bindings.getMapHeightPx(),
        getMapWidthTiles: () => bindings.getMapWidthTiles(),
        getMapHeightTiles: () => bindings.getMapHeightTiles(),
        isBlockedTile: (tileX, tileY) => bindings.isBlockedTile(tileX, tileY),
        canTeleportTo: (x, y, playerId) => bindings.canTeleportTo(x, y, playerId),
        getPlayerPositionAt: (playerId, at) => bindings.getPlayerPositionAt(playerId, at),
        getPlayerLatencyMs: (playerId) => bindings.getPlayerLatencyMs().get(playerId) ?? 0,
        ensureMobSpatialGrid: () => bindings.ensureMobSpatialGrid(),
        markMobSpatialDirty: () => bindings.markMobSpatialDirty(),
      },
      combat: {
        applyDamageToPlayer: (player, amount, damageType) => bindings.applyDamageToPlayer(player, amount, damageType),
        handlePlayerKilled: (player) => bindings.handlePlayerKilled(player),
        onCombatLog: (text) => bindings.onCombatLog(text),
      },
    }),
    woodStaffStrikeContext,
    woodStaffDashContext,
    projectileContext,
    createFireField,
    createFireTrail,
    spawnProjectile: (ownerId, skillId, x, y, directionX, directionY, lifetime, damageScale, sizeScale) =>
      spawnProjectileRuntime(
        projectileContext(),
        ownerId,
        skillId,
        x,
        y,
        directionX,
        directionY,
        lifetime,
        damageScale,
        sizeScale,
      ),
    deleteProjectile: (projectileId) => {
      deleteProjectileRuntime(projectileContext(), projectileId);
    },
    queueBurstSpawns: (bursts) => bindings.getProjectileSystem().queueBurstSpawns(bursts),
    broadcastDamageText: (x, y, text, color) => {
      broadcastDamageText(messageBroadcaster, x, y, text, color);
    },
    broadcastThrownConsumable: (payload) => {
      broadcastThrownConsumable(messageBroadcaster, payload);
    },
  };
}
