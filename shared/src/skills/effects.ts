export type SkillEffectId = "fireball" | "fireNova" | "fireField";

export type SkillEffectConfig = {
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  startRowFrames: number;
  frameCount: number;
  fps: number;
  displaySize: number;
};

export type SkillEffectOverrides = Record<SkillEffectId, SkillEffectConfig>;

export const DEFAULT_SKILL_EFFECT_OVERRIDES: SkillEffectOverrides = {
  fireball: {
    texturePath: "/items/equipment/effects/fireball-sheet.png",
    frameWidth: 32,
    frameHeight: 32,
    startFrame: 0,
    startRowFrames: 0,
    frameCount: 4,
    fps: 14,
    displaySize: 28,
  },
  fireNova: {
    texturePath: "/items/equipment/effects/fire-nova-sheet.png",
    frameWidth: 32,
    frameHeight: 32,
    startFrame: 0,
    startRowFrames: 0,
    frameCount: 4,
    fps: 14,
    displaySize: 28,
  },
  fireField: {
    texturePath: "/items/equipment/effects/fire-field-ground-sheet.png",
    frameWidth: 32,
    frameHeight: 32,
    startFrame: 0,
    startRowFrames: 0,
    frameCount: 4,
    fps: 11,
    displaySize: 32,
  },
};
