import type { SpriteSheetAnimation } from "@/lib/animations/runtime";
import type { PlayerAnimationState } from "@mmorpg/shared/player/visuals";
import type { SkillEffectId } from "@/lib/skillEffects";

export type PlayerSheetAnimation = SpriteSheetAnimation & {
  skillId?: SkillEffectId;
  headOffsetYFrames?: number[];
};

export function getWorldTraderSpriteSheetKey(texturePath: string) {
  return `world-trader-sheet:${texturePath}`;
}

function getWorldTraderBodyOverlayTextureKey(texturePath: string) {
  return `world-trader-body-overlay:${encodeURIComponent(texturePath)}`;
}

function isAnimatedWorldTraderBodyOverlay(texturePath: string | undefined) {
  return typeof texturePath === 'string' && /^\/character\/equipment\/.+_idle\.(png|jpg|jpeg|webp|gif)$/i.test(texturePath);
}

export function getWorldTraderBodyOverlayAnimation(
  texturePath: string | undefined,
  idleAnimation?: PlayerSheetAnimation | null,
): PlayerSheetAnimation | null {
  if (!texturePath || !isAnimatedWorldTraderBodyOverlay(texturePath)) {
    return null;
  }

  if (!idleAnimation) {
    return null;
  }

  return {
    ...idleAnimation,
    textureKey: getWorldTraderBodyOverlayTextureKey(texturePath),
    texturePath,
  };
}

export function getWorldTraderAnimationKey(traderId: string) {
  return `world-trader-anim:${traderId}`;
}

export type { PlayerAnimationState };
