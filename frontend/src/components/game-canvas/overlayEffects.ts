import type { ThrownConsumableMessage } from '@mmorpg/shared/realtime/contracts';
import {
  EQUIPMENT_ITEMS,
  getItemIconTintValue,
  type ConsumableItemId,
} from '@/lib/items/equipmentItems';

const THROWN_CONSUMABLE_MIN_ARC_HEIGHT_PX = 18;
const THROWN_CONSUMABLE_MAX_ARC_HEIGHT_PX = 52;
export const THROWN_CONSUMABLE_IMPACT_DURATION_MS = 220;

export type ThrownConsumableVisual = {
  itemId: ConsumableItemId;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  baseScale: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startedAt: number;
  endsAt: number;
  arcHeight: number;
};

export function getThrownConsumableArcHeight(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
) {
  const distance = Math.hypot(targetX - startX, targetY - startY);
  return Phaser.Math.Clamp(
    THROWN_CONSUMABLE_MIN_ARC_HEIGHT_PX + distance * 0.14,
    THROWN_CONSUMABLE_MIN_ARC_HEIGHT_PX,
    THROWN_CONSUMABLE_MAX_ARC_HEIGHT_PX,
  );
}

export function createFloatingCombatText({
  scene,
  x,
  y,
  text,
  color = '#ff5959',
  isWorldPointVisible,
}: {
  scene: Phaser.Scene;
  x: number;
  y: number;
  text: string;
  color?: string;
  isWorldPointVisible: (x: number, y: number) => boolean;
}) {
  if (!isWorldPointVisible(x, y)) {
    return;
  }

  const label = scene.add
    .text(x, y, text, {
      color,
      fontFamily: 'monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      stroke: '#3b0909',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setScale(0.55)
    .setDepth(62);

  scene.tweens.add({
    targets: label,
    y: y - 18,
    alpha: 0,
    scale: 0.72,
    duration: 650,
    ease: 'Cubic.Out',
    onComplete: () => label.destroy(),
  });
}

export function playThrownConsumableImpact({
  scene,
  itemId,
  x,
  y,
  tileSize,
  mapHeight,
  isWorldPointVisible,
  getEntitySortDepth,
  entitySortAuraOffset,
  entitySortEffectOffset,
}: {
  scene: Phaser.Scene;
  itemId: ConsumableItemId;
  x: number;
  y: number;
  tileSize: number;
  mapHeight: number;
  isWorldPointVisible: (x: number, y: number) => boolean;
  getEntitySortDepth: (footY: number, mapHeight: number) => number;
  entitySortAuraOffset: number;
  entitySortEffectOffset: number;
}) {
  const item = EQUIPMENT_ITEMS[itemId];
  if (!item || item.type !== 'consumable') {
    return;
  }
  const itemTint = getItemIconTintValue(itemId);

  const visible = isWorldPointVisible(x, y);
  const impactDepth = getEntitySortDepth(y + tileSize * 0.34, mapHeight);
  const splash = scene.add
    .ellipse(x, y + tileSize * 0.22, tileSize * 0.56, tileSize * 0.24, 0x6dff8f, 0.28)
    .setDepth(impactDepth + entitySortAuraOffset)
    .setVisible(visible);
  const ring = scene.add
    .ellipse(x, y + tileSize * 0.22, tileSize * 0.32, tileSize * 0.14)
    .setStrokeStyle(2, 0xd7ffe0, 0.85)
    .setDepth(impactDepth + entitySortEffectOffset)
    .setVisible(visible);
  const bottleShard = scene.add
    .image(x, y - tileSize * 0.18, item.textureKey)
    .setOrigin(0.5)
    .setScale((item.compactIconScale ?? item.iconScale ?? 1) * 0.58)
    .setAngle((item.worldRotationDeg ?? -18) + 18)
    .setAlpha(0.78)
    .setDepth(impactDepth + entitySortEffectOffset)
    .setVisible(visible);
  if (itemTint !== null) {
    bottleShard.setTint(itemTint);
  }

  scene.tweens.add({
    targets: splash,
    scaleX: 1.7,
    scaleY: 1.35,
    alpha: 0,
    duration: THROWN_CONSUMABLE_IMPACT_DURATION_MS,
    ease: 'Quad.Out',
    onComplete: () => splash.destroy(),
  });
  scene.tweens.add({
    targets: ring,
    scaleX: 2.4,
    scaleY: 1.9,
    alpha: 0,
    duration: THROWN_CONSUMABLE_IMPACT_DURATION_MS,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });
  scene.tweens.add({
    targets: bottleShard,
    y: y - tileSize * 0.55,
    alpha: 0,
    angle: bottleShard.angle + 70,
    duration: THROWN_CONSUMABLE_IMPACT_DURATION_MS,
    ease: 'Cubic.Out',
    onComplete: () => bottleShard.destroy(),
  });
}

export function createThrownConsumableVisual({
  scene,
  payload,
  sourceCharacter,
  tileSize,
  mapHeight,
  isWorldPointVisible,
  getEntitySortDepth,
  entitySortShadowOffset,
  entitySortEffectOffset,
  now,
}: {
  scene: Phaser.Scene;
  payload: ThrownConsumableMessage;
  sourceCharacter: { container: { x: number; y: number } } | null;
  tileSize: number;
  mapHeight: number;
  isWorldPointVisible: (x: number, y: number) => boolean;
  getEntitySortDepth: (footY: number, mapHeight: number) => number;
  entitySortShadowOffset: number;
  entitySortEffectOffset: number;
  now: number;
}): ThrownConsumableVisual | null {
  if (payload.itemId !== 'healing_potion') {
    return null;
  }

  const item = EQUIPMENT_ITEMS[payload.itemId];
  if (!item || item.type !== 'consumable') {
    return null;
  }
  const itemTint = getItemIconTintValue(payload.itemId);

  const startX = sourceCharacter?.container.x ?? payload.startX ?? 0;
  const startY = sourceCharacter
    ? sourceCharacter.container.y - tileSize * 0.78
    : payload.startY ?? 0;
  const targetX = payload.targetX ?? startX;
  const targetY = payload.targetY ?? startY;
  const baseScale = (item.worldScale ?? item.compactIconScale ?? item.iconScale ?? 1) * 0.82;
  const shadow = scene.add
    .ellipse(startX, startY + tileSize * 0.3, tileSize * 0.34, tileSize * 0.18, 0x102008, 0.18)
    .setDepth(getEntitySortDepth(startY + tileSize * 0.42, mapHeight) - entitySortShadowOffset)
    .setVisible(isWorldPointVisible(startX, startY));
  const sprite = scene.add
    .image(startX, startY, item.textureKey)
    .setOrigin(0.5)
    .setScale(baseScale)
    .setAngle(item.worldRotationDeg ?? -18)
    .setDepth(getEntitySortDepth(startY + tileSize * 0.42, mapHeight) + entitySortEffectOffset)
    .setVisible(isWorldPointVisible(startX, startY));
  if (itemTint !== null) {
    sprite.setTint(itemTint);
  }

  return {
    itemId: payload.itemId,
    sprite,
    shadow,
    baseScale,
    startX,
    startY,
    targetX,
    targetY,
    startedAt: now,
    endsAt: now + Math.max(1, payload.durationMs ?? THROWN_CONSUMABLE_IMPACT_DURATION_MS),
    arcHeight: getThrownConsumableArcHeight(startX, startY, targetX, targetY),
  };
}
