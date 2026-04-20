'use client';

import { DEFAULT_PLAYER_VISUALS, type PlayerEyeLookDirection } from '@mmorpg/shared/player/visuals';
import type { ItemDefinition } from '@/lib/items/equipmentItems';
import {
  getSpriteSheetAnimationFrameOffset,
  type SpriteSheetAnimation,
} from '@/lib/animations/runtime';

type CharacterWeaponLayeringVisual = {
  container: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Image;
  leftEye: Phaser.GameObjects.Rectangle;
  rightEye: Phaser.GameObjects.Rectangle;
  leftHand: Phaser.GameObjects.Image;
  rightHand: Phaser.GameObjects.Image;
  weaponItem: Phaser.GameObjects.Image;
  weaponEffects: Array<{
    image: Phaser.GameObjects.Image;
    aura: Phaser.GameObjects.Ellipse;
  }>;
  burnEffect: Phaser.GameObjects.Image;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getVisualPixelSize(
  visual: Pick<typeof DEFAULT_PLAYER_VISUALS.body, 'frameWidth' | 'displayScale'>,
  tileSize: number,
) {
  const frameWidth = visual.frameWidth ?? 16;
  const rawPixelSize = (tileSize * visual.displayScale) / Math.max(1, frameWidth);
  return Math.max(1, Math.round(rawPixelSize));
}

export function getVisualDisplaySize(
  visual: Pick<typeof DEFAULT_PLAYER_VISUALS.body, 'frameWidth' | 'frameHeight' | 'displayScale'>,
  tileSize: number,
) {
  const pixelSize = getVisualPixelSize(visual, tileSize);
  const frameWidth = visual.frameWidth ?? 16;
  const frameHeight = visual.frameHeight ?? 16;
  return {
    width: frameWidth * pixelSize,
    height: frameHeight * pixelSize,
  };
}

export function getPlayerHeadOffsetY(
  animation: (SpriteSheetAnimation & { headOffsetYFrames?: number[] }) | undefined,
  animationStartedAt: number,
  now: number,
  worldPixelSize: number,
) {
  if (!animation?.headOffsetYFrames || animation.headOffsetYFrames.length === 0) {
    return 0;
  }

  const frameOffset = getSpriteSheetAnimationFrameOffset(animation, Math.max(0, now - animationStartedAt));
  const offsetPixels = animation.headOffsetYFrames[frameOffset % animation.headOffsetYFrames.length] ?? 0;
  return offsetPixels * worldPixelSize;
}

export function getEyeLookDirection(targetY: number | null | undefined, sourceY: number): PlayerEyeLookDirection {
  if (typeof targetY !== 'number' || !Number.isFinite(targetY)) {
    return 'down';
  }

  return targetY < sourceY ? 'up' : 'down';
}

export function getEyeLocalPosition(
  direction: PlayerEyeLookDirection,
  side: 'left' | 'right',
  tileSize: number,
) {
  const pixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.head, tileSize);
  const frameWidth = DEFAULT_PLAYER_VISUALS.head.frameWidth ?? 16;
  const frameHeight = DEFAULT_PLAYER_VISUALS.head.frameHeight ?? 16;
  const eye = DEFAULT_PLAYER_VISUALS.eyes.positions[direction][side];

  return {
    x: DEFAULT_PLAYER_VISUALS.head.offsetX + (eye.x + 0.5 - frameWidth / 2) * pixelSize,
    y: DEFAULT_PLAYER_VISUALS.head.offsetY + (eye.y + 0.5 - frameHeight / 2) * pixelSize,
  };
}

export function getHandLocalPosition(
  base: { x: number; y: number },
  offset: { x: number; y: number },
  tileSize: number,
  handFrameSize = { width: 4, height: 4 },
) {
  const pixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
  const bodyFrameWidth = DEFAULT_PLAYER_VISUALS.body.frameWidth ?? 16;
  const bodyFrameHeight = DEFAULT_PLAYER_VISUALS.body.frameHeight ?? 16;
  const centerX = base.x + offset.x + handFrameSize.width / 2;
  const centerY = base.y + offset.y + handFrameSize.height / 2;

  return {
    x: DEFAULT_PLAYER_VISUALS.body.offsetX + (centerX - bodyFrameWidth / 2) * pixelSize,
    y: DEFAULT_PLAYER_VISUALS.body.offsetY + (centerY - bodyFrameHeight / 2) * pixelSize,
  };
}

export function getHandDisplaySize(tileSize: number, handFrameSize = { width: 4, height: 4 }) {
  const pixelSize = getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
  return {
    width: handFrameSize.width * pixelSize,
    height: handFrameSize.height * pixelSize,
  };
}

export function getEquippedItemHandPosition(
  item: Pick<ItemDefinition, 'equippedAnchorHand'> | undefined,
  leftHandPosition: { x: number; y: number },
  rightHandPosition: { x: number; y: number },
) {
  return item?.equippedAnchorHand === 'right' ? rightHandPosition : leftHandPosition;
}

export function syncCharacterWeaponLayering(
  visual: CharacterWeaponLayeringVisual,
  item: Pick<ItemDefinition, 'equippedAnchorHand'> | undefined,
  showWeapon: boolean,
) {
  const holdingHand = item?.equippedAnchorHand === 'left' ? visual.leftHand : visual.rightHand;

  visual.container.bringToTop(visual.head);
  visual.container.bringToTop(visual.leftEye);
  visual.container.bringToTop(visual.rightEye);

  if (showWeapon) {
    visual.container.bringToTop(visual.weaponItem);
    visual.weaponEffects.forEach(({ aura, image }) => {
      visual.container.bringToTop(aura);
      visual.container.bringToTop(image);
    });
    visual.container.bringToTop(holdingHand);
  }

  visual.container.bringToTop(visual.burnEffect);
}

export function getSharedDeathAnimationScale(tileSize: number) {
  return getVisualPixelSize(DEFAULT_PLAYER_VISUALS.body, tileSize);
}

export function getMobDeathAnimationCenterY(mob: Pick<{ sprite: Phaser.GameObjects.Image }, 'sprite'>) {
  return mob.sprite.y + (0.5 - mob.sprite.originY) * mob.sprite.displayHeight;
}

export function getEntitySortDepth(footY: number, mapHeight: number) {
  return 1 + clamp(footY / Math.max(1, mapHeight), 0, 1) * 2.2;
}

export function getCharacterFootY(character: Pick<{ container: Phaser.GameObjects.Container }, 'container'>, tileSize: number) {
  return character.container.y + tileSize * 0.42;
}

export function getMobFootY(mob: Pick<{ sprite: Phaser.GameObjects.Image }, 'sprite'>) {
  return mob.sprite.y + mob.sprite.displayHeight * (1 - mob.sprite.originY);
}

export function getWorldTraderFootY(trader: Pick<{ container: Phaser.GameObjects.Container }, 'container'>, tileSize: number) {
  return trader.container.y + tileSize * 0.42;
}
