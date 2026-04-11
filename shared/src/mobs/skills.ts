import type { MobKind } from "./catalog";

export const SKELETON_DASH_SKILL_ID = "skeletonDash";

export type MobSkillId = typeof SKELETON_DASH_SKILL_ID;

export type MobSkillDefinition = {
  id: MobSkillId;
  mobKind: MobKind;
  name: string;
  castMs: number;
  cooldownMs: number;
  damage: number;
  lungeDistanceTiles: number;
  triggerDistanceTiles: number;
  lungeSpeedPxPerSec: number;
  damageType: "physical";
};

export const SKELETON_DASH_SKILL: MobSkillDefinition = {
  id: SKELETON_DASH_SKILL_ID,
  mobKind: "skeleton",
  name: "Skeleton Dash",
  castMs: 1000,
  cooldownMs: 2000,
  damage: 35,
  damageType: "physical",
  lungeDistanceTiles: 3,
  triggerDistanceTiles: 4,
  lungeSpeedPxPerSec: 320,
};
