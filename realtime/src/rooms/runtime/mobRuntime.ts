import { type MapSchema } from "@colyseus/schema";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { type MobKind } from "@mmorpg/shared/mobs/catalog";
import {
  SKELETON_DASH_SKILL,
  SKELETON_DASH_SKILL_ID,
} from "@mmorpg/shared/mobs/skills";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import type { ChestState } from "../schema/ChestState.js";
import {
  getEffectiveMobAttackRange,
  getMobDesiredTargetPosition,
  moveMobTowards,
  resetMobToSpawn,
  resolveMobAggroTarget,
} from "../mobAi.js";
import {
  clearMobPath,
  hasGridLineOfSight,
  resolveMobPathTarget,
  type MobPathCacheEntry,
} from "../mobPathing.js";
import { SpatialGrid } from "../services/SpatialGrid.js";
import type { StatusEffectSystem } from "../systems/StatusEffectSystem.js";
import type { DamageType } from "../projectileSkills.js";
import { tryCreateMobLootChest } from "./chestRuntime.js";
import { getSegmentEllipseCollisionT } from "./geometry.js";
import { pushTargetByKnockback as pushTargetByKnockbackRuntime } from "./knockbackRuntime.js";

const MOB_RESPAWN_MIN_PLAYER_DISTANCE_PX = 8 * 16;

function getLagCompensatedPlayerPosition(
  ctx: MobRuntimeContext,
  player: BasePlayerState,
  now: number,
): { x: number; y: number } {
  const latency = ctx.spatial.getPlayerLatencyMs(player.id);
  if (latency <= 0) {
    return { x: player.x, y: player.y };
  }
  const rewound = ctx.spatial.getPlayerPositionAt(player.id, now - latency);
  return rewound ?? { x: player.x, y: player.y };
}

export interface MobRuntimeContext {
  state: MobStateContext;
  spatial: MobSpatialQueryContext;
  combat: MobCombatContext;
}

export interface MobStateContext {
  profile: RoomGameplayProfile;
  roomMobs: MapSchema<MobState>;
  roomChests: MapSchema<ChestState>;
  mobSpatialGrid: SpatialGrid<MobState>;
  mobSpatialOrder: Map<string, number>;
  mobPathCache: Map<string, MobPathCacheEntry>;
  losCache: Map<string, boolean>;
  mobSkillHitTargets: Map<string, Set<string>>;
  statusEffects: StatusEffectSystem;
  resolveMobKind(mob: MobState): MobKind;
}

export interface MobSpatialQueryContext {
  getMapWidthPx(): number;
  getMapHeightPx(): number;
  getMapWidthTiles(): number;
  getMapHeightTiles(): number;
  isBlockedTile(tileX: number, tileY: number): boolean;
  canTeleportTo(x: number, y: number, playerId: string): boolean;
  getPlayerPositionAt(playerId: string, at: number): { x: number; y: number } | null;
  getPlayerLatencyMs(playerId: string): number;
  ensureMobSpatialGrid(): void;
  markMobSpatialDirty(): void;
}

export interface MobCombatContext {
  applyDamageToPlayer(player: BasePlayerState, amount: number, damageType: DamageType): number;
  handlePlayerKilled(player: BasePlayerState): void;
  onCombatLog(text: string): void;
}

export function updateRoomMobs(
  ctx: MobRuntimeContext,
  deltaSeconds: number,
  players: BasePlayerState[],
  getDesiredTarget: ((mob: MobState, targetPlayer: BasePlayerState | null, now: number) => { x: number; y: number } | null) | undefined,
  now: number,
): void {
  const tileSize = ctx.state.profile.tileSize;
  ctx.spatial.ensureMobSpatialGrid();
  ctx.state.losCache.clear();

  for (const mob of ctx.state.roomMobs.values()) {
    const previousX = mob.x;
    const previousY = mob.y;
    const previousDead = mob.dead;

    if (mob.dead) {
      if (mob.respawnAt > 0 && now >= mob.respawnAt) {
        const respawnX = mob.spawnX > 0 ? mob.spawnX : mob.x;
        const respawnY = mob.spawnY > 0 ? mob.spawnY : mob.y;
        const playerTooClose = players.some(
          (player) =>
            !player.dead &&
            Math.hypot(player.x - respawnX, player.y - respawnY) < MOB_RESPAWN_MIN_PLAYER_DISTANCE_PX,
        );
        if (!playerTooClose) {
          resetMobToSpawn(mob);
          clearMobPath(ctx.state.mobPathCache, mob.id);
          ctx.state.statusEffects.deleteMobBurn(mob.id);
        }
      }
      markMobSpatialStateDirty(ctx, mob, previousX, previousY, previousDead);
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
        const cached = ctx.state.losCache.get(cacheKey);
        if (cached !== undefined) {
          return cached;
        }
        const result = hasGridLineOfSight(
          { x: mobTileX, y: mobTileY },
          { x: playerTileX, y: playerTileY },
          {
            tileSize,
            width: ctx.spatial.getMapWidthTiles(),
            height: ctx.spatial.getMapHeightTiles(),
            isBlocked: (tx, ty) => ctx.spatial.isBlockedTile(tx, ty),
          },
        );
        ctx.state.losCache.set(cacheKey, result);
        return result;
      },
    });

    if (tryRunSkeletonDash(ctx, mob, targetPlayer, players, now)) {
      markMobSpatialStateDirty(ctx, mob, previousX, previousY, previousDead);
      continue;
    }

    if (targetPlayer) {
      const rewindPosition = getLagCompensatedPlayerPosition(ctx, targetPlayer, now);
      const distance = Math.hypot(rewindPosition.x - mob.x, rewindPosition.y - mob.y);
      if (ctx.state.resolveMobKind(mob) !== "skeleton" && distance <= getEffectiveMobAttackRange(mob)) {
        attackPlayerFromMob(ctx, mob, targetPlayer, now);
        markMobSpatialStateDirty(ctx, mob, previousX, previousY, previousDead);
        continue;
      }
    }

    const customTarget = getDesiredTarget?.(mob, targetPlayer, now);
    const desiredTarget = customTarget ?? getMobDesiredTargetPosition(mob, targetPlayer, now);
    const movementTarget = resolveMobPathTarget(mob, {
      now,
      desiredX: desiredTarget.x,
      desiredY: desiredTarget.y,
      cache: ctx.state.mobPathCache,
      grid: {
        tileSize,
        width: ctx.spatial.getMapWidthTiles(),
        height: ctx.spatial.getMapHeightTiles(),
        isBlocked: (tx, ty) => ctx.spatial.isBlockedTile(tx, ty),
      },
    });
    moveMobTowards(mob, {
      deltaSeconds,
      desiredX: movementTarget.x,
      desiredY: movementTarget.y,
      canMoveTo: (x, y) => canMobMoveTo(ctx, x, y, mob.id),
    });
    markMobSpatialStateDirty(ctx, mob, previousX, previousY, previousDead);
  }
}

function markMobSpatialStateDirty(
  ctx: MobRuntimeContext,
  mob: MobState,
  previousX: number,
  previousY: number,
  previousDead: boolean,
): void {
  if (previousX !== mob.x || previousY !== mob.y || previousDead !== mob.dead) {
    ctx.spatial.markMobSpatialDirty();
  }
}

export function canMobMoveTo(ctx: MobRuntimeContext, x: number, y: number, mobId: string): boolean {
  const tileSize = ctx.state.profile.tileSize;
  const widthPx = ctx.spatial.getMapWidthPx();
  const heightPx = ctx.spatial.getMapHeightPx();
  const clampedX = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, x));
  const clampedY = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, y));
  const tileX = Math.floor(clampedX / tileSize);
  const tileY = Math.floor(clampedY / tileSize);

  if (ctx.spatial.isBlockedTile(tileX, tileY)) {
    return false;
  }

  const hitRadius = ctx.state.profile.mobHitRadius;
  for (const nearby of ctx.state.mobSpatialGrid.queryRadius(clampedX, clampedY, hitRadius)) {
    if (nearby.id === mobId) {
      continue;
    }
    return false;
  }
  return true;
}

function attackPlayerFromMob(
  ctx: MobRuntimeContext,
  mob: MobState,
  player: BasePlayerState,
  now: number,
): void {
  if (!player || player.dead) {
    return;
  }
  if (mob.attackCooldownEndsAt > now) {
    return;
  }

  mob.attackCooldownEndsAt = now + mob.attackCooldownMs;
  const resolvedDamage = ctx.combat.applyDamageToPlayer(player, mob.attackDamage, "physical");
  ctx.combat.onCombatLog(`${mob.name} hits ${player.name} for ${resolvedDamage}.`);

  if (player.health <= 0) {
    ctx.combat.handlePlayerKilled(player);
  }
}

function clearMobSkillState(ctx: MobRuntimeContext, mob: MobState): void {
  mob.castingSkillId = "";
  mob.castStartedAt = 0;
  mob.castEndsAt = 0;
  mob.skillLungeStartedAt = 0;
  mob.skillLungeEndsAt = 0;
  mob.skillLungeFromX = 0;
  mob.skillLungeFromY = 0;
  mob.skillLungeToX = 0;
  mob.skillLungeToY = 0;
  ctx.state.mobSkillHitTargets.delete(mob.id);
}

function startSkeletonDashCast(mob: MobState, now: number): void {
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

function resolveSkeletonDashDestination(
  ctx: MobRuntimeContext,
  mob: MobState,
  target: BasePlayerState | null,
) {
  const tileSize = ctx.state.profile.tileSize;
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
    if (!canMobMoveTo(ctx, candidateX, candidateY, mob.id)) {
      break;
    }
    resolvedX = candidateX;
    resolvedY = candidateY;
  }

  return { x: resolvedX, y: resolvedY, directionX, directionY };
}

function resolvePlayerMobOverlap(ctx: MobRuntimeContext, player: BasePlayerState, mob: MobState): void {
  const collisionCenterX = mob.x;
  const collisionCenterY = mob.y + ctx.state.profile.playerMobCollisionOffsetY;
  const halfWidth = ctx.state.profile.playerMobCollisionHalfWidth + 2;
  const halfHeight = ctx.state.profile.playerMobCollisionHalfHeight + 2;
  const deltaX = player.x - collisionCenterX;
  const deltaY = player.y - collisionCenterY;
  const distance = Math.hypot(
    deltaX / Math.max(0.001, halfWidth),
    deltaY / Math.max(0.001, halfHeight),
  );
  if (distance >= 1) {
    return;
  }

  const scale = distance > 0.001 ? 1 / distance : 1;
  const targetX = collisionCenterX + (distance > 0.001 ? deltaX * scale : halfWidth);
  const targetY = collisionCenterY + (distance > 0.001 ? deltaY * scale : 0);
  if (ctx.spatial.canTeleportTo(targetX, targetY, player.id)) {
    player.x = targetX;
    player.y = targetY;
  }
}

function applySkeletonDashHits(
  ctx: MobRuntimeContext,
  mob: MobState,
  players: BasePlayerState[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  const hitTargets = ctx.state.mobSkillHitTargets.get(mob.id) ?? new Set<string>();
  const collisionHalfWidth = ctx.state.profile.playerMobCollisionHalfWidth;
  const collisionHalfHeight = ctx.state.profile.playerMobCollisionHalfHeight;
  let firstCollision: { player: BasePlayerState; t: number } | null = null;

  for (const player of players) {
    if (player.dead || hitTargets.has(player.id)) {
      continue;
    }

    const collisionT = getSegmentEllipseCollisionT(
      fromX,
      fromY,
      toX,
      toY,
      player.x,
      player.y + ctx.state.profile.playerMobCollisionOffsetY,
      collisionHalfWidth,
      collisionHalfHeight,
    );
    if (collisionT === null) {
      continue;
    }

    if (!firstCollision || collisionT < firstCollision.t) {
      firstCollision = { player, t: collisionT };
    }
  }

  if (!firstCollision) {
    ctx.state.mobSkillHitTargets.set(mob.id, hitTargets);
    return false;
  }

  const collisionX = fromX + (toX - fromX) * firstCollision.t;
  const collisionY = fromY + (toY - fromY) * firstCollision.t;
  mob.x = collisionX;
  mob.y = collisionY;
  mob.targetX = collisionX;
  mob.targetY = collisionY;

  const resolvedDamage = ctx.combat.applyDamageToPlayer(
    firstCollision.player,
    SKELETON_DASH_SKILL.damage,
    SKELETON_DASH_SKILL.damageType,
  );
  hitTargets.add(firstCollision.player.id);
  ctx.combat.onCombatLog(
    `${mob.name} uses ${SKELETON_DASH_SKILL.name} on ${firstCollision.player.name} for ${resolvedDamage}.`,
  );

  if (firstCollision.player.health <= 0) {
    ctx.combat.handlePlayerKilled(firstCollision.player);
  }

  const knockbackDistance = ctx.state.profile.tileSize;
  const tileSize = ctx.state.profile.tileSize;
  const widthPx = ctx.spatial.getMapWidthPx();
  const heightPx = ctx.spatial.getMapHeightPx();
  pushTargetByKnockbackRuntime(collisionX, collisionY, firstCollision.player, knockbackDistance, (nx, ny) => {
    firstCollision!.player.x = Math.max(tileSize / 2, Math.min(widthPx - tileSize / 2, nx));
    firstCollision!.player.y = Math.max(tileSize / 2, Math.min(heightPx - tileSize / 2, ny));
  });

  resolvePlayerMobOverlap(ctx, firstCollision.player, mob);
  ctx.state.mobSkillHitTargets.set(mob.id, hitTargets);
  return true;
}

export function tryRunSkeletonDash(
  ctx: MobRuntimeContext,
  mob: MobState,
  targetPlayer: BasePlayerState | null,
  players: BasePlayerState[],
  now: number,
): boolean {
  if (ctx.state.resolveMobKind(mob) !== "skeleton") {
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
    const hitAnyTarget = applySkeletonDashHits(ctx, mob, players, previousX, previousY, mob.x, mob.y);
    if (hitAnyTarget) {
      clearMobSkillState(ctx, mob);
    }
    return true;
  }

  if (mob.skillLungeEndsAt > 0 && now >= mob.skillLungeEndsAt) {
    const previousX = mob.x;
    const previousY = mob.y;
    mob.x = mob.skillLungeToX;
    mob.y = mob.skillLungeToY;
    applySkeletonDashHits(ctx, mob, players, previousX, previousY, mob.x, mob.y);
    clearMobSkillState(ctx, mob);
    return true;
  }

  if (mob.castingSkillId === SKELETON_DASH_SKILL_ID && mob.castEndsAt > now) {
    mob.targetX = mob.x;
    mob.targetY = mob.y;
    return true;
  }

  if (mob.castingSkillId === SKELETON_DASH_SKILL_ID && mob.castEndsAt > 0 && now >= mob.castEndsAt) {
    const destination = resolveSkeletonDashDestination(ctx, mob, targetPlayer);
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
    ctx.state.mobSkillHitTargets.set(mob.id, new Set<string>());
    return true;
  }

  if (!targetPlayer || targetPlayer.dead) {
    return false;
  }

  const triggerDistance = ctx.state.profile.tileSize * SKELETON_DASH_SKILL.triggerDistanceTiles;
  const distanceToTarget = Math.hypot(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
  if (distanceToTarget > triggerDistance) {
    return false;
  }

  if (mob.attackCooldownEndsAt > now) {
    mob.targetX = mob.x;
    mob.targetY = mob.y;
    return true;
  }

  startSkeletonDashCast(mob, now);
  return true;
}

export function handleMobDeath(ctx: MobRuntimeContext, mob: MobState): void {
  mob.dead = true;
  mob.aggroTargetId = "";
  mob.aggroLockedUntil = 0;
  mob.health = 0;
  mob.burnTicksRemaining = 0;
  mob.burnEndsAt = 0;
  mob.respawnAt = Date.now() + ctx.state.profile.mobRespawnMs;
  mob.attackCooldownEndsAt = 0;
  clearMobSkillState(ctx, mob);
  clearMobPath(ctx.state.mobPathCache, mob.id);
  ctx.state.statusEffects.deleteMobBurn(mob.id);
  tryCreateMobLootChest(ctx.state.roomChests, mob, ctx.state.profile.tileSize);
  ctx.spatial.markMobSpatialDirty();
  ctx.combat.onCombatLog(`${mob.name} collapses.`);
}
