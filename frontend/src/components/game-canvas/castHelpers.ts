import type { EquipmentState } from "@mmorpg/shared/player/contracts";

export type CastHelpersConfig = {
  fireballBaseCastTimeMs: number;
  fireTrailCastPenaltyMs: number;
  fireBurstExtraLockMs: number;
  staffCastRange: number;
  fireRangeGemId: string;
  woodStaffItemId: string;
};

const FIRE_TRAIL_GEM_ID = "fire_trail_gem";
const CAST_SPEED_GEM_ID = "cast_speed_gem";
const FIRE_BURST_GEM_ID = "fire_burst_gem";

export function getCharacterCastTimeMs(
  equipment: EquipmentState,
  config: CastHelpersConfig,
) {
  let castTimeMs = config.fireballBaseCastTimeMs;

  if (
    equipment["weapon-gem-1"] === FIRE_TRAIL_GEM_ID ||
    equipment["weapon-gem-2"] === FIRE_TRAIL_GEM_ID ||
    equipment["weapon-gem-3"] === FIRE_TRAIL_GEM_ID
  ) {
    castTimeMs += config.fireTrailCastPenaltyMs;
  }

  if (
    equipment["weapon-gem-1"] === CAST_SPEED_GEM_ID ||
    equipment["weapon-gem-2"] === CAST_SPEED_GEM_ID ||
    equipment["weapon-gem-3"] === CAST_SPEED_GEM_ID
  ) {
    castTimeMs *= 0.65;
  }

  if (
    equipment["weapon-gem-1"] === FIRE_BURST_GEM_ID ||
    equipment["weapon-gem-2"] === FIRE_BURST_GEM_ID ||
    equipment["weapon-gem-3"] === FIRE_BURST_GEM_ID
  ) {
    castTimeMs += config.fireBurstExtraLockMs;
  }

  return Math.round(castTimeMs);
}

export function getCharacterCastRange(equipment: EquipmentState, config: CastHelpersConfig) {
  if (
    equipment["weapon-gem-1"] === config.fireRangeGemId ||
    equipment["weapon-gem-2"] === config.fireRangeGemId ||
    equipment["weapon-gem-3"] === config.fireRangeGemId
  ) {
    return config.staffCastRange * 1.25;
  }

  return config.staffCastRange;
}

export function hasWoodStaffEquipped(equipment: EquipmentState, config: CastHelpersConfig) {
  return equipment.weapon === config.woodStaffItemId;
}

export function clampTargetToCastRange(
  equipment: EquipmentState,
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  config: CastHelpersConfig,
) {
  const deltaX = targetX - originX;
  const deltaY = targetY - originY;
  const distance = Math.hypot(deltaX, deltaY);
  const castRange = getCharacterCastRange(equipment, config);

  if (distance <= castRange || distance <= 0.001) {
    return { x: targetX, y: targetY, clamped: false };
  }

  const scale = castRange / distance;
  return {
    x: originX + deltaX * scale,
    y: originY + deltaY * scale,
    clamped: true,
  };
}
