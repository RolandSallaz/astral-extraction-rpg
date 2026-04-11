import { isMobKind, type MobKind } from '../mobs/catalog';

export type WorldTilePosition = {
  x: number;
  y: number;
};

export type WorldChestDefinition = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  x: number;
  y: number;
  slots: string[];
};

export type WorldMobDefinition = {
  id: string;
  kind: MobKind;
  spawn: WorldTilePosition;
  patrol: {
    minX: number;
    maxX: number;
    y: number;
    radiusY: number;
    phase: number;
  };
};

export type WorldDefinition = {
  id: string;
  name: string;
  tileSize: number;
  width: number;
  height: number;
  safeLobby: boolean;
  hostileMobsEnabled: boolean;
  spawn: WorldTilePosition;
  blockedTiles: WorldTilePosition[];
  staticChests: WorldChestDefinition[];
  staticMobs: WorldMobDefinition[];
};

function normalizeInteger(value: unknown, fallback: number, min = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.floor(value))
    : fallback;
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeTilePosition(value: unknown, fallback: WorldTilePosition): WorldTilePosition {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Partial<WorldTilePosition>;
  return {
    x: normalizeInteger(candidate.x, fallback.x),
    y: normalizeInteger(candidate.y, fallback.y),
  };
}

function normalizeChestDefinition(value: unknown): WorldChestDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WorldChestDefinition>;
  const id = normalizeString(candidate.id, '');
  if (!id) {
    return null;
  }

  const columns = normalizeInteger(candidate.columns, 4, 1);
  const rows = normalizeInteger(candidate.rows, 3, 1);
  return {
    id,
    title: normalizeString(candidate.title, 'Wooden Chest'),
    subtitle: normalizeString(candidate.subtitle, 'Container'),
    columns,
    rows,
    x: normalizeInteger(candidate.x, 0),
    y: normalizeInteger(candidate.y, 0),
    slots: Array.from({ length: columns * rows }, (_, index) => {
      const valueAtSlot = Array.isArray(candidate.slots) ? candidate.slots[index] : '';
      return typeof valueAtSlot === 'string' ? valueAtSlot : '';
    }),
  };
}

function normalizeMobDefinition(value: unknown): WorldMobDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WorldMobDefinition> & {
    kind?: unknown;
    spawn?: unknown;
    patrol?: Partial<WorldMobDefinition['patrol']>;
  };
  const id = normalizeString(candidate.id, '');
  const kind = typeof candidate.kind === 'string' && isMobKind(candidate.kind)
    ? candidate.kind
    : null;
  if (!id || !kind) {
    return null;
  }

  const spawn = normalizeTilePosition(candidate.spawn, { x: 0, y: 0 });
  return {
    id,
    kind,
    spawn,
    patrol: {
      minX: normalizeInteger(candidate.patrol?.minX, spawn.x),
      maxX: normalizeInteger(candidate.patrol?.maxX, spawn.x),
      y: normalizeInteger(candidate.patrol?.y, spawn.y),
      radiusY: normalizeInteger(candidate.patrol?.radiusY, 0),
      phase:
        typeof candidate.patrol?.phase === 'number' && Number.isFinite(candidate.patrol.phase)
          ? candidate.patrol.phase
          : 0,
    },
  };
}

export function normalizeWorldDefinition(rawValue: unknown): WorldDefinition {
  const candidate = rawValue && typeof rawValue === 'object'
    ? (rawValue as Partial<WorldDefinition>)
    : {};

  return {
    id: normalizeString(candidate.id, 'lobby'),
    name: normalizeString(candidate.name, 'Lobby'),
    tileSize: normalizeInteger(candidate.tileSize, 32, 1),
    width: normalizeInteger(candidate.width, 40, 1),
    height: normalizeInteger(candidate.height, 30, 1),
    safeLobby: candidate.safeLobby !== false,
    hostileMobsEnabled: candidate.hostileMobsEnabled === true,
    spawn: normalizeTilePosition(candidate.spawn, { x: 20, y: 15 }),
    blockedTiles: Array.isArray(candidate.blockedTiles)
      ? candidate.blockedTiles.map((tile) => normalizeTilePosition(tile, { x: 0, y: 0 }))
      : [],
    staticChests: Array.isArray(candidate.staticChests)
      ? candidate.staticChests.flatMap((chest) => {
        const normalized = normalizeChestDefinition(chest);
        return normalized ? [normalized] : [];
      })
      : [],
    staticMobs: Array.isArray(candidate.staticMobs)
      ? candidate.staticMobs.flatMap((mob) => {
        const normalized = normalizeMobDefinition(mob);
        return normalized ? [normalized] : [];
      })
      : [],
  };
}
