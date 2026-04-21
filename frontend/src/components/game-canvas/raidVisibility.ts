'use client';

export function isRaidBlockingTile(tile: string | undefined) {
  return tile === 'wall' || tile === 'wallEdge';
}

export function getRaidTilePositionFromWorld(
  x: number,
  y: number,
  tileSize: number,
  width: number,
  height: number,
) {
  const tileX = Math.max(0, Math.min(width - 1, Math.floor(x / tileSize)));
  const tileY = Math.max(0, Math.min(height - 1, Math.floor((y + tileSize * 0.375) / tileSize)));
  return { tileX, tileY };
}

export function hasRaidLineOfSight(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tiles: string[],
  width: number,
  height: number,
) {
  let x0 = fromX;
  let y0 = fromY;
  const x1 = toX;
  const y1 = toY;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) {
      return false;
    }

    const tile = tiles[y0 * width + x0];
    if (x0 === x1 && y0 === y1) {
      return true;
    }

    if (isRaidBlockingTile(tile)) {
      return false;
    }
  }

  return true;
}

export function computeRaidVisibleTiles(
  originTileX: number,
  originTileY: number,
  radius: number,
  tiles: string[],
  width: number,
  height: number,
) {
  const visibleTiles = new Set<number>();

  for (let y = Math.max(0, originTileY - radius); y <= Math.min(height - 1, originTileY + radius); y += 1) {
    for (let x = Math.max(0, originTileX - radius); x <= Math.min(width - 1, originTileX + radius); x += 1) {
      const dx = x - originTileX;
      const dy = y - originTileY;
      if (Math.hypot(dx, dy) > radius + 0.35) {
        continue;
      }

      if (hasRaidLineOfSight(originTileX, originTileY, x, y, tiles, width, height)) {
        visibleTiles.add(y * width + x);
      }
    }
  }

  visibleTiles.add(originTileY * width + originTileX);

  const wallRevealOffsets = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];

  for (const tileIndex of [...visibleTiles]) {
    const tileX = tileIndex % width;
    const tileY = Math.floor(tileIndex / width);

    for (const offset of wallRevealOffsets) {
      const neighborX = tileX + offset.x;
      const neighborY = tileY + offset.y;
      if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) {
        continue;
      }

      const neighborTile = tiles[neighborY * width + neighborX];
      if (!isRaidBlockingTile(neighborTile)) {
        continue;
      }

      const dx = neighborX - originTileX;
      const dy = neighborY - originTileY;
      if (Math.hypot(dx, dy) > radius + 0.75) {
        continue;
      }

      visibleTiles.add(neighborY * width + neighborX);
    }
  }

  return visibleTiles;
}
