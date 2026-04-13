'use client';

import type { MutableRefObject } from 'react';
import type Phaser from 'phaser';
import type { MouseActionSlotKey } from '@/components/GameHud';

type WorldEditorMode = 'tile' | 'sprite' | 'mob' | 'spawn' | 'trader';

type SelectedWorldSprite = {
  texturePath: string;
  rotation: number;
  flipX: boolean;
  scale: number;
};

type CreateWorldEditorInputHandlerParams = {
  scene: Phaser.Scene;
  camera: Phaser.Cameras.Scene2D.Camera;
  tileSize: number;
  meadowWidth: number;
  meadowHeight: number;
  isRaidScene: boolean;
  worldEditorEnabledRef: MutableRefObject<boolean | undefined>;
  worldEditorModeRef: MutableRefObject<WorldEditorMode | undefined>;
  selectedWorldSpriteRef: MutableRefObject<SelectedWorldSprite | undefined>;
  worldEditPaintRef: MutableRefObject<
    ((tileX: number, tileY: number, eraseOverlay?: boolean) => void) | undefined
  >;
  worldStampSprites: Phaser.GameObjects.Image[];
  worldStampSpritesByTile: Map<string, Phaser.GameObjects.Image>;
  getWorldStampTextureKey: (texturePath: string) => string;
};

export function createWorldEditorInputHandler({
  scene,
  camera,
  tileSize,
  meadowWidth,
  meadowHeight,
  isRaidScene,
  worldEditorEnabledRef,
  worldEditorModeRef,
  selectedWorldSpriteRef,
  worldEditPaintRef,
  worldStampSprites,
  worldStampSpritesByTile,
  getWorldStampTextureKey,
}: CreateWorldEditorInputHandlerParams) {
  let worldEditPointerActive = false;
  let worldEditEraseMode = false;
  let lastWorldEditedTileKey = '';

  const handlePointerDown = (pointer: Phaser.Input.Pointer, mouseSlotKey: MouseActionSlotKey | null) => {
    if (isRaidScene || !worldEditorEnabledRef.current) {
      return false;
    }

    if (!mouseSlotKey) {
      return false;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
    const tileX = Math.max(0, Math.min(meadowWidth - 1, Math.floor(worldPoint.x / tileSize)));
    const tileY = Math.max(0, Math.min(meadowHeight - 1, Math.floor(worldPoint.y / tileSize)));
    const currentEditorMode = worldEditorModeRef.current;
    const canEraseWorldEdit =
      currentEditorMode === 'sprite' || currentEditorMode === 'trader' || currentEditorMode === 'mob';

    pointer.event?.preventDefault();
    worldEditPointerActive = true;
    worldEditEraseMode = mouseSlotKey === 'RMB' && canEraseWorldEdit;
    lastWorldEditedTileKey = `${tileX}:${tileY}:${worldEditEraseMode ? 'erase' : 'paint'}`;
    worldEditPaintRef.current?.(tileX, tileY, mouseSlotKey === 'RMB' && canEraseWorldEdit);

    if (currentEditorMode === 'sprite') {
      const tileKey = `${tileX}:${tileY}`;
      if (mouseSlotKey === 'RMB') {
        const existingSprite = worldStampSpritesByTile.get(tileKey);
        if (existingSprite) {
          const existingIndex = worldStampSprites.indexOf(existingSprite);
          if (existingIndex >= 0) {
            worldStampSprites.splice(existingIndex, 1);
          }
          existingSprite.destroy();
          worldStampSpritesByTile.delete(tileKey);
        }
      } else {
        const currentSelectedWorldSprite = selectedWorldSpriteRef.current;
        if (currentSelectedWorldSprite) {
          const previewTextureKey = getWorldStampTextureKey(currentSelectedWorldSprite.texturePath);
          if (currentSelectedWorldSprite.texturePath && scene.textures.exists(previewTextureKey)) {
            const existingSprite = worldStampSpritesByTile.get(tileKey);
            if (existingSprite) {
              const existingIndex = worldStampSprites.indexOf(existingSprite);
              if (existingIndex >= 0) {
                worldStampSprites.splice(existingIndex, 1);
              }
              existingSprite.destroy();
            }
            const worldX = tileX * tileSize + tileSize / 2;
            const worldY = tileY * tileSize + tileSize / 2;
            const stampSprite = scene.add
              .image(worldX, worldY, previewTextureKey)
              .setDisplaySize(tileSize * currentSelectedWorldSprite.scale, tileSize * currentSelectedWorldSprite.scale)
              .setAngle(currentSelectedWorldSprite.rotation)
              .setFlipX(currentSelectedWorldSprite.flipX)
              .setOrigin(0.5)
              .setDepth(1.5);
            worldStampSprites.push(stampSprite);
            worldStampSpritesByTile.set(tileKey, stampSprite);
          }
        }
      }
    }

    return true;
  };

  const handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (isRaidScene || !worldEditorEnabledRef.current || !worldEditPointerActive) {
      return false;
    }

    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
    const tileX = Math.max(0, Math.min(meadowWidth - 1, Math.floor(worldPoint.x / tileSize)));
    const tileY = Math.max(0, Math.min(meadowHeight - 1, Math.floor(worldPoint.y / tileSize)));
    const tileKey = `${tileX}:${tileY}:${worldEditEraseMode ? 'erase' : 'paint'}`;
    if (tileKey === lastWorldEditedTileKey) {
      return true;
    }

    lastWorldEditedTileKey = tileKey;
    worldEditPaintRef.current?.(tileX, tileY, worldEditEraseMode);

    if (worldEditorModeRef.current === 'sprite') {
      const mapTileKey = `${tileX}:${tileY}`;
      if (worldEditEraseMode) {
        const existingSprite = worldStampSpritesByTile.get(mapTileKey);
        if (existingSprite) {
          const existingIndex = worldStampSprites.indexOf(existingSprite);
          if (existingIndex >= 0) {
            worldStampSprites.splice(existingIndex, 1);
          }
          existingSprite.destroy();
          worldStampSpritesByTile.delete(mapTileKey);
        }
      } else {
        const currentSelectedWorldSprite = selectedWorldSpriteRef.current;
        if (currentSelectedWorldSprite) {
          const previewTextureKey = getWorldStampTextureKey(currentSelectedWorldSprite.texturePath);
          if (currentSelectedWorldSprite.texturePath && scene.textures.exists(previewTextureKey)) {
            const existingSprite = worldStampSpritesByTile.get(mapTileKey);
            if (existingSprite) {
              const existingIndex = worldStampSprites.indexOf(existingSprite);
              if (existingIndex >= 0) {
                worldStampSprites.splice(existingIndex, 1);
              }
              existingSprite.destroy();
            }
            const worldX = tileX * tileSize + tileSize / 2;
            const worldY = tileY * tileSize + tileSize / 2;
            const stampSprite = scene.add
              .image(worldX, worldY, previewTextureKey)
              .setDisplaySize(tileSize * currentSelectedWorldSprite.scale, tileSize * currentSelectedWorldSprite.scale)
              .setAngle(currentSelectedWorldSprite.rotation)
              .setFlipX(currentSelectedWorldSprite.flipX)
              .setOrigin(0.5)
              .setDepth(1.5);
            worldStampSprites.push(stampSprite);
            worldStampSpritesByTile.set(mapTileKey, stampSprite);
          }
        }
      }
    }

    return true;
  };

  const handlePointerUp = () => {
    worldEditPointerActive = false;
    lastWorldEditedTileKey = '';
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
