import { type MapSchema } from "@colyseus/schema";
import type { RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import type { SpatialGrid } from "../services/SpatialGrid.js";

export type NormalizedMoveInput = {
  x: number;
  y: number;
  sequence: number;
  clientEstimatedLatencyMs?: number;
};

export type WorldMovementPlayer = BasePlayerState & {
  moveX: number;
  moveY: number;
  lastProcessedInput: number;
};

export interface WorldMovementRuntimeContext<TPlayer extends WorldMovementPlayer = WorldMovementPlayer> {
  roomPlayers: MapSchema<TPlayer>;
  pendingMovementSequence: Map<string, number>;
  playerLatencyMs: Map<string, number>;
  mobSpatialGrid: SpatialGrid<MobState>;
  blockedWorldTiles: ReadonlySet<string>;
  profile: RoomGameplayProfile;
  tileSize: number;
  playerSpeed: number;
  collisionHalfWidth: number;
  collisionHalfHeight: number;
  collisionOffsetY: number;
  footCollisionOffsetY: number;
  teleportAttempts: number;
  getMapWidthPx(): number;
  getMapHeightPx(): number;
  ensureMobSpatialGrid(): void;
}

export function handleWorldMoveMessage<TPlayer extends WorldMovementPlayer>(
  ctx: WorldMovementRuntimeContext<TPlayer>,
  sessionId: string,
  message: NormalizedMoveInput,
  now = Date.now(),
): void {
  const player = ctx.roomPlayers.get(sessionId);
  if (!player) {
    return;
  }

  const { x: moveX, y: moveY, sequence, clientEstimatedLatencyMs } = message;
  if (player.dead || player.castEndsAt > now) {
    player.moveX = 0;
    player.moveY = 0;
    player.lastProcessedInput = sequence;
    ctx.pendingMovementSequence.delete(sessionId);
    return;
  }

  if (clientEstimatedLatencyMs !== undefined) {
    ctx.playerLatencyMs.set(sessionId, clientEstimatedLatencyMs);
  }

  const length = Math.hypot(moveX, moveY);
  if (length <= 0.001) {
    player.moveX = 0;
    player.moveY = 0;
    player.lastProcessedInput = sequence;
    ctx.pendingMovementSequence.delete(sessionId);
    return;
  }

  if (length > 1) {
    player.moveX = moveX / length;
    player.moveY = moveY / length;
    ctx.pendingMovementSequence.set(sessionId, sequence);
    return;
  }

  player.moveX = moveX;
  player.moveY = moveY;
  ctx.pendingMovementSequence.set(sessionId, sequence);
}

export function updateWorldPlayers<TPlayer extends WorldMovementPlayer>(
  ctx: WorldMovementRuntimeContext<TPlayer>,
  deltaSeconds: number,
): void {
  ctx.ensureMobSpatialGrid();

  for (const [sessionId, player] of ctx.roomPlayers.entries()) {
    if (player.dead) {
      continue;
    }

    const length = Math.hypot(player.moveX, player.moveY);
    if (length <= 0) {
      ctx.pendingMovementSequence.delete(sessionId);
      continue;
    }

    const speedMultiplier = getPlayerSpeedMultiplier(player, ctx);
    const nextX = player.x + player.moveX * ctx.playerSpeed * speedMultiplier * deltaSeconds;
    const nextY = player.y + player.moveY * ctx.playerSpeed * speedMultiplier * deltaSeconds;
    const clampedX = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapWidthPx() - ctx.tileSize / 2, nextX));
    const clampedY = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapHeightPx() - ctx.tileSize / 2, nextY));
    if (canWorldPlayerMoveTo(ctx, clampedX, clampedY, player)) {
      player.x = clampedX;
      player.y = clampedY;
    }

    const processedSequence = ctx.pendingMovementSequence.get(sessionId);
    if (typeof processedSequence === "number") {
      player.lastProcessedInput = processedSequence;
    }
  }
}

export function canWorldPlayerMoveTo<TPlayer extends WorldMovementPlayer>(
  ctx: WorldMovementRuntimeContext<TPlayer>,
  x: number,
  y: number,
  player?: TPlayer,
): boolean {
  ctx.ensureMobSpatialGrid();
  const clampedX = Math.max(ctx.tileSize / 2, Math.min(ctx.getMapWidthPx() - ctx.tileSize / 2, x));
  const clampedY = Math.max(
    ctx.tileSize / 2,
    Math.min(ctx.getMapHeightPx() - ctx.tileSize / 2, y + ctx.footCollisionOffsetY),
  );
  const tileX = Math.floor(clampedX / ctx.tileSize);
  const tileY = Math.floor(clampedY / ctx.tileSize);

  if (ctx.blockedWorldTiles.has(`${tileX}:${tileY}`)) {
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

export function findRandomWorldTeleportDestination<TPlayer extends WorldMovementPlayer>(
  ctx: WorldMovementRuntimeContext<TPlayer>,
  playerId: string,
  spawnPosition: { x: number; y: number },
  random = Math.random,
): { x: number; y: number } | null {
  const widthInTiles = Math.floor(ctx.getMapWidthPx() / ctx.tileSize);
  const heightInTiles = Math.floor(ctx.getMapHeightPx() / ctx.tileSize);

  for (let attempt = 0; attempt < ctx.teleportAttempts; attempt += 1) {
    const tileX = Math.floor(random() * widthInTiles);
    const tileY = Math.floor(random() * heightInTiles);
    const x = tileX * ctx.tileSize + ctx.tileSize / 2;
    const y = tileY * ctx.tileSize + ctx.tileSize / 2;

    if (!canWorldPlayerMoveTo(ctx, x, y)) {
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

  return canWorldPlayerMoveTo(ctx, spawnPosition.x, spawnPosition.y) ? spawnPosition : null;
}

function getPlayerSpeedMultiplier<TPlayer extends WorldMovementPlayer>(
  player: TPlayer,
  ctx: WorldMovementRuntimeContext<TPlayer>,
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
