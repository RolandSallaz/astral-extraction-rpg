export type SharedSpriteAnimationDefinition = {
  textureKey: string;
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  frameCount: number;
  frameMs: number;
  loop: boolean;
};

export const COMMON_DEATH_ANIMATION: SharedSpriteAnimationDefinition = {
  textureKey: "common-death-animation",
  texturePath: "/sprites/deadAnim.png",
  frameWidth: 32,
  frameHeight: 32,
  startFrame: 0,
  frameCount: 5,
  frameMs: 100,
  loop: false,
};
