import { MobState } from "./schema/MobState.js";

export type GridPoint = {
  x: number;
  y: number;
};

export type MobPathCacheEntry = {
  targetTileKey: string;
  waypoints: GridPoint[];
  lastComputedAt: number;
  retryAfter: number;
};

type PathingGrid = {
  tileSize: number;
  width: number;
  height: number;
  isBlocked: (tileX: number, tileY: number) => boolean;
};

type ResolveMobPathOptions = {
  now: number;
  desiredX: number;
  desiredY: number;
  grid: PathingGrid;
  cache: Map<string, MobPathCacheEntry>;
  recomputeIntervalMs?: number;
  failureRetryMs?: number;
};

const CARDINAL_DIRECTIONS: readonly GridPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

const DEFAULT_RECOMPUTE_INTERVAL_MS = 350;
const DEFAULT_FAILURE_RETRY_MS = 500;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toTileCoordinate(worldValue: number, tileSize: number, maxTiles: number) {
  return clamp(Math.floor(worldValue / tileSize), 0, Math.max(0, maxTiles - 1));
}

function toTilePoint(x: number, y: number, grid: PathingGrid): GridPoint {
  return {
    x: toTileCoordinate(x, grid.tileSize, grid.width),
    y: toTileCoordinate(y, grid.tileSize, grid.height),
  };
}

function toWorldPoint(tile: GridPoint, grid: PathingGrid) {
  return {
    x: tile.x * grid.tileSize + grid.tileSize / 2,
    y: tile.y * grid.tileSize + grid.tileSize / 2,
  };
}

function toTileKey(tile: GridPoint) {
  return `${tile.x}:${tile.y}`;
}

function toIndex(tile: GridPoint, width: number) {
  return tile.y * width + tile.x;
}

function toTileFromIndex(index: number, width: number): GridPoint {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
}

function isWithinGrid(tileX: number, tileY: number, grid: PathingGrid) {
  return tileX >= 0 && tileY >= 0 && tileX < grid.width && tileY < grid.height;
}

export function hasGridLineOfSight(start: GridPoint, target: GridPoint, grid: PathingGrid) {
  let currentX = start.x;
  let currentY = start.y;
  const deltaX = Math.abs(target.x - start.x);
  const deltaY = Math.abs(target.y - start.y);
  const stepX = start.x < target.x ? 1 : -1;
  const stepY = start.y < target.y ? 1 : -1;
  let error = deltaX - deltaY;

  while (currentX !== target.x || currentY !== target.y) {
    const doubledError = error * 2;

    if (doubledError > -deltaY) {
      error -= deltaY;
      currentX += stepX;
    }

    if (doubledError < deltaX) {
      error += deltaX;
      currentY += stepY;
    }

    if ((currentX !== target.x || currentY !== target.y) && grid.isBlocked(currentX, currentY)) {
      return false;
    }
  }

  return true;
}

function simplifyGridPath(path: GridPoint[], grid: PathingGrid) {
  if (path.length <= 2) {
    return path;
  }

  const simplified: GridPoint[] = [path[0]];
  let anchorIndex = 0;

  for (let index = 1; index < path.length; index += 1) {
    const nextIndex = index + 1;
    if (
      nextIndex < path.length &&
      hasGridLineOfSight(path[anchorIndex], path[nextIndex], grid)
    ) {
      continue;
    }

    simplified.push(path[index]);
    anchorIndex = index;
  }

  return simplified;
}

/**
 * Maximum number of tiles the BFS will explore before giving up.
 * This caps worst-case cost per pathfinding call, preventing
 * runaway CPU usage when the target is unreachable or very far.
 */
const MAX_BFS_EXPLORATION_TILES = 4096;

function findGridPath(start: GridPoint, target: GridPoint, grid: PathingGrid) {
  if (start.x === target.x && start.y === target.y) {
    return [start];
  }

  if (!isWithinGrid(target.x, target.y, grid) || grid.isBlocked(target.x, target.y)) {
    return null;
  }

  const totalTiles = grid.width * grid.height;
  const queue = new Int32Array(totalTiles);
  const visited = new Uint8Array(totalTiles);
  const previous = new Int32Array(totalTiles);
  previous.fill(-1);

  const startIndex = toIndex(start, grid.width);
  const targetIndex = toIndex(target, grid.width);
  let head = 0;
  let tail = 0;
  queue[tail] = startIndex;
  tail += 1;
  visited[startIndex] = 1;

  let exploredCount = 0;

  while (head < tail) {
    const currentIndex = queue[head];
    head += 1;
    exploredCount += 1;

    if (currentIndex === targetIndex) {
      break;
    }

    // Cap exploration to avoid expensive searches for far targets
    if (exploredCount >= MAX_BFS_EXPLORATION_TILES) {
      break;
    }

    const currentTile = toTileFromIndex(currentIndex, grid.width);

    for (const direction of CARDINAL_DIRECTIONS) {
      const nextX = currentTile.x + direction.x;
      const nextY = currentTile.y + direction.y;

      if (!isWithinGrid(nextX, nextY, grid) || grid.isBlocked(nextX, nextY)) {
        continue;
      }

      const nextIndex = nextY * grid.width + nextX;
      if (visited[nextIndex] === 1) {
        continue;
      }

      visited[nextIndex] = 1;
      previous[nextIndex] = currentIndex;
      queue[tail] = nextIndex;
      tail += 1;
    }
  }

  if (visited[targetIndex] !== 1) {
    return null;
  }

  const reversedPath: GridPoint[] = [];
  let cursor = targetIndex;
  while (cursor !== -1) {
    reversedPath.push(toTileFromIndex(cursor, grid.width));
    cursor = previous[cursor];
  }

  return simplifyGridPath(reversedPath.reverse(), grid);
}

function trimReachedWaypoints(
  waypoints: GridPoint[],
  mob: MobState,
  currentTile: GridPoint,
  grid: PathingGrid,
) {
  const trimmedWaypoints = [...waypoints];

  while (trimmedWaypoints.length > 0) {
    const nextWaypoint = trimmedWaypoints[0];
    const waypointWorld = toWorldPoint(nextWaypoint, grid);
    const distanceToWaypoint = Math.hypot(waypointWorld.x - mob.x, waypointWorld.y - mob.y);
    if (
      (currentTile.x === nextWaypoint.x && currentTile.y === nextWaypoint.y) ||
      distanceToWaypoint <= grid.tileSize * 0.35
    ) {
      trimmedWaypoints.shift();
      continue;
    }

    break;
  }

  return trimmedWaypoints;
}

export function clearMobPath(cache: Map<string, MobPathCacheEntry>, mobId: string) {
  cache.delete(mobId);
}

export function resolveMobPathTarget(
  mob: MobState,
  options: ResolveMobPathOptions,
) {
  const {
    now,
    desiredX,
    desiredY,
    grid,
    cache,
    recomputeIntervalMs = DEFAULT_RECOMPUTE_INTERVAL_MS,
    failureRetryMs = DEFAULT_FAILURE_RETRY_MS,
  } = options;
  const currentTile = toTilePoint(mob.x, mob.y, grid);
  const targetTile = toTilePoint(desiredX, desiredY, grid);
  const targetTileKey = toTileKey(targetTile);

  if (currentTile.x === targetTile.x && currentTile.y === targetTile.y) {
    clearMobPath(cache, mob.id);
    return { x: desiredX, y: desiredY };
  }

  if (hasGridLineOfSight(currentTile, targetTile, grid)) {
    clearMobPath(cache, mob.id);
    return { x: desiredX, y: desiredY };
  }

  let cacheEntry = cache.get(mob.id);
  if (cacheEntry) {
    cacheEntry.waypoints = trimReachedWaypoints(cacheEntry.waypoints, mob, currentTile, grid);
  }

  const shouldRecomputePath =
    !cacheEntry ||
    cacheEntry.targetTileKey !== targetTileKey ||
    cacheEntry.waypoints.length === 0 ||
    now - cacheEntry.lastComputedAt >= recomputeIntervalMs;

  if (shouldRecomputePath && (!cacheEntry || now >= cacheEntry.retryAfter || cacheEntry.targetTileKey !== targetTileKey)) {
    const resolvedPath = findGridPath(currentTile, targetTile, grid);
    cacheEntry = {
      targetTileKey,
      waypoints: resolvedPath ? resolvedPath.slice(1) : [],
      lastComputedAt: now,
      retryAfter: resolvedPath ? now : now + failureRetryMs,
    };

    if (cacheEntry.waypoints.length > 0 || resolvedPath) {
      cache.set(mob.id, cacheEntry);
    } else {
      clearMobPath(cache, mob.id);
    }
  }

  if (!cacheEntry || cacheEntry.waypoints.length === 0) {
    return { x: desiredX, y: desiredY };
  }

  const nextWaypoint = cacheEntry.waypoints[0];
  const nextWaypointWorld = toWorldPoint(nextWaypoint, grid);
  if (nextWaypoint.x === targetTile.x && nextWaypoint.y === targetTile.y) {
    return { x: desiredX, y: desiredY };
  }

  return nextWaypointWorld;
}
