import {
  getSpriteSheetAnimationDurationMs,
  getSpriteSheetAnimationFrame,
  type SpriteSheetAnimation,
} from './runtime';

export type AnimatedStateVisual<TState extends string> = {
  currentAnimationState: TState;
  animationStartedAt: number;
};

export type DeadAnimatedVisual = {
  deathStartedAt: number;
  isDead: boolean;
};

export function syncAnimationState<TState extends string>(
  visual: AnimatedStateVisual<TState>,
  nextState: TState,
  now: number,
  startedAtOverride?: number,
) {
  if (visual.currentAnimationState === nextState) {
    return;
  }

  visual.currentAnimationState = nextState;
  visual.animationStartedAt =
    typeof startedAtOverride === 'number' && Number.isFinite(startedAtOverride)
      ? startedAtOverride
      : now;
}

export function syncDeathState(visual: DeadAnimatedVisual, isDead: boolean, now: number) {
  if (!visual.isDead && isDead) {
    visual.deathStartedAt = now;
  } else if (!isDead) {
    visual.deathStartedAt = 0;
  }

  visual.isDead = isDead;
}

export function getAnimationElapsedMs(
  visual: Pick<AnimatedStateVisual<string>, 'animationStartedAt'>,
  now: number,
) {
  return Math.max(0, now - visual.animationStartedAt);
}

export function getAnimationFrameAtState(
  animation: Pick<
    SpriteSheetAnimation,
    'startRowFrames' | 'columns' | 'startFrame' | 'frameCount' | 'fps' | 'loop'
  >,
  visual: Pick<AnimatedStateVisual<string>, 'animationStartedAt'>,
  now: number,
  phaseOffsetMs = 0,
) {
  return getSpriteSheetAnimationFrame(animation, getAnimationElapsedMs(visual, now), phaseOffsetMs);
}

export function isOneShotAnimationComplete(
  animation: Pick<SpriteSheetAnimation, 'frameCount' | 'fps'>,
  startedAt: number,
  now: number,
) {
  return startedAt > 0 && now >= startedAt + getSpriteSheetAnimationDurationMs(animation);
}

export function isDeathAnimationComplete(
  animation: Pick<SpriteSheetAnimation, 'frameCount' | 'fps'>,
  visual: Pick<DeadAnimatedVisual, 'deathStartedAt'>,
  now: number,
) {
  return isOneShotAnimationComplete(animation, visual.deathStartedAt, now);
}
