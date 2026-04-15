import type { CSSProperties } from 'react';
import { getEquipmentVisual } from '@mmorpg/shared/visuals/equipmentVisuals';

export function getItemSpriteSheetStyle(
  itemId: string | undefined,
  texturePath: string,
): CSSProperties | null {
  if (!itemId) {
    return null;
  }

  const idleAnimation = getEquipmentVisual(itemId)?.animations.idle;
  if (!idleAnimation || idleAnimation.texturePath !== texturePath || idleAnimation.frameCount <= 1) {
    return null;
  }

  return {
    backgroundImage: `url(${texturePath})`,
    backgroundPosition: '0% 0%',
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${idleAnimation.frameCount * 100}% 100%`,
    imageRendering: 'pixelated',
  };
}
