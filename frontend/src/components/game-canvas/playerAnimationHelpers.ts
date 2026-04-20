import {
  COMMON_DEATH_ANIMATION,
} from '@mmorpg/shared';
import {
  DEFAULT_PLAYER_VISUALS,
  type PlayerAnimationState,
} from '@mmorpg/shared/player/visuals';
import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import type { EquippableItemId, EquipmentItemId } from '@/lib/items/equipmentItems';
import {
  getEquipmentVisual,
  type EquipmentAnimationClip,
} from '@mmorpg/shared/visuals/equipmentVisuals';
import { type SpriteSheetAnimation } from '@/lib/animations/runtime';
import type { SkillEffectId } from '@/lib/skillEffects';

export type SheetAnimation = SpriteSheetAnimation & {
  skillId?: SkillEffectId;
};

export type PlayerSheetAnimation = SheetAnimation & {
  headOffsetYFrames?: number[];
};

export type HandAnimationOffsets = {
  leftX: number[];
  leftY: number[];
  rightX: number[];
  rightY: number[];
};

type CharacterEquipment = EquipmentState;

const ELEMENTAL_EQUIPMENT_KEYS = [
  'head',
  'body',
  'weapon',
  'head-gem-1',
  'head-gem-2',
  'head-gem-3',
  'body-gem-1',
  'body-gem-2',
  'body-gem-3',
  'weapon-gem-1',
  'weapon-gem-2',
  'weapon-gem-3',
] as const satisfies ReadonlyArray<keyof CharacterEquipment>;

export const PLAYER_ANIMATIONS: Partial<Record<PlayerAnimationState, PlayerSheetAnimation>> =
  Object.fromEntries(
    Object.entries(DEFAULT_PLAYER_VISUALS.animations).map(([state, clip]) => [
      state,
      {
        textureKey: clip.textureKey,
        texturePath: clip.texturePath,
        frameWidth: clip.frameWidth,
        frameHeight: clip.frameHeight,
        startFrame: clip.startFrame,
        startRowFrames: 0,
        frameCount: clip.frameCount,
        fps: 1000 / clip.frameMs,
        columns: 1,
        loop: clip.loop,
        headOffsetYFrames: clip.headOffsetYFrames,
      },
    ]),
  ) as Partial<Record<PlayerAnimationState, PlayerSheetAnimation>>;

export const PLAYER_EYE_COLOR = Number.parseInt(DEFAULT_PLAYER_VISUALS.eyes.color.replace('#', ''), 16);
export const PLAYER_FIRE_EYE_COLOR = 0xff4d4d;

export const PLAYER_HAND_ANIMATION_OFFSETS: Partial<Record<PlayerAnimationState, HandAnimationOffsets>> = {
  idle: {
    leftX: [0, 0, -1, 0],
    leftY: [-1, 0, 1, 0],
    rightX: [0, 0, 1, 0],
    rightY: [-1, 0, 1, 0],
  },
  move: {
    leftX: [0, -2, 0, 2],
    leftY: [0, 0, -1, 0],
    rightX: [0, 2, 0, -2],
    rightY: [0, -1, 0, -1],
  },
};

export const SHARED_DEATH_ANIMATION: SheetAnimation = {
  textureKey: COMMON_DEATH_ANIMATION.textureKey,
  texturePath: COMMON_DEATH_ANIMATION.texturePath,
  frameWidth: COMMON_DEATH_ANIMATION.frameWidth,
  frameHeight: COMMON_DEATH_ANIMATION.frameHeight,
  startFrame: COMMON_DEATH_ANIMATION.startFrame,
  startRowFrames: 0,
  frameCount: COMMON_DEATH_ANIMATION.frameCount,
  fps: 1000 / COMMON_DEATH_ANIMATION.frameMs,
  columns: 1,
  loop: COMMON_DEATH_ANIMATION.loop,
};

function getEquipmentElement(itemId: EquippableItemId | undefined) {
  if (typeof itemId !== 'string') {
    return null;
  }

  if (itemId.startsWith('fire_')) return 'fire';
  if (itemId.startsWith('ice_')) return 'ice';
  if (itemId.startsWith('lightning_')) return 'lightning';
  if (itemId.startsWith('darkness_')) return 'darkness';
  if (itemId.startsWith('void_')) return 'void';

  return null;
}

export function hasDominantFireEquipment(equipment: CharacterEquipment) {
  let elementalCount = 0;
  let fireCount = 0;

  for (const key of ELEMENTAL_EQUIPMENT_KEYS) {
    const element = getEquipmentElement(equipment[key]);
    if (!element) continue;
    elementalCount += 1;
    if (element === 'fire') fireCount += 1;
  }

  return elementalCount > 0 && fireCount * 2 > elementalCount;
}

export function toPlayerAnimationFromEquipmentClip(clip: EquipmentAnimationClip): PlayerSheetAnimation {
  return {
    textureKey: clip.textureKey,
    texturePath: clip.texturePath,
    frameWidth: clip.frameWidth,
    frameHeight: clip.frameHeight,
    startFrame: clip.startFrame,
    startRowFrames: 0,
    frameCount: clip.frameCount,
    fps: 1000 / clip.frameMs,
    columns: 1,
    loop: clip.loop,
    headOffsetYFrames: clip.headOffsetYFrames,
  };
}

export function getBodyAnimationForEquipment(
  bodyItemId: EquipmentItemId | undefined,
  state: PlayerAnimationState,
): PlayerSheetAnimation | undefined {
  if (!bodyItemId) return undefined;

  const visual = getEquipmentVisual(bodyItemId);
  if (!visual || visual.slot !== 'body') return undefined;

  const clip = visual.animations[state] ?? visual.animations.idle;
  return clip ? toPlayerAnimationFromEquipmentClip(clip) : undefined;
}
