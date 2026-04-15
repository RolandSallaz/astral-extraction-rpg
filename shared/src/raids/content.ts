import { isMobKind, type MobKind } from '../mobs/catalog';

export type RaidLootPoolId = 'outer' | 'mid' | 'core';

export type RaidChestLootBand = {
  minCenterBias: number;
  itemCount: number;
  pools: RaidLootPoolId[];
};

export type RaidChestContentDefinition = {
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  fixedSlots: string[];
  lootPools: Record<RaidLootPoolId, string[]>;
  lootBands: RaidChestLootBand[];
};

export type RaidQuestObjectiveChestDefinition = {
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  fixedSlots: string[];
};

export type RaidTutorialMobDefinition = {
  id: string;
  kind: MobKind;
  roomIndex: number;
  fallbackRoom: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  patrolInset: number;
  patrolRadiusY: number;
  patrolPhase: number;
};

export type RaidMobGenerationDefinition = {
  minSpawnCount: number;
  maxSpawnCount: number;
  spawnRatio: number;
  skeletonSpawnChance: number;
  batMinRoomHeight: number;
  batMinRoomWidth: number;
  batRandomThreshold: number;
  batPatrolRadiusMin: number;
  batPatrolRadiusRoomHeightOffset: number;
  batPatrolRadiusScale: number;
};

export type RaidTemplateContentDefinition = {
  isTutorial: boolean;
  chest: RaidChestContentDefinition;
  questObjectiveChest: RaidQuestObjectiveChestDefinition;
  tutorialMob: RaidTutorialMobDefinition | null;
  mobGeneration: RaidMobGenerationDefinition;
};

export type RaidContentConfig = {
  templates: Record<string, RaidTemplateContentDefinition>;
};

const EMPTY_CHEST: RaidChestContentDefinition = {
  title: 'Crypt Chest',
  subtitle: 'Raid Loot',
  columns: 4,
  rows: 3,
  fixedSlots: [],
  lootPools: {
    outer: [],
    mid: [],
    core: [],
  },
  lootBands: [],
};

const EMPTY_QUEST_OBJECTIVE_CHEST: RaidQuestObjectiveChestDefinition = {
  title: 'Sealed Reliquary',
  subtitle: 'Quest Objective',
  columns: 4,
  rows: 3,
  fixedSlots: ['sealed_relic'],
};

const DEFAULT_MOB_GENERATION: RaidMobGenerationDefinition = {
  minSpawnCount: 6,
  maxSpawnCount: 18,
  spawnRatio: 0.75,
  skeletonSpawnChance: 0.18,
  batMinRoomHeight: 8,
  batMinRoomWidth: 8,
  batRandomThreshold: 0.45,
  batPatrolRadiusMin: 8,
  batPatrolRadiusRoomHeightOffset: 3,
  batPatrolRadiusScale: 4,
};

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(value: unknown, fallback: number, min = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, value) : fallback;
}

function normalizeInteger(value: unknown, fallback: number, min = 0) {
  return Math.floor(normalizeNumber(value, fallback, min));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeChestContent(value: unknown, fallback = EMPTY_CHEST): RaidChestContentDefinition {
  const candidate = value && typeof value === 'object'
    ? (value as Partial<RaidChestContentDefinition>)
    : {};

  const lootPools = candidate.lootPools && typeof candidate.lootPools === 'object'
    ? candidate.lootPools as Partial<Record<RaidLootPoolId, unknown>>
    : {};

  return {
    title: normalizeString(candidate.title, fallback.title),
    subtitle: normalizeString(candidate.subtitle, fallback.subtitle),
    columns: normalizeInteger(candidate.columns, fallback.columns, 1),
    rows: normalizeInteger(candidate.rows, fallback.rows, 1),
    fixedSlots: normalizeStringArray(candidate.fixedSlots),
    lootPools: {
      outer: normalizeStringArray(lootPools.outer),
      mid: normalizeStringArray(lootPools.mid),
      core: normalizeStringArray(lootPools.core),
    },
    lootBands: Array.isArray(candidate.lootBands)
      ? candidate.lootBands.flatMap((band) => {
        if (!band || typeof band !== 'object') {
          return [];
        }

        const rawBand = band as Partial<RaidChestLootBand>;
        const pools = Array.isArray(rawBand.pools)
          ? rawBand.pools.filter((pool): pool is RaidLootPoolId => pool === 'outer' || pool === 'mid' || pool === 'core')
          : [];
        if (pools.length === 0) {
          return [];
        }

        return [{
          minCenterBias: Math.max(0, Math.min(1, normalizeNumber(rawBand.minCenterBias, 0))),
          itemCount: normalizeInteger(rawBand.itemCount, 1, 1),
          pools,
        }];
      }).sort((left, right) => right.minCenterBias - left.minCenterBias)
      : [],
  };
}

function normalizeQuestObjectiveChest(value: unknown): RaidQuestObjectiveChestDefinition {
  const candidate = value && typeof value === 'object'
    ? (value as Partial<RaidQuestObjectiveChestDefinition>)
    : {};

  return {
    title: normalizeString(candidate.title, EMPTY_QUEST_OBJECTIVE_CHEST.title),
    subtitle: normalizeString(candidate.subtitle, EMPTY_QUEST_OBJECTIVE_CHEST.subtitle),
    columns: normalizeInteger(candidate.columns, EMPTY_QUEST_OBJECTIVE_CHEST.columns, 1),
    rows: normalizeInteger(candidate.rows, EMPTY_QUEST_OBJECTIVE_CHEST.rows, 1),
    fixedSlots: normalizeStringArray(candidate.fixedSlots).length > 0
      ? normalizeStringArray(candidate.fixedSlots)
      : [...EMPTY_QUEST_OBJECTIVE_CHEST.fixedSlots],
  };
}

function normalizeTutorialMob(value: unknown): RaidTutorialMobDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<RaidTutorialMobDefinition>;
  const id = normalizeString(candidate.id, '');
  const kind = typeof candidate.kind === 'string' && isMobKind(candidate.kind) ? candidate.kind : null;
  if (!id || !kind) {
    return null;
  }

  const fallbackRoom = candidate.fallbackRoom && typeof candidate.fallbackRoom === 'object'
    ? candidate.fallbackRoom as Partial<RaidTutorialMobDefinition['fallbackRoom']>
    : {};

  return {
    id,
    kind,
    roomIndex: normalizeInteger(candidate.roomIndex, 0),
    fallbackRoom: {
      x: normalizeInteger(fallbackRoom.x, 0),
      y: normalizeInteger(fallbackRoom.y, 0),
      width: normalizeInteger(fallbackRoom.width, 6, 1),
      height: normalizeInteger(fallbackRoom.height, 6, 1),
    },
    patrolInset: normalizeInteger(candidate.patrolInset, 1),
    patrolRadiusY: normalizeInteger(candidate.patrolRadiusY, 0),
    patrolPhase: normalizeNumber(candidate.patrolPhase, 0),
  };
}

function normalizeMobGeneration(value: unknown): RaidMobGenerationDefinition {
  const candidate = value && typeof value === 'object'
    ? (value as Partial<RaidMobGenerationDefinition>)
    : {};

  return {
    minSpawnCount: normalizeInteger(candidate.minSpawnCount, DEFAULT_MOB_GENERATION.minSpawnCount, 0),
    maxSpawnCount: normalizeInteger(candidate.maxSpawnCount, DEFAULT_MOB_GENERATION.maxSpawnCount, 0),
    spawnRatio: normalizeNumber(candidate.spawnRatio, DEFAULT_MOB_GENERATION.spawnRatio, 0),
    skeletonSpawnChance: normalizeNumber(candidate.skeletonSpawnChance, DEFAULT_MOB_GENERATION.skeletonSpawnChance, 0),
    batMinRoomHeight: normalizeInteger(candidate.batMinRoomHeight, DEFAULT_MOB_GENERATION.batMinRoomHeight, 0),
    batMinRoomWidth: normalizeInteger(candidate.batMinRoomWidth, DEFAULT_MOB_GENERATION.batMinRoomWidth, 0),
    batRandomThreshold: normalizeNumber(candidate.batRandomThreshold, DEFAULT_MOB_GENERATION.batRandomThreshold, 0),
    batPatrolRadiusMin: normalizeInteger(candidate.batPatrolRadiusMin, DEFAULT_MOB_GENERATION.batPatrolRadiusMin, 0),
    batPatrolRadiusRoomHeightOffset: normalizeInteger(candidate.batPatrolRadiusRoomHeightOffset, DEFAULT_MOB_GENERATION.batPatrolRadiusRoomHeightOffset, 0),
    batPatrolRadiusScale: normalizeNumber(candidate.batPatrolRadiusScale, DEFAULT_MOB_GENERATION.batPatrolRadiusScale, 0),
  };
}

function normalizeTemplateContent(value: unknown): RaidTemplateContentDefinition {
  const candidate = value && typeof value === 'object'
    ? (value as Partial<RaidTemplateContentDefinition>)
    : {};

  return {
    isTutorial: candidate.isTutorial === true,
    chest: normalizeChestContent(candidate.chest),
    questObjectiveChest: normalizeQuestObjectiveChest(candidate.questObjectiveChest),
    tutorialMob: normalizeTutorialMob(candidate.tutorialMob),
    mobGeneration: normalizeMobGeneration(candidate.mobGeneration),
  };
}

export function normalizeRaidContentConfig(rawValue: unknown): RaidContentConfig {
  const candidate = rawValue && typeof rawValue === 'object'
    ? (rawValue as Partial<RaidContentConfig>)
    : {};
  const templates = candidate.templates && typeof candidate.templates === 'object'
    ? candidate.templates
    : {};

  return {
    templates: Object.fromEntries(
      Object.entries(templates).map(([templateCode, content]) => [
        templateCode,
        normalizeTemplateContent(content),
      ]),
    ),
  };
}

export function getRaidTemplateContent(
  config: RaidContentConfig,
  templateCode: string,
): RaidTemplateContentDefinition {
  return config.templates[templateCode] ?? normalizeTemplateContent(null);
}
