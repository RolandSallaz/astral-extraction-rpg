import { MOB_KINDS, type MobKind } from './catalog';

export type MobAnimationState = 'idle' | 'move' | 'attack' | 'hit' | 'death';

export const MOB_ANIMATION_STATES: MobAnimationState[] = ['idle', 'move', 'attack', 'hit', 'death'];

export type MobAnimationClipDefinition = {
  key: string;
  spritesheet: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  startFrame: number;
  endFrame: number;
  frameRate: number;
  repeat: number;
};

export type MobAnimationStateMap = Partial<Record<MobAnimationState, string>>;

export type MobVisualDefinition = {
  kind: MobKind;
  spriteScale: number;
  anchorY: number;
  clips: Record<string, MobAnimationClipDefinition>;
  states: MobAnimationStateMap;
};

export type MobVisualConfig = Record<MobKind, MobVisualDefinition>;

function createDefaultMobVisualDefinition(kind: MobKind): MobVisualDefinition {
  return {
    kind,
    spriteScale: 1,
    anchorY: 1,
    clips: {},
    states: {},
  };
}

export function createDefaultMobVisualConfig(): MobVisualConfig {
  return Object.fromEntries(
    MOB_KINDS.map((kind) => [kind, createDefaultMobVisualDefinition(kind)]),
  ) as MobVisualConfig;
}

export function normalizeMobAnimationClipDefinition(
  key: string,
  rawValue: unknown,
): MobAnimationClipDefinition | null {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const candidate = rawValue as Partial<MobAnimationClipDefinition>;
  const spritesheet = typeof candidate.spritesheet === 'string' ? candidate.spritesheet.trim() : '';
  if (!spritesheet) {
    return null;
  }

  return {
    key,
    spritesheet,
    frameWidth:
      typeof candidate.frameWidth === 'number' && Number.isFinite(candidate.frameWidth)
        ? Math.max(1, Math.floor(candidate.frameWidth))
        : 16,
    frameHeight:
      typeof candidate.frameHeight === 'number' && Number.isFinite(candidate.frameHeight)
        ? Math.max(1, Math.floor(candidate.frameHeight))
        : 16,
    columns:
      typeof candidate.columns === 'number' && Number.isFinite(candidate.columns)
        ? Math.max(1, Math.floor(candidate.columns))
        : 1,
    startFrame:
      typeof candidate.startFrame === 'number' && Number.isFinite(candidate.startFrame)
        ? Math.max(0, Math.floor(candidate.startFrame))
        : 0,
    endFrame:
      typeof candidate.endFrame === 'number' && Number.isFinite(candidate.endFrame)
        ? Math.max(0, Math.floor(candidate.endFrame))
        : 0,
    frameRate:
      typeof candidate.frameRate === 'number' && Number.isFinite(candidate.frameRate)
        ? Math.max(1, Math.floor(candidate.frameRate))
        : 8,
    repeat:
      typeof candidate.repeat === 'number' && Number.isFinite(candidate.repeat)
        ? Math.floor(candidate.repeat)
        : -1,
  };
}

export function normalizeMobVisualDefinition(
  kind: MobKind,
  rawValue: unknown,
): MobVisualDefinition {
  const defaults = createDefaultMobVisualDefinition(kind);
  if (!rawValue || typeof rawValue !== 'object') {
    return defaults;
  }

  const candidate = rawValue as Partial<MobVisualDefinition>;
  const clipEntries = Object.entries(candidate.clips ?? {}).flatMap(([key, value]) => {
    const clip = normalizeMobAnimationClipDefinition(key, value);
    return clip ? [[key, clip] as const] : [];
  });
  const clips = Object.fromEntries(clipEntries);
  const availableClipKeys = new Set(Object.keys(clips));
  const states = Object.fromEntries(
    MOB_ANIMATION_STATES.flatMap((state) => {
      const clipKey = candidate.states?.[state];
      if (typeof clipKey !== 'string' || !availableClipKeys.has(clipKey)) {
        return [];
      }

      return [[state, clipKey] as const];
    }),
  ) as MobAnimationStateMap;

  return {
    kind,
    spriteScale:
      typeof candidate.spriteScale === 'number' && Number.isFinite(candidate.spriteScale)
        ? Math.max(0.1, candidate.spriteScale)
        : defaults.spriteScale,
    anchorY:
      typeof candidate.anchorY === 'number' && Number.isFinite(candidate.anchorY)
        ? Math.max(0, Math.min(1.5, candidate.anchorY))
        : defaults.anchorY,
    clips,
    states,
  };
}

export function normalizeMobVisualConfig(rawConfig?: Partial<Record<MobKind, unknown>>): MobVisualConfig {
  return Object.fromEntries(
    MOB_KINDS.map((kind) => [kind, normalizeMobVisualDefinition(kind, rawConfig?.[kind])]),
  ) as MobVisualConfig;
}
