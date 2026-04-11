type PhaserScene = import('phaser').Scene;

export type SpriteSheetAnimation = {
  textureKey: string;
  texturePath: string;
  frameWidth: number;
  frameHeight: number;
  startFrame: number;
  startRowFrames?: number;
  frameCount: number;
  fps: number;
  columns: number;
  loop: boolean;
};

export function loadSpriteSheetAnimation(
  scene: PhaserScene,
  animation: Pick<SpriteSheetAnimation, 'textureKey' | 'texturePath' | 'frameWidth' | 'frameHeight'>,
) {
  if (scene.textures.exists(animation.textureKey)) {
    return;
  }

  scene.load.spritesheet(animation.textureKey, animation.texturePath, {
    frameWidth: animation.frameWidth,
    frameHeight: animation.frameHeight,
  });
}

export function resolveSpriteSheetAnimationColumns(
  scene: PhaserScene,
  animation: Pick<SpriteSheetAnimation, 'textureKey' | 'frameWidth' | 'columns'>,
) {
  const texture = scene.textures.get(animation.textureKey);
  const source = texture?.getSourceImage() as { width?: number } | undefined;
  const width = typeof source?.width === 'number' ? source.width : animation.frameWidth;
  animation.columns = Math.max(1, Math.floor(width / animation.frameWidth));
}

export function getSpriteSheetAnimationFrameOffset(
  animation: Pick<SpriteSheetAnimation, 'frameCount' | 'fps' | 'loop'>,
  elapsedMs: number,
  phaseOffsetMs = 0,
) {
  const frameDurationMs = 1000 / Math.max(1, animation.fps);
  const elapsedFrames = Math.floor(Math.max(0, elapsedMs + phaseOffsetMs) / frameDurationMs);
  if (!animation.loop) {
    return Math.min(animation.frameCount - 1, elapsedFrames);
  }

  return elapsedFrames % animation.frameCount;
}

export function getSpriteSheetAnimationFrame(
  animation: Pick<
    SpriteSheetAnimation,
    'startRowFrames' | 'columns' | 'startFrame' | 'frameCount' | 'fps' | 'loop'
  >,
  elapsedMs: number,
  phaseOffsetMs = 0,
) {
  return (
    (animation.startRowFrames ?? 0) * animation.columns +
    animation.startFrame +
    getSpriteSheetAnimationFrameOffset(animation, elapsedMs, phaseOffsetMs)
  );
}

export function getSpriteSheetAnimationDurationMs(
  animation: Pick<SpriteSheetAnimation, 'frameCount' | 'fps'>,
) {
  return Math.max(1, animation.frameCount) * (1000 / Math.max(1, animation.fps));
}
