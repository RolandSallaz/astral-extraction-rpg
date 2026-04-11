import type { PlayerAnimationState } from "../player/visuals";
import type { EquipmentItemId } from "../items/catalog";

export type EquipmentAnimationClip = {
  textureKey: string;
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  frameCount: number;
  frameMs: number;
  loop: boolean;
  headOffsetYFrames?: number[];
};

export type EquipmentVisualDefinition = {
  slot: "body" | "head";
  animations: Partial<Record<PlayerAnimationState, EquipmentAnimationClip>>;
};

export const EQUIPMENT_VISUALS: Partial<Record<EquipmentItemId, EquipmentVisualDefinition>> = {
  fire_robe: {
    slot: "body",
    animations: {
      idle: {
        textureKey: "equip-fire-robe-idle",
        texturePath: "/character/equipment/fire_robe/fire_robe_idle.png",
        frameWidth: 16,
        frameHeight: 16,
        startFrame: 0,
        frameCount: 4,
        frameMs: 220,
        loop: true,
        headOffsetYFrames: [-1, 0, 1, 0],
      },
    },
  },
};

export function getEquipmentVisual(itemId: string): EquipmentVisualDefinition | undefined {
  return EQUIPMENT_VISUALS[itemId as EquipmentItemId];
}

export function getEquipmentBodyTexturePath(itemId: string): string | undefined {
  const visual = getEquipmentVisual(itemId);
  if (!visual) {
    return undefined;
  }
  return visual.animations.idle?.texturePath;
}

export const BODY_EQUIPMENT_IDS = Object.entries(EQUIPMENT_VISUALS)
  .filter(([, def]) => def.slot === "body")
  .map(([id]) => id as EquipmentItemId);

export const HEAD_EQUIPMENT_IDS = Object.entries(EQUIPMENT_VISUALS)
  .filter(([, def]) => def.slot === "head")
  .map(([id]) => id as EquipmentItemId);
