import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createGameDataCandidateDirs,
  getWorldMobsPath,
  getWorldDefinitionPath,
  getWorldTradersPath,
} from '@mmorpg/shared/content/paths';
import {
  normalizeWorldDefinition,
  type WorldChestDefinition,
  type WorldDefinition,
} from '@mmorpg/shared/worlds/definition';
import { isMobKind } from '@mmorpg/shared/mobs/catalog';
import { getEquipmentBodyTexturePath, getEquipmentVisual } from '@mmorpg/shared/visuals/equipmentVisuals';
import {
  createDefaultMeadowMapAsset,
  isBlockingMeadowStamp,
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
const WORLD_ID = 'lobby';
const OLD_MAGE_TRADER_ID = 'old-mage';
const OLD_MAGE_TRADER_NAME = 'Old mage';
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

function resolveGameDataDirectory() {
  const candidateDirs = createGameDataCandidateDirs(process.cwd()).map((candidatePath) =>
    path.resolve(candidatePath),
  );

  return candidateDirs.find((candidatePath) => existsSync(candidatePath)) ?? candidateDirs[0];
}

const GAME_DATA_DIRECTORY = resolveGameDataDirectory();
const WORLD_DEFINITION_PATH = path.resolve(getWorldDefinitionPath(GAME_DATA_DIRECTORY, WORLD_ID));
const WORLD_TRADERS_PATH = path.resolve(getWorldTradersPath(GAME_DATA_DIRECTORY, WORLD_ID));
const WORLD_MOBS_PATH = path.resolve(getWorldMobsPath(GAME_DATA_DIRECTORY, WORLD_ID));

function createDefaultOldMageTrader(): MeadowTraderAsset {
  return {
    id: OLD_MAGE_TRADER_ID,
    name: OLD_MAGE_TRADER_NAME,
    x: 17,
    y: 19,
    bodyItemId: 'fire_robe',
    hairTexturePath: '/character/hairs/old_mage_haird.png',
  };
}

function normalizeTraders(
  input: MeadowTraderAsset[] | null | undefined,
  width: number,
  height: number,
) {
  return (input ?? []).reduce<MeadowTraderAsset[]>((accumulator, trader, index) => {
    const x = Math.floor(trader.x);
    const y = Math.floor(trader.y);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return accumulator;
    }

    const normalizedBase = {
      id:
        typeof trader.id === 'string' && trader.id.trim()
          ? trader.id.trim()
          : `npc-${x}-${y}-${index}`,
      x,
      y,
      name:
        typeof trader.name === 'string' && trader.name.trim()
          ? trader.name.trim().slice(0, 40)
          : `NPC ${index + 1}`,
    };

    const spriteSheetPath = typeof trader.spriteSheetPath === 'string' ? trader.spriteSheetPath : '';
    if (IMAGE_PATH_PATTERN.test(spriteSheetPath)) {
      const frameWidth = Math.max(1, Math.floor(trader.frameWidth ?? 16));
      const frameHeight = Math.max(1, Math.floor(trader.frameHeight ?? 16));
      const frameCount = Math.max(1, Math.floor(trader.frameCount ?? 1));
      accumulator.push({
        ...normalizedBase,
        spriteSheetPath,
        frameWidth,
        frameHeight,
        frameCount,
        animationFps: Math.max(1, Math.floor(trader.animationFps ?? 4)),
        animationStartFrame: Math.max(0, Math.floor(trader.animationStartFrame ?? 0)),
        columns: Math.max(1, Math.floor(trader.columns ?? frameCount)),
        renderScale:
          typeof trader.renderScale === 'number' && Number.isFinite(trader.renderScale)
            ? Math.max(0.5, Math.min(8, trader.renderScale))
            : 1,
      } satisfies MeadowTraderAsset);
      return accumulator;
    }

    const bodyItemId = typeof trader.bodyItemId === 'string' && getEquipmentVisual(trader.bodyItemId)
      ? trader.bodyItemId.trim()
      : '';
    const headItemId = typeof trader.headItemId === 'string' && getEquipmentVisual(trader.headItemId)
      ? trader.headItemId.trim()
      : '';

    let bodyTexturePath = typeof trader.bodyTexturePath === 'string' ? trader.bodyTexturePath.trim() : '';
    let hairTexturePath = typeof trader.hairTexturePath === 'string' ? trader.hairTexturePath.trim() : '';
    let headTexturePath = typeof trader.headTexturePath === 'string' ? trader.headTexturePath.trim() : '';
    const hairOffsetX = Number.isFinite(trader.hairOffsetX) ? Number(trader.hairOffsetX) : 0;
    const hairOffsetY = Number.isFinite(trader.hairOffsetY) ? Number(trader.hairOffsetY) : 0;

    // Resolve texture path from item ID if present.
    if (bodyItemId) {
      bodyTexturePath = getEquipmentBodyTexturePath(bodyItemId) ?? bodyTexturePath;
    }
    if (headItemId) {
      headTexturePath = getEquipmentBodyTexturePath(headItemId) ?? headTexturePath;
    }

    // Backward compatibility: older data stored hair in headTexturePath.
    if (!hairTexturePath && /hair/i.test(headTexturePath)) {
      hairTexturePath = headTexturePath;
      headTexturePath = '';
    }

    if (bodyTexturePath && !IMAGE_PATH_PATTERN.test(bodyTexturePath)) {
      return accumulator;
    }
    if (hairTexturePath && !IMAGE_PATH_PATTERN.test(hairTexturePath)) {
      return accumulator;
    }
    if (headTexturePath && !IMAGE_PATH_PATTERN.test(headTexturePath)) {
      return accumulator;
    }

    accumulator.push({
      ...normalizedBase,
      ...(bodyItemId ? { bodyItemId } : {}),
      ...(headItemId ? { headItemId } : {}),
      ...(bodyTexturePath ? { bodyTexturePath } : {}),
      ...(hairTexturePath ? { hairTexturePath } : {}),
      ...(hairOffsetX || hairOffsetY ? { hairOffsetX, hairOffsetY } : {}),
      ...(headTexturePath ? { headTexturePath } : {}),
    } satisfies MeadowTraderAsset);
    return accumulator;
  }, []);
}

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

  const mobs = (input.mobs ?? []).flatMap((mob, index) => {
    const kind = typeof mob.kind === 'string' && isMobKind(mob.kind) ? mob.kind : null;
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
    traders: normalizeTraders(input.traders, width, height),
    mobs,
  };
}

function stripWorldEntitiesFromMapAsset(asset: MeadowMapAsset): MeadowMapAsset {
  return {
    ...asset,
    traders: [],
    mobs: [],
  };
}

async function loadWorldDefinitionFromDisk() {
  try {
    const rawValue = await readFile(WORLD_DEFINITION_PATH, 'utf8');
    return normalizeWorldDefinition(JSON.parse(rawValue) as WorldDefinition);
  } catch {
    return normalizeWorldDefinition({
      id: WORLD_ID,
      name: 'Lobby Meadow',
    });
  }
}

function buildWorldDefinitionFromMapAsset(
  asset: MeadowMapAsset,
  currentWorldDefinition: WorldDefinition,
): WorldDefinition {
  const chestDefinitionsByPosition = new Map<string, WorldChestDefinition>(
    currentWorldDefinition.staticChests.map((chest) => [`${chest.x}:${chest.y}`, chest]),
  );
  const chestDecorations = asset.decorations.filter((decoration) => decoration.texture === 'chest-8x8');
  const blockedTiles = new Map<string, { x: number; y: number }>();

  asset.decorations.forEach((decoration) => {
    if (!decoration.blocked && decoration.texture !== 'chest-8x8') {
      return;
    }

    blockedTiles.set(`${decoration.x}:${decoration.y}`, { x: decoration.x, y: decoration.y });
  });

  asset.stamps.forEach((stamp) => {
    if (!isBlockingMeadowStamp(stamp)) {
      return;
    }

    blockedTiles.set(`${stamp.x}:${stamp.y}`, { x: stamp.x, y: stamp.y });
  });

  const staticChests = chestDecorations.map((decoration, index) => {
    const positionKey = `${decoration.x}:${decoration.y}`;
    const existingChest = chestDefinitionsByPosition.get(positionKey);
    if (existingChest) {
      return existingChest;
    }

    const columns = 4;
    const rows = 3;
    return {
      id: `meadow-chest-${decoration.x}-${decoration.y}-${index}`,
      title: 'Wooden Chest',
      subtitle: 'Container',
      columns,
      rows,
      x: decoration.x,
      y: decoration.y,
      slots: Array.from({ length: columns * rows }, () => ''),
    } satisfies WorldChestDefinition;
  });

  return normalizeWorldDefinition({
    ...currentWorldDefinition,
    tileSize: asset.tileSize,
    width: asset.width,
    height: asset.height,
    spawn: asset.spawn,
    blockedTiles: Array.from(blockedTiles.values()),
    staticChests,
    staticMobs: currentWorldDefinition.staticMobs,
  });
}

async function saveWorldDefinitionFromMapAsset(asset: MeadowMapAsset) {
  const currentWorldDefinition = await loadWorldDefinitionFromDisk();
  const nextWorldDefinition = buildWorldDefinitionFromMapAsset(asset, currentWorldDefinition);
  await mkdir(path.dirname(WORLD_DEFINITION_PATH), { recursive: true });
  await writeFile(WORLD_DEFINITION_PATH, `${JSON.stringify(nextWorldDefinition, null, 2)}\n`, 'utf8');
}

async function loadWorldTradersFromDisk(width: number, height: number, fallbackTraders?: MeadowTraderAsset[]) {
  try {
    const rawValue = await readFile(WORLD_TRADERS_PATH, 'utf8');
    return normalizeTraders(JSON.parse(rawValue) as MeadowTraderAsset[], width, height);
  } catch {
    const traders = normalizeTraders(
      fallbackTraders && fallbackTraders.length > 0 ? fallbackTraders : [createDefaultOldMageTrader()],
      width,
      height,
    );
    await saveWorldTradersToDisk(traders);
    return traders;
  }
}

async function saveWorldTradersToDisk(traders: MeadowTraderAsset[]) {
  await mkdir(path.dirname(WORLD_TRADERS_PATH), { recursive: true });
  await writeFile(WORLD_TRADERS_PATH, `${JSON.stringify(traders, null, 2)}\n`, 'utf8');
}

async function loadWorldMobsFromDisk(width: number, height: number, fallbackMobs?: MeadowMobAsset[]) {
  try {
    const rawValue = await readFile(WORLD_MOBS_PATH, 'utf8');
    return normalizeMapAsset({
      ...createDefaultMeadowMapAsset(),
      width,
      height,
      mobs: JSON.parse(rawValue) as MeadowMobAsset[],
    }).mobs;
  } catch {
    const mobs = normalizeMapAsset({
      ...createDefaultMeadowMapAsset(),
      width,
      height,
      mobs: fallbackMobs ?? [],
    }).mobs;
    await saveWorldMobsToDisk(mobs);
    return mobs;
  }
}

async function saveWorldMobsToDisk(mobs: MeadowMobAsset[]) {
  await mkdir(path.dirname(WORLD_MOBS_PATH), { recursive: true });
  await writeFile(WORLD_MOBS_PATH, `${JSON.stringify(mobs, null, 2)}\n`, 'utf8');
}

export async function loadMeadowMapAssetFromDisk() {
  try {
    const rawValue = await readFile(MAP_ASSET_PATH, 'utf8');
    const normalizedMapAsset = normalizeMapAsset(JSON.parse(rawValue) as MeadowMapAsset);
    const traders = await loadWorldTradersFromDisk(
      normalizedMapAsset.width,
      normalizedMapAsset.height,
      normalizedMapAsset.traders,
    );
    const mobs = await loadWorldMobsFromDisk(
      normalizedMapAsset.width,
      normalizedMapAsset.height,
      normalizedMapAsset.mobs,
    );
    return {
      ...normalizedMapAsset,
      traders,
      mobs,
    };
  } catch {
    const fallback = createDefaultMeadowMapAsset();
    await saveMeadowMapAssetToDisk(fallback);
    return {
      ...fallback,
      traders: await loadWorldTradersFromDisk(fallback.width, fallback.height),
      mobs: await loadWorldMobsFromDisk(fallback.width, fallback.height),
    };
  }
}

export async function saveMeadowMapAssetToDisk(asset: MeadowMapAsset) {
  const normalized = normalizeMapAsset(asset);
  await mkdir(MAP_ASSET_DIRECTORY, { recursive: true });
  await writeFile(MAP_ASSET_PATH, `${JSON.stringify(stripWorldEntitiesFromMapAsset(normalized), null, 2)}\n`, 'utf8');
  await saveWorldTradersToDisk(normalized.traders);
  await saveWorldMobsToDisk(normalized.mobs);
  await saveWorldDefinitionFromMapAsset(normalized);
  return normalized;
}

export { MAP_ASSET_PATH, WORLD_DEFINITION_PATH, WORLD_TRADERS_PATH, WORLD_MOBS_PATH };
