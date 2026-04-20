'use client';

import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import {
  EQUIPMENT_ITEMS,
  type EquipmentItemId,
} from '@/lib/items/equipmentItems';
import {
  hasDominantFireEquipment,
  PLAYER_EYE_COLOR,
  PLAYER_FIRE_EYE_COLOR,
  type SheetAnimation,
} from '@/components/game-canvas/playerAnimationHelpers';
import { toEquipmentItemId } from '@/components/game-canvas/gameCanvasHelpers';
import { syncCharacterWeaponLayering } from '@/components/game-canvas/renderGeometry';

export type PlayerVisualRefs = {
  weaponItem: Phaser.GameObjects.Image;
  currentBodyItem?: EquipmentItemId;
  currentWeaponItem?: EquipmentItemId;
  currentWeaponOffsetX?: number;
  currentWeaponOffsetY?: number;
};

type ApplyEquipmentVisual = PlayerVisualRefs & {
  container: Phaser.GameObjects.Container;
  burnEffect: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  leftEye: Phaser.GameObjects.Rectangle;
  rightEye: Phaser.GameObjects.Rectangle;
  leftHand: Phaser.GameObjects.Image;
  rightHand: Phaser.GameObjects.Image;
  weaponEffects: Array<{
    image: Phaser.GameObjects.Image;
    aura: Phaser.GameObjects.Ellipse;
    baseX: number;
    baseY: number;
    baseAlpha: number;
    animation?: SheetAnimation;
  }>;
  currentBodyItem?: EquipmentItemId;
  currentWeaponItem?: EquipmentItemId;
  currentWeaponOffsetX: number;
  currentWeaponOffsetY: number;
};

export function applyEquipmentToVisual(
  scene: Phaser.Scene,
  tileSize: number,
  visual: ApplyEquipmentVisual | null,
  equipment: EquipmentState,
) {
  if (!visual) {
    return;
  }

  const bodyItemId = toEquipmentItemId(equipment.body);
  const weaponItemId = toEquipmentItemId(equipment.weapon);
  const weaponItem = weaponItemId ? EQUIPMENT_ITEMS[weaponItemId] : undefined;
  visual.currentBodyItem = bodyItemId;
  const eyeColor = hasDominantFireEquipment(equipment) ? PLAYER_FIRE_EYE_COLOR : PLAYER_EYE_COLOR;

  visual.leftEye.setFillStyle(eyeColor, 1);
  visual.rightEye.setFillStyle(eyeColor, 1);

  if (weaponItemId !== visual.currentWeaponItem) {
    visual.weaponEffects.forEach(({ image, aura }) => {
      image.destroy();
      aura.destroy();
    });
    visual.weaponEffects = [];

    if (weaponItemId) {
      visual.weaponItem.setTexture(weaponItem!.textureKey);
      visual.weaponItem.setOrigin(weaponItem!.equippedOriginX ?? 0.5, weaponItem!.equippedOriginY ?? 0.5);
      visual.weaponItem.setAngle(weaponItem!.worldRotationDeg ?? 0);
      visual.weaponItem.setScale(weaponItem!.worldScale ?? 1);
      visual.weaponItem.setVisible(true);

      weaponItem!.worldEffects?.forEach((effect) => {
        const effectAura = scene.add
          .ellipse(effect.offsetX, effect.offsetY, tileSize * 0.95, tileSize * 0.95, 0xff9a36, 0.38)
          .setOrigin(0.5);
        const effectImage = scene.add
          .image(effect.offsetX, effect.offsetY, effect.textureKey, 0)
          .setDisplaySize(tileSize, tileSize)
          .setScale(effect.scale ?? 1)
          .setAlpha(effect.alpha ?? 1)
          .setAngle(effect.rotationDeg ?? 0)
          .setOrigin(0.5);
        visual.container.add(effectAura);
        visual.container.add(effectImage);
        visual.container.bringToTop(effectAura);
        visual.container.bringToTop(effectImage);

        visual.weaponEffects.push({
          image: effectImage,
          aura: effectAura,
          baseX: effect.offsetX,
          baseY: effect.offsetY,
          baseAlpha: effect.alpha ?? 1,
          animation:
            effect.frameCount && effect.frameDurationMs
              ? {
                  textureKey: effect.textureKey,
                  texturePath: effect.texturePath,
                  frameWidth: effect.frameWidth ?? 32,
                  frameHeight: effect.frameHeight ?? 32,
                  startFrame: 0,
                  startRowFrames: 0,
                  frameCount: effect.frameCount,
                  fps: 1000 / effect.frameDurationMs,
                  columns: 1,
                  loop: true,
                }
              : undefined,
        });
      });
    } else {
      visual.weaponItem.setOrigin(0.5, 0.5);
      visual.weaponItem.setAngle(0);
      visual.weaponItem.setScale(1);
      visual.weaponItem.setVisible(false);
    }
    visual.currentWeaponItem = weaponItemId;
  } else if (weaponItemId) {
    visual.weaponItem.setTexture(weaponItem!.textureKey);
    visual.weaponItem.setOrigin(weaponItem!.equippedOriginX ?? 0.5, weaponItem!.equippedOriginY ?? 0.5);
    visual.weaponItem.setAngle(weaponItem!.worldRotationDeg ?? 0);
    visual.weaponItem.setScale(weaponItem!.worldScale ?? 1);
    visual.weaponItem.setVisible(true);
    visual.weaponEffects.forEach(({ image, aura }) => {
      visual.container.bringToTop(aura);
      visual.container.bringToTop(image);
    });
    visual.container.bringToTop(visual.burnEffect);
  }
  visual.currentWeaponOffsetX = weaponItem?.equippedOffsetX ?? 0;
  visual.currentWeaponOffsetY = weaponItem?.equippedOffsetY ?? 0;
  syncCharacterWeaponLayering(visual, weaponItem, Boolean(weaponItemId) && visual.weaponItem.visible);
}
