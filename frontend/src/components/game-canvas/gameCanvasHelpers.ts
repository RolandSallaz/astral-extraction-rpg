import {
  EQUIPMENT_ITEMS,
  type ConsumableItemId,
  type EquipmentItemId,
} from '@/lib/items/equipmentItems';
import { WORLD_GAMEPLAY_PROFILE } from '@mmorpg/shared/gameplay/profiles';
import type { SkillEffectConfig, SkillEffectId } from '@/lib/skillEffects';
import type { SheetAnimation } from '@/components/game-canvas/playerAnimationHelpers';
import {
  createDefaultMeadowMapAsset,
  ensureWorldWorkbenchStamp,
  type MeadowMapAsset,
} from '@/lib/maps/meadowMap';

export function resolveCryptTexture(tile: string) {
  switch (tile) {
    case 'roomCracked':
      return { texture: 'crypt-floor-cracked-8x8', alpha: 1, tint: 0xffffff };
    case 'corridorFloor':
    case 'corridorCracked':
      return {
        texture: tile === 'corridorCracked' ? 'crypt-floor-cracked-8x8' : 'crypt-floor-8x8',
        alpha: 1,
        tint: tile === 'corridorCracked' ? 0xd7c8ba : 0xe7ddf2,
      };
    case 'spawnFloor':
      return { texture: 'crypt-floor-8x8', alpha: 1, tint: 0xe0c27a };
    case 'exitFloor':
      return { texture: 'crypt-floor-8x8', alpha: 1, tint: 0xa694e0 };
    case 'wall':
    case 'wallEdge':
      return { texture: 'crypt-wall-8x8', alpha: 1, tint: tile === 'wallEdge' ? 0xf0e3d4 : 0xffffff };
    default:
      return { texture: 'crypt-floor-8x8', alpha: 1, tint: 0xffffff };
  }
}

export function toEquipmentItemId(value?: string): EquipmentItemId | undefined {
  if (value && value in EQUIPMENT_ITEMS) {
    return value as EquipmentItemId;
  }

  return undefined;
}

export function toConsumableItemId(value?: string): ConsumableItemId | undefined {
  if (!value || !(value in EQUIPMENT_ITEMS)) {
    return undefined;
  }

  return EQUIPMENT_ITEMS[value as ConsumableItemId].type === 'consumable'
    ? (value as ConsumableItemId)
    : undefined;
}

export function getPlayerMobCollisionCenterY(y: number) {
  return y + WORLD_GAMEPLAY_PROFILE.playerMobCollisionOffsetY;
}

export function createSkillAnimation(skillId: SkillEffectId, config: SkillEffectConfig): SheetAnimation {
  return {
    skillId,
    textureKey: `skill-effect-${skillId}`,
    texturePath: config.texturePath,
    frameWidth: config.frameWidth,
    frameHeight: config.frameHeight,
    startFrame: config.startFrame,
    startRowFrames: config.startRowFrames,
    frameCount: config.frameCount,
    fps: config.fps,
    columns: 1,
    loop: true,
  };
}

export async function loadWorldMapAsset(): Promise<MeadowMapAsset> {
  try {
    const response = await fetch('/api/world-map', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load world map asset');
    }

    return ensureWorldWorkbenchStamp(await response.json() as MeadowMapAsset);
  } catch {
    return ensureWorldWorkbenchStamp(createDefaultMeadowMapAsset());
  }
}

export function getRealtimeEndpoint() {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) {
    return process.env.NEXT_PUBLIC_REALTIME_URL;
  }

  return 'ws://localhost:2567';
}
