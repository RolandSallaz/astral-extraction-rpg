import { type MobAnimationClipDefinition } from "@mmorpg/shared/mobs/visuals";
import type { MobAnimationState } from "@mmorpg/shared/mobs/visuals";
import type { SpriteSheetAnimation } from "@/lib/animations/runtime";

const SKELETON_RENDER_SCALE = 2;

type SheetAnimation = SpriteSheetAnimation & {
  skillId?: string;
};

export function getMobRenderScale(texture: string) {
  if (texture === "skeleton") {
    return SKELETON_RENDER_SCALE;
  }

  if (texture === "skeleton-npc-16x16") {
    return SKELETON_RENDER_SCALE;
  }

  if (texture === "bat") {
    return 2;
  }

  if (texture === "rat") {
    return 2;
  }

  return 1;
}

export function getAnimatedMobTexture(texture: string, timeMs: number) {
  if (texture === "bat" || texture === "rat") {
    const frame = Math.floor(timeMs / 240) % 2 === 0 ? 1 : 2;
    return `${texture}_${frame}`;
  }

  return texture;
}

export function getMobClipTextureKey(spritesheet: string) {
  return `mob-clip:${encodeURIComponent(spritesheet)}`;
}

export function getMobVisualKind(texture: string) {
  return texture === "bat" || texture === "rat" || texture === "skeleton" ? texture : null;
}

export function toRuntimeAnimationFromMobClip(clip: MobAnimationClipDefinition): SheetAnimation {
  return {
    textureKey: getMobClipTextureKey(clip.spritesheet),
    texturePath: clip.spritesheet,
    frameWidth: clip.frameWidth,
    frameHeight: clip.frameHeight,
    startFrame: clip.startFrame,
    startRowFrames: 0,
    frameCount: Math.max(1, clip.endFrame - clip.startFrame + 1),
    fps: Math.max(1, clip.frameRate),
    columns: Math.max(1, clip.columns),
    loop: clip.repeat !== 0,
  };
}

export type { MobAnimationState };
