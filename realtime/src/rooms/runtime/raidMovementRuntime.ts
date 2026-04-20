import { type MapSchema } from "@colyseus/schema";
import type { RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import type { SpatialGrid } from "../services/SpatialGrid.js";
import type { NormalizedMoveInput } from "./worldMovementRuntime.js";

export type RaidMovementPlayer = BasePlayerState & {
  lastProcessedInput: number;
};

export interface RaidMovementRuntimeContext<TPlayer extends RaidMovementPlayer = RaidMovementPlayer> {
  roomPlayers: MapSchema<TPlayer>;
  pendingMovement: Map<string, { x: number; y: number; sequence: number }>;
  offlineExpiresAt: ReadonlyMap<string, number>;
  playerLatencyMs: Map<string, number>;
  mobSpatialGrid: SpatialGrid<MobState>;
  profile: RoomGameplayProfile;
  tileSize: number;
  playerSpeed: number;
  collisionHalfWidth: number;
  collisionHalfHeight: number;
  collisionOffsetY: number;
  footCollisionOffsetY: number;
  teleportAttempts: number;
  getMapWidthTiles(): number;
  getMapHeightTiles(): number;
  getBlockedTiles(): Uint8Array;
  getChestBlockedTiles(): Uint8Array;
  ensureMobSpatialGrid(): void;
}

export function handleRaidMoveMessage<TPlayer extends RaidMovementPlayer>(
  ctx: RaidMovementRuntimeContext<TPlayer>,
  sessionId: string,
  message: NormalizedMoveInput,
  now = Date.now(),
): void {
  const { x: moveX, y: moveY, sequence, clientEstimatedLatencyMs } = message;
  if (clientEstimatedLatencyMs !== undefined) {
    ctx.playerLatencyMs.set(sessionId, clientEstimatedLatencyMs);
  }

  const player = ctx.roomPlayers.get(sessionId);
  if (player && (player.dead || player.castEndsAt > now)) {
    ctx.pendingMovement.delete(sessionId);
    player.lastProcessedInput = sequence;
    return;
  }

  const length = Math.hypot(moveX, moveY);
  if (length <= 0.001) {
    ctx.pendingMovement.delete(sessionId);
    if (player) {
      player.lastProcessedInput = sequence;
    }
    return;
  }

  ctx.pendingMovement.set(sessionId, {
    x: moveX / length,
    y: moveY / length,
    sequence,
  });
}

export function updateRaidPlayers<TPlayer extends RaidMovementPlayer>(
  ctx: RaidMovementRuntimeContext<TPlayer>,
  deltaSeconds: number,
): void {
  for (const [sessionId, player] of ctx.roomPlayers.entries()) {
    if (ctx.offlineExpiresAt.has(sessionId)) {
      continue;
    }

    const movement = ctx.pendingMovement.get(sessionId);
    if (!movement) {
      continue;
    }

    const speedMultiplier = getRaidPlayerSpeedMultiplier(player, ctx);
    const nextX = player.x + movement.x * ctx.playerSpeed * speedMultiplier * deltaSeconds;
    const nextY = player.y + movement.y * ctx.playerSpeed * speedMultiplier * deltaSeconds;

    if (canRaidPlayerMoveTo(ctx, nextX, player.y, player)) {
      player.x = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapWidthTiles() * ctx.tileSize - ctx.tileSize / 2, nextX));
    }

    if (canRaidPlayerMoveTo(ctx, player.x, nextY, player)) {
      player.y = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapHeightTiles() * ctx.tileSize - ctx.tileSize / 2, nextY));
    }

    player.lastProcessedInput = movement.sequence;
  }
}

export function canRaidPlayerMoveTo<TPlayer extends RaidMovementPlayer>(
  ctx: RaidMovementRuntimeContext<TPlayer>,
  x: number,
  y: number,
  player?: TPlayer,
): boolean {
  ctx.ensureMobSpatialGrid();
  const clampedX = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapWidthTiles() * ctx.tileSize - ctx.tileSize / 2, x));
  const clampedY = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapHeightTiles() * ctx.tileSize - ctx.tileSize / 2, y));
  const clampedFootY = Math.max(
    ctx.tileSize / 2,
    Math.min(ctx.getMapHeightTiles() * ctx.tileSize - ctx.tileSize / 2, y + ctx.footCollisionOffsetY),
  );
  const tileX = Math.floor(clampedX / ctx.tileSize);
  const tileY = Math.floor(clampedFootY / ctx.tileSize);

  if (tileX < 0 || tileY < 0 || tileX >= ctx.getMapWidthTiles() || tileY >= ctx.getMapHeightTiles()) {
    return false;
  }

  const tileIndex = tileY * ctx.getMapWidthTiles() + tileX;
  if (ctx.getBlockedTiles()[tileIndex] === 1 || ctx.getChestBlockedTiles()[tileIndex] === 1) {
    return false;
  }

  const nearbyMobs = ctx.mobSpatialGrid.queryRadius(
    clampedX,
    clampedY,
    Math.max(ctx.collisionHalfWidth, ctx.collisionHalfHeight),
  );
  if (nearbyMobs.length <= 0) {
    return true;
  }

  for (const mob of nearbyMobs) {
    if (!player) {
      return false;
    }

    const collisionCenterY = mob.y + ctx.collisionOffsetY;
    const currentDistance = Math.hypot(
      (player.x - mob.x) / Math.max(0.001, ctx.collisionHalfWidth),
      (player.y - collisionCenterY) / Math.max(0.001, ctx.collisionHalfHeight),
    );
    const nextDistance = Math.hypot(
      (clampedX - mob.x) / Math.max(0.001, ctx.collisionHalfWidth),
      (clampedY - collisionCenterY) / Math.max(0.001, ctx.collisionHalfHeight),
    );
    const isAlreadyOverlapping = currentDistance < 1;
    const isMovingOutOfOverlap = nextDistance > currentDistance + 0.01;

    if (!isAlreadyOverlapping || !isMovingOutOfOverlap) {
      return false;
    }
  }

  return true;
}

export function findRandomRaidTeleportDestination<TPlayer extends RaidMovementPlayer>(
  ctx: RaidMovementRuntimeContext<TPlayer>,
  playerId: string,
  fallbackSpawn = "2:2",
  random = Math.random,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < ctx.teleportAttempts; attempt += 1) {
    const tileX = Math.floor(random() * ctx.getMapWidthTiles());
    const tileY = Math.floor(random() * ctx.getMapHeightTiles());
    const x = tileX * ctx.tileSize + ctx.tileSize / 2;
    const y = tileY * ctx.tileSize + ctx.tileSize / 2;

    if (!canRaidPlayerMoveTo(ctx, x, y)) {
      continue;
    }

    let blockedByPlayer = false;
    for (const otherPlayer of ctx.roomPlayers.values()) {
      if (otherPlayer.id === playerId || otherPlayer.dead) {
        continue;
      }

      if (Math.hypot(otherPlayer.x - x, otherPlayer.y - y) < ctx.tileSize * 0.75) {
        blockedByPlayer = true;
        break;
      }
    }

    if (!blockedByPlayer) {
      return { x, y };
    }
  }

  const fallback = resolveRaidJoinSpawnPosition(ctx, fallbackSpawn);
  return fallback && canRaidPlayerMoveTo(ctx, fallback.x, fallback.y) ? fallback : null;
}

export function resolveRaidJoinSpawnPosition<TPlayer extends RaidMovementPlayer>(
  ctx: RaidMovementRuntimeContext<TPlayer>,
  anchorSpawn = "2:2",
): { x: number; y: number } {
  const [anchorTileX, anchorTileY] = anchorSpawn.split(":").map((value) => Number.parseInt(value, 10));
  const safeAnchorTileX = Math.max(0, Math.min(ctx.getMapWidthTiles() - 1, Number.isFinite(anchorTileX) ? anchorTileX : 2));
  const safeAnchorTileY = Math.max(0, Math.min(ctx.getMapHeightTiles() - 1, Number.isFinite(anchorTileY) ? anchorTileY : 2));
  const joinIndex = ctx.roomPlayers.size;
  const offsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 2, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: -2 },
  ];

  for (let offsetIndex = 0; offsetIndex < offsets.length; offsetIndex += 1) {
    const offset = offsets[(joinIndex + offsetIndex) % offsets.length];
    const tileX = Math.max(0, Math.min(ctx.getMapWidthTiles() - 1, safeAnchorTileX + offset.x));
    const tileY = Math.max(0, Math.min(ctx.getMapHeightTiles() - 1, safeAnchorTileY + offset.y));
    const x = tileX * ctx.tileSize + ctx.tileSize / 2;
    const y = tileY * ctx.tileSize + ctx.tileSize / 2;

    if (!canRaidPlayerMoveTo(ctx, x, y)) {
      continue;
    }

    let blockedByPlayer = false;
    for (const otherPlayer of ctx.roomPlayers.values()) {
      if (otherPlayer.dead) {
        continue;
      }

      if (Math.hypot(otherPlayer.x - x, otherPlayer.y - y) < ctx.tileSize * 0.75) {
        blockedByPlayer = true;
        break;
      }
    }

    if (!blockedByPlayer) {
      return { x, y };
    }
  }

  return {
    x: safeAnchorTileX * ctx.tileSize + ctx.tileSize / 2,
    y: safeAnchorTileY * ctx.tileSize + ctx.tileSize / 2,
  };
}

function getRaidPlayerSpeedMultiplier<TPlayer extends RaidMovementPlayer>(
  player: TPlayer,
  ctx: RaidMovementRuntimeContext<TPlayer>,
): number {
  const now = Date.now();
  let multiplier = 1;
  if ((player as BasePlayerState).speedBuffEndsAt > now) {
    multiplier *= ctx.profile.speedPotionSpeedMultiplier;
  }
  if ((player as BasePlayerState).slowEndsAt > now) {
    multiplier *= ctx.profile.slowPotionSpeedMultiplier;
  }
  return multiplier;
}
