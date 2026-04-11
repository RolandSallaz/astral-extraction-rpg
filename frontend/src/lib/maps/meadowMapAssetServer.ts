import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createDefaultMeadowMapAsset,
  type MeadowDecoration,
  type MeadowMapAsset,
  type MeadowMobAsset,
  type MeadowOverlayAsset,
  type MeadowStampAsset,
  type MeadowTraderAsset,
  type MeadowTile,
} from './meadowMap';

const MAP_ASSET_DIRECTORY = path.join(process.cwd(), 'data');
const MAP_ASSET_PATH = path.join(MAP_ASSET_DIRECTORY, 'world-map.json');
const ALLOWED_TILES = new Set<MeadowTile>(['grassGround', 'ground', 'water']);
const ALLOWED_DECORATIONS = new Set<MeadowDecoration['texture']>([
  'rock-1-8x8',
  'rock-2-8x8',
  'flower-pink-8x8',
  'flower-yellow-8x8',
  'flower-blue-8x8',
  'chest-8x8',
]);
const ALLOWED_OVERLAY_TEXTURES = new Set<MeadowOverlayAsset['texture']>([
  'ground-grass-edge-8x8',
  'ground-grass-corner-8x8',
]);
const IMAGE_PATH_PATTERN = /^\/.+\.(png|jpg|jpeg|webp|gif)$/i;

function normalizeMapAsset(input: MeadowMapAsset): MeadowMapAsset {
  const fallback = createDefaultMeadowMapAsset();
  const width = Math.max(1, Math.floor(input.width || fallback.width));
  const height = Math.max(1, Math.floor(input.height || fallback.height));
  const tileSize = Math.max(1, Math.floor(input.tileSize || fallback.tileSize));

  const tiles = Array.from({ length: height }, (_row, y) =>
    Array.from({ length: width }, (_column, x) => {
      const tile = input.tiles?.[y]?.[x];
      return ALLOWED_TILES.has(tile) ? tile : 'grassGround';
    }),
  );

  const spawnX = Math.max(0, Math.min(width - 1, Math.floor(input.spawn?.x ?? fallback.spawn.x)));
  const spawnY = Math.max(0, Math.min(height - 1, Math.floor(input.spawn?.y ?? fallback.spawn.y)));

  const decorations = (input.decorations ?? []).flatMap((decoration) => {
    if (!ALLOWED_DECORATIONS.has(decoration.texture)) {
      return [];
    }

    const x = Math.floor(decoration.x);
    const y = Math.floor(decoration.y);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return [];
    }

    return [{
      x,
      y,
      texture: decoration.texture,
      blocked: Boolean(decoration.blocked),
    }];
  });

  const overlays = (input.overlays ?? []).flatMap((overlay) => {
    if (!ALLOWED_OVERLAY_TEXTURES.has(overlay.texture)) {
      return [];
    }

    const x = Math.floor(overlay.x);
    const y = Math.floor(overlay.y);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return [];
    }

    return [{
      x,
      y,
      texture: overlay.texture,
      rotation: ((Math.round(overlay.rotation / 90) * 90) % 360 + 360) % 360,
      flipX: Boolean(overlay.flipX),
    }];
  });

  const stamps = (input.stamps ?? []).flatMap((stamp) => {
    if (!IMAGE_PATH_PATTERN.test(stamp.texturePath)) {
      return [];
    }

    const x = Math.floor(stamp.x);
    const y = Math.floor(stamp.y);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return [];
    }

    return [{
      x,
      y,
      texturePath: stamp.texturePath,
      rotation: ((Math.round(stamp.rotation / 90) * 90) % 360 + 360) % 360,
      flipX: Boolean(stamp.flipX),
      scale: Math.max(0.25, Math.min(8, Number.isFinite(stamp.scale) ? stamp.scale : 1)),
    } satisfies MeadowStampAsset];
  });

  const traders = (input.traders ?? []).flatMap((trader, index) => {
    const x = Math.floor(trader.x);
    const y = Math.floor(trader.y);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return [];
    }

    const bodyTexturePath = typeof trader.bodyTexturePath === 'string' ? trader.bodyTexturePath : '';
    const headTexturePath = typeof trader.headTexturePath === 'string' ? trader.headTexturePath : '';
    if (!IMAGE_PATH_PATTERN.test(bodyTexturePath) || !IMAGE_PATH_PATTERN.test(headTexturePath)) {
      return [];
    }

    const rawName = typeof trader.name === 'string' ? trader.name.trim() : '';
    const id = typeof trader.id === 'string' && trader.id.trim()
      ? trader.id.trim()
      : `trader-${x}-${y}-${index}`;

    return [{
      id,
      x,
      y,
      name: rawName.slice(0, 40) || 'Trader',
      bodyTexturePath,
      headTexturePath,
    } satisfies MeadowTraderAsset];
  });

  const mobs = (input.mobs ?? []).flatMap((mob, index) => {
    const kind = mob.kind === 'bat' ? 'bat' : mob.kind === 'rat' ? 'rat' : null;
    if (!kind) {
      return [];
    }

    const spawnX = Math.floor(mob.spawn?.x ?? -1);
    const spawnY = Math.floor(mob.spawn?.y ?? -1);
    const patrolMinX = Math.floor(mob.patrol?.minX ?? spawnX);
    const patrolMaxX = Math.floor(mob.patrol?.maxX ?? spawnX);
    const patrolY = Math.floor(mob.patrol?.y ?? spawnY);

    if (
      spawnX < 0 || spawnY < 0 || patrolMinX < 0 || patrolMaxX < 0 || patrolY < 0 ||
      spawnX >= width || spawnY >= height || patrolMinX >= width || patrolMaxX >= width || patrolY >= height
    ) {
      return [];
    }

    const id = typeof mob.id === 'string' && mob.id.trim()
      ? mob.id.trim()
      : `${kind}-${spawnX}-${spawnY}-${index}`;

    return [{
      id,
      kind,
      spawn: { x: spawnX, y: spawnY },
      patrol: {
        minX: Math.min(patrolMinX, patrolMaxX),
        maxX: Math.max(patrolMinX, patrolMaxX),
        y: patrolY,
        radiusY: Math.max(0, Math.floor(mob.patrol?.radiusY ?? 0)),
        phase: Number.isFinite(mob.patrol?.phase) ? Number(mob.patrol.phase) : 0,
      },
    } satisfies MeadowMobAsset];
  });

  return {
    tileSize,
    width,
    height,
    tiles,
    spawn: { x: spawnX, y: spawnY },
    decorations,
    overlays,
    stamps,
    traders,
    mobs,
  };
}

export async function loadMeadowMapAssetFromDisk() {
  try {
    const rawValue = await readFile(MAP_ASSET_PATH, 'utf8');
    return normalizeMapAsset(JSON.parse(rawValue) as MeadowMapAsset);
  } catch {
    const fallback = createDefaultMeadowMapAsset();
    await saveMeadowMapAssetToDisk(fallback);
    return fallback;
  }
}

export async function saveMeadowMapAssetToDisk(asset: MeadowMapAsset) {
  const normalized = normalizeMapAsset(asset);
  await mkdir(MAP_ASSET_DIRECTORY, { recursive: true });
  await writeFile(MAP_ASSET_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export { MAP_ASSET_PATH };
