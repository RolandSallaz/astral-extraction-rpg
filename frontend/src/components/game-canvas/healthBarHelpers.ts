'use client';

export const HEALTH_PER_BAR_SEGMENT = 10;
export const MAX_HEALTH_BAR_SEGMENTS = 24;
export const HEALTH_BAR_WIDTH_PX = 24;
export const HEALTH_SEGMENT_GAP_PX = 0.4;

type HealthBarVisual = {
  healthBarFill: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  healthSegments: Phaser.GameObjects.Rectangle[];
  currentHealth: number;
  currentMaxHealth: number;
  currentHealthSegmentCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function applyHealthToVisual(
  visual: HealthBarVisual,
  health: number,
  maxHealth: number,
) {
  const safeMaxHealth = Math.max(1, Math.floor(maxHealth));
  const safeHealth = clamp(Math.floor(health), 0, safeMaxHealth);
  const hpRatio = clamp(safeHealth / safeMaxHealth, 0, 1);
  const segmentCount = Math.max(1, Math.min(MAX_HEALTH_BAR_SEGMENTS, Math.ceil(safeMaxHealth / HEALTH_PER_BAR_SEGMENT)));
  const filledSegments = Math.round(hpRatio * segmentCount);

  visual.currentHealth = safeHealth;
  visual.currentMaxHealth = safeMaxHealth;
  visual.currentHealthSegmentCount = segmentCount;
  visual.healthBarFill.width = HEALTH_BAR_WIDTH_PX * hpRatio;
  visual.healthText.setText(`${safeHealth}/${safeMaxHealth}`);

  visual.healthSegments.forEach((segment, index) => {
    const isActive = index < segmentCount;
    const isFilled = isActive && index < filledSegments;
    segment.setVisible(isActive);
    segment.setFillStyle(isFilled ? 0xef4444 : 0x2a140f, isFilled ? 1 : 0.9);
  });
}

export function applyMobHealthToVisual(
  visual: HealthBarVisual,
  health: number,
  maxHealth: number,
) {
  applyHealthToVisual(visual, health, maxHealth);
}

export function applyCharacterHealthToVisual(
  visual: HealthBarVisual,
  health: number,
  maxHealth: number,
) {
  applyHealthToVisual(visual, health, maxHealth);
}

export function layoutHealthSegments(
  segments: Phaser.GameObjects.Rectangle[],
  centerX: number,
  centerY: number,
  activeSegmentCount: number,
) {
  const count = Math.max(1, Math.min(segments.length, activeSegmentCount));
  const totalGapWidth = Math.max(0, (count - 1) * HEALTH_SEGMENT_GAP_PX);
  const segmentWidth = Math.max(1, (HEALTH_BAR_WIDTH_PX - totalGapWidth) / count);
  const startX = centerX - HEALTH_BAR_WIDTH_PX / 2 + segmentWidth / 2;

  segments.forEach((segment, index) => {
    if (index >= count) {
      return;
    }

    segment.setPosition(startX + index * (segmentWidth + HEALTH_SEGMENT_GAP_PX), centerY);
    segment.setSize(segmentWidth, 4);
  });
}
