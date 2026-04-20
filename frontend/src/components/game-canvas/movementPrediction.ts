'use client';

import {
  createMeadowDecorations,
  createMeadowStampsFromAsset,
  isBlockedMeadowTile,
} from '@/lib/maps/meadowMap';

export type MovementBlocker = {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBlockerCollisionDistance(x: number, y: number, blocker: MovementBlocker) {
  return Math.hypot(
    (x - blocker.x) / Math.max(0.001, blocker.halfWidth),
    (y - blocker.y) / Math.max(0.001, blocker.halfHeight),
  );
}

export function canMoveToWorldPosition(
  x: number,
  y: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  meadowDecorations: ReturnType<typeof createMeadowDecorations>,
  meadowStamps: ReturnType<typeof createMeadowStampsFromAsset>,
  mobBlockers: MovementBlocker[] = [],
  currentX?: number,
  currentY?: number,
) {
  const clampedX = clamp(x, tileSize / 2, mapWidth - tileSize / 2);
  const clampedY = clamp(y + tileSize * 0.375, tileSize / 2, mapHeight - tileSize / 2);
  const tileX = Math.floor(clampedX / tileSize);
  const tileY = Math.floor(clampedY / tileSize);

  if (isBlockedMeadowTile(meadowDecorations, meadowStamps, tileX, tileY)) {
    return false;
  }

  for (const blocker of mobBlockers) {
    const nextDistance = getBlockerCollisionDistance(clampedX, clampedY, blocker);
    if (nextDistance >= 1) {
      continue;
    }

    const currentDistance =
      typeof currentX === 'number' && typeof currentY === 'number'
        ? getBlockerCollisionDistance(currentX, currentY, blocker)
        : Number.POSITIVE_INFINITY;
    const isAlreadyOverlapping = currentDistance < 1;
    const isMovingOutOfOverlap = nextDistance > currentDistance + 0.01;
    if (!isAlreadyOverlapping || !isMovingOutOfOverlap) {
      return false;
    }
  }

  return true;
}

export function canMoveToRaidWorldPosition(
  x: number,
  y: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  blockedTiles: Uint8Array,
  width: number,
  height: number,
  chestBlockedTiles?: Uint8Array,
  mobBlockers: MovementBlocker[] = [],
  currentX?: number,
  currentY?: number,
) {
  const clampedX = clamp(x, tileSize / 2, mapWidth - tileSize / 2);
  const clampedY = clamp(y + tileSize * 0.375, tileSize / 2, mapHeight - tileSize / 2);
  const tileX = Math.floor(clampedX / tileSize);
  const tileY = Math.floor(clampedY / tileSize);

  if (tileX < 0 || tileY < 0 || tileX >= width || tileY >= height) {
    return false;
  }

  const tileIndex = tileY * width + tileX;
  if (blockedTiles[tileIndex] === 1 || chestBlockedTiles?.[tileIndex] === 1) {
    return false;
  }

  for (const blocker of mobBlockers) {
    const nextDistance = getBlockerCollisionDistance(clampedX, y, blocker);
    if (nextDistance >= 1) {
      continue;
    }

    const currentDistance =
      typeof currentX === 'number' && typeof currentY === 'number'
        ? getBlockerCollisionDistance(currentX, currentY, blocker)
        : Number.POSITIVE_INFINITY;
    const isAlreadyOverlapping = currentDistance < 1;
    const isMovingOutOfOverlap = nextDistance > currentDistance + 0.01;
    if (!isAlreadyOverlapping || !isMovingOutOfOverlap) {
      return false;
    }
  }

  return true;
}

export function applyWorldPredictedMovement(
  currentX: number,
  currentY: number,
  inputX: number,
  inputY: number,
  durationMs: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  meadowDecorations: ReturnType<typeof createMeadowDecorations>,
  meadowStamps: ReturnType<typeof createMeadowStampsFromAsset>,
  speed: number,
  mobBlockers: MovementBlocker[] = [],
) {
  const deltaSeconds = durationMs / 1000;
  const nextX = clamp(currentX + inputX * speed * deltaSeconds, tileSize / 2, mapWidth - tileSize / 2);
  const nextY = clamp(currentY + inputY * speed * deltaSeconds, tileSize / 2, mapHeight - tileSize / 2);

  if (
    canMoveToWorldPosition(
      nextX,
      nextY,
      tileSize,
      mapWidth,
      mapHeight,
      meadowDecorations,
      meadowStamps,
      mobBlockers,
      currentX,
      currentY,
    )
  ) {
    return { x: nextX, y: nextY };
  }

  return { x: currentX, y: currentY };
}

export function applyRaidPredictedMovement(
  currentX: number,
  currentY: number,
  inputX: number,
  inputY: number,
  deltaSeconds: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number,
  blockedTiles: Uint8Array,
  width: number,
  height: number,
  chestBlockedTiles: Uint8Array,
  speed: number,
  mobBlockers: MovementBlocker[] = [],
) {
  const nextX = clamp(currentX + inputX * speed * deltaSeconds, tileSize / 2, mapWidth - tileSize / 2);
  const nextY = clamp(currentY + inputY * speed * deltaSeconds, tileSize / 2, mapHeight - tileSize / 2);

  let resolvedX = currentX;
  let resolvedY = currentY;

  if (
    canMoveToRaidWorldPosition(
      nextX,
      currentY,
      tileSize,
      mapWidth,
      mapHeight,
      blockedTiles,
      width,
      height,
      chestBlockedTiles,
      mobBlockers,
      currentX,
      currentY,
    )
  ) {
    resolvedX = nextX;
  }

  if (
    canMoveToRaidWorldPosition(
      resolvedX,
      nextY,
      tileSize,
      mapWidth,
      mapHeight,
      blockedTiles,
      width,
      height,
      chestBlockedTiles,
      mobBlockers,
      resolvedX,
      currentY,
    )
  ) {
    resolvedY = nextY;
  }

  return { x: resolvedX, y: resolvedY };
}
