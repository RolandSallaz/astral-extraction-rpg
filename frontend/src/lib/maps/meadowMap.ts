import type { MobKind } from '@mmorpg/shared/mobs/catalog';

export type MeadowTile = 'grassGround' | 'ground' | 'water';

export type MeadowMap = {
  tileSize: number;
  width: number;
  height: number;
  tiles: MeadowTile[][];
  spawn: {
    x: number;
    y: number;
  };
};

export type MeadowMapAsset = {
  tileSize: number;
  width: number;
  height: number;
  tiles: MeadowTile[][];
  spawn: {
    x: number;
    y: number;
  };
  decorations: MeadowDecoration[];
  overlays: MeadowOverlayAsset[];
  stamps: MeadowStampAsset[];
  traders: MeadowTraderAsset[];
  mobs: MeadowMobAsset[];
};

export type MeadowDecorationTexture =
  | 'rock-1-8x8'
  | 'rock-2-8x8'
  | 'flower-pink-8x8'
  | 'flower-yellow-8x8'
  | 'flower-blue-8x8'
  | 'chest-8x8';

export type MeadowDecoration = {
  x: number;
  y: number;
  texture: MeadowDecorationTexture;
  blocked?: boolean;
};

export type MeadowTileRender = {
  texture: string;
  rotation: number;
};

export type MeadowOverlayRender = {
  texture: 'ground-grass-edge-8x8' | 'ground-grass-corner-8x8';
  rotation: number;
  flipX: boolean;
};

export type MeadowOverlayAsset = MeadowOverlayRender & {
  x: number;
  y: number;
};

export type MeadowStampAsset = {
  x: number;
  y: number;
  texturePath: string;
  rotation: number;
  flipX: boolean;
  scale: number;
};

export type MeadowTraderAsset = {
  id: string;
  x: number;
  y: number;
  name: string;
  bodyItemId?: string;
  headItemId?: string;
  bodyTexturePath?: string;
  hairTexturePath?: string;
  hairOffsetX?: number;
  hairOffsetY?: number;
  headTexturePath?: string;
  spriteSheetPath?: string;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  animationFps?: number;
  animationStartFrame?: number;
  columns?: number;
  renderScale?: number;
};

export type MeadowMobAsset = {
  id: string;
  kind: MobKind;
  spawn: {
    x: number;
    y: number;
  };
  patrol: {
    minX: number;
    maxX: number;
    y: number;
    radiusY: number;
    phase: number;
  };
};

export function isBlockedMeadowTile(
  map: MeadowMap,
  decorations: MeadowDecoration[],
  x: number,
  y: number,
) {
  return decorations.some(
    (decoration) => decoration.blocked && decoration.x === x && decoration.y === y,
  );
}

export function resolveMeadowTexture(
  map: MeadowMap,
  x: number,
  y: number,
): MeadowTileRender {
  const tile = map.tiles[y][x];

  if (tile !== 'ground') {
    if (tile === 'grassGround') {
      return { texture: 'grass-8x8', rotation: 0 };
    }

    return { texture: 'water-8x8', rotation: 0 };
  }

  return { texture: 'ground-8x8', rotation: 0 };
}

export function resolveGroundOverlays(
  map: MeadowMap,
  x: number,
  y: number,
): MeadowOverlayRender[] {
  if (map.tiles[y][x] !== 'ground') {
    return [];
  }

  const isGrass = (tileX: number, tileY: number) =>
    map.tiles[tileY]?.[tileX] === 'grassGround';

  const overlays: MeadowOverlayRender[] = [];

  const top = isGrass(x, y - 1);
  const right = isGrass(x + 1, y);
  const bottom = isGrass(x, y + 1);
  const left = isGrass(x - 1, y);

  if (top) {
    overlays.push({ texture: 'ground-grass-edge-8x8', rotation: 0, flipX: false });
  }
  if (right) {
    overlays.push({ texture: 'ground-grass-edge-8x8', rotation: 90, flipX: false });
  }
  if (bottom) {
    overlays.push({ texture: 'ground-grass-edge-8x8', rotation: 180, flipX: false });
  }
  if (left) {
    overlays.push({ texture: 'ground-grass-edge-8x8', rotation: 270, flipX: false });
  }

  if (top && left && isGrass(x - 1, y - 1)) {
    overlays.push({ texture: 'ground-grass-corner-8x8', rotation: 0, flipX: false });
  }
  if (top && right && isGrass(x + 1, y - 1)) {
    overlays.push({ texture: 'ground-grass-corner-8x8', rotation: 90, flipX: false });
  }
  if (bottom && right && isGrass(x + 1, y + 1)) {
    overlays.push({ texture: 'ground-grass-corner-8x8', rotation: 180, flipX: false });
  }
  if (bottom && left && isGrass(x - 1, y + 1)) {
    overlays.push({ texture: 'ground-grass-corner-8x8', rotation: 270, flipX: false });
  }

  return overlays;
}

export function createMeadowMap(): MeadowMap {
  const width = 48;
  const height = 32;
  const tileSize = 32;

  const tiles: MeadowTile[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'grassGround'),
  );

  const paintRect = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    tile: MeadowTile,
  ) => {
    for (let y = fromY; y <= toY; y += 1) {
      for (let x = fromX; x <= toX; x += 1) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          tiles[y][x] = tile;
        }
      }
    }
  };

  const paintEllipse = (
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    tile: MeadowTile,
  ) => {
    for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += 1) {
      for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
          continue;
        }

        const dx = (x - centerX) / radiusX;
        const dy = (y - centerY) / radiusY;
        if (dx * dx + dy * dy <= 1) {
          tiles[y][x] = tile;
        }
      }
    }
  };

  const paintRoadColumn = (x: number, centerY: number, halfWidth: number) => {
    for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
      const y = centerY + offset;
      if (y >= 0 && y < height) {
        tiles[y][x] = 'ground';
      }
    }
  };

  paintEllipse(34, 10, 6, 4, 'ground');
  paintEllipse(34, 10, 4, 3, 'water');
  paintEllipse(30, 11, 2, 1, 'water');
  paintEllipse(38, 8, 1.5, 1.2, 'water');

  for (let x = 3; x <= 43; x += 1) {
    const roadY =
      x < 14 ? 22 : x < 25 ? 21 : x < 34 ? 20 : 19;
    const roadHalfWidth = x > 31 ? 2 : 1;
    paintRoadColumn(x, roadY, roadHalfWidth);
  }

  for (let x = 14; x <= 22; x += 1) {
    const branchY = 20 - (x - 14);
    paintRoadColumn(x, branchY, 1);
  }

  paintRect(7, 20, 13, 24, 'ground');
  paintRect(16, 12, 21, 15, 'ground');
  paintRect(26, 21, 31, 24, 'ground');
  paintRect(38, 17, 41, 20, 'ground');

  paintRect(8, 21, 12, 23, 'grassGround');
  paintRect(17, 13, 20, 14, 'grassGround');
  paintRect(27, 22, 30, 23, 'grassGround');

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (tiles[y][x] === 'water') {
        continue;
      }

      const nearWater =
        tiles[y - 1]?.[x] === 'water' ||
        tiles[y + 1]?.[x] === 'water' ||
        tiles[y]?.[x - 1] === 'water' ||
        tiles[y]?.[x + 1] === 'water';

      if (nearWater) {
        tiles[y][x] = 'ground';
      }
    }
  }

  return {
    tileSize,
    width,
    height,
    tiles,
    spawn: {
      x: 6,
      y: 20,
    },
  };
}

export function createDefaultMeadowMapAsset(): MeadowMapAsset {
  const map = createMeadowMap();
  const decorations = createMeadowDecorations(map);
  const overlays = map.tiles.flatMap((row, y) =>
    row.flatMap((_tile, x) =>
      resolveGroundOverlays(map, x, y).map((overlay) => ({
        x,
        y,
        texture: overlay.texture,
        rotation: overlay.rotation,
        flipX: overlay.flipX,
      })),
    ),
  );

  return {
    tileSize: map.tileSize,
    width: map.width,
    height: map.height,
    tiles: map.tiles.map((row) => [...row]),
    spawn: { ...map.spawn },
    decorations: decorations.map((decoration) => ({ ...decoration })),
    overlays,
    stamps: [],
    traders: [],
    mobs: [],
  };
}

export function createMeadowMapFromAsset(asset: MeadowMapAsset): MeadowMap {
  return {
    tileSize: asset.tileSize,
    width: asset.width,
    height: asset.height,
    tiles: asset.tiles.map((row) => [...row]),
    spawn: { ...asset.spawn },
  };
}

export function createMeadowDecorationsFromAsset(asset: MeadowMapAsset): MeadowDecoration[] {
  return asset.decorations.map((decoration) => ({ ...decoration }));
}

export function createMeadowStampsFromAsset(asset: MeadowMapAsset): MeadowStampAsset[] {
  return (asset.stamps ?? []).map((stamp) => ({ ...stamp }));
}

export function createMeadowTradersFromAsset(asset: MeadowMapAsset): MeadowTraderAsset[] {
  return (asset.traders ?? []).map((trader) => ({ ...trader }));
}

export function createMeadowMobsFromAsset(asset: MeadowMapAsset): MeadowMobAsset[] {
  return (asset.mobs ?? []).map((mob) => ({
    ...mob,
    spawn: { ...mob.spawn },
    patrol: { ...mob.patrol },
  }));
}

export function resolveGroundOverlaysFromAsset(
  asset: MeadowMapAsset,
  x: number,
  y: number,
): MeadowOverlayRender[] {
  return asset.overlays
    .filter((overlay) => overlay.x === x && overlay.y === y)
    .map((overlay) => ({
      texture: overlay.texture,
      rotation: overlay.rotation,
      flipX: overlay.flipX,
    }));
}

export function createMeadowDecorations(map: MeadowMap): MeadowDecoration[] {
  const decorations: MeadowDecoration[] = [];

  const isGrass = (x: number, y: number) => map.tiles[y]?.[x] === 'grassGround';

  const isPureGrassPatch = (x: number, y: number) =>
    isGrass(x, y) &&
    isGrass(x - 1, y) &&
    isGrass(x + 1, y) &&
    isGrass(x, y - 1) &&
    isGrass(x, y + 1);

  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      if (!isPureGrassPatch(x, y)) {
        continue;
      }

      const seed = (x * 37 + y * 53 + x * y * 11) % 97;

      if (seed === 4 || seed === 19) {
        decorations.push({ x, y, texture: 'rock-1-8x8' });
      } else if (seed === 27) {
        decorations.push({ x, y, texture: 'rock-2-8x8' });
      } else if (seed === 9 || seed === 33 || seed === 61) {
        decorations.push({ x, y, texture: 'flower-pink-8x8' });
      } else if (seed === 12 || seed === 41 || seed === 74) {
        decorations.push({ x, y, texture: 'flower-yellow-8x8' });
      } else if (seed === 16 || seed === 46 || seed === 82) {
        decorations.push({ x, y, texture: 'flower-blue-8x8' });
      }
    }
  }

  return decorations;
}
