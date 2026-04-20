'use client';

import {
  applyRaidPredictedMovement,
  applyWorldPredictedMovement,
  type MovementBlocker,
} from '@/components/game-canvas/movementPrediction';
import type { PendingRaidInputSample, PendingWorldInputSample } from '@/components/game-canvas/networkTypes';
import type { CharacterVisual } from '@/components/game-canvas/gameCanvasVisualTypes';
import type { createMeadowDecorations, createMeadowStampsFromAsset } from '@/lib/maps/meadowMap';

export type RaidReconcileContext = {
  tileSize: number;
  pendingRaidInputs: PendingRaidInputSample[];
  raidBlockedTiles: Uint8Array;
  raidChestBlockedTiles: Uint8Array;
  speed: number;
  strongDesyncDistance: number;
  mobBlockers: MovementBlocker[];
};

export type WorldReconcileContext = {
  tileSize: number;
  pendingWorldInputs: PendingWorldInputSample[];
  mapWidth: number;
  mapHeight: number;
  meadowDecorations: ReturnType<typeof createMeadowDecorations>;
  meadowStamps: ReturnType<typeof createMeadowStampsFromAsset>;
  speed: number;
  strongDesyncDistance: number;
  mobBlockers: MovementBlocker[];
};

function applyReconciliation(
  character: CharacterVisual,
  resolvedX: number,
  resolvedY: number,
  tileSize: number,
  strongDesyncDistance: number,
): void {
  const reconciliationDistance = Math.hypot(
    character.simX - resolvedX,
    character.simY - resolvedY,
  );

  if (reconciliationDistance > 18 * tileSize) {
    character.simPrevX = resolvedX;
    character.simPrevY = resolvedY;
    character.simX = resolvedX;
    character.simY = resolvedY;
    character.simErrorX = 0;
    character.simErrorY = 0;
    character.container.setPosition(resolvedX, resolvedY);
    return;
  }

  if (reconciliationDistance > strongDesyncDistance) {
    character.simPrevX = resolvedX;
    character.simPrevY = resolvedY;
    character.simX = resolvedX;
    character.simY = resolvedY;
    character.simErrorX = 0;
    character.simErrorY = 0;
    character.container.setPosition(resolvedX, resolvedY);
    return;
  }

  const maxError = tileSize * 2;
  let errorX = character.container.x - resolvedX;
  let errorY = character.container.y - resolvedY;
  if (errorX > maxError) errorX = maxError;
  else if (errorX < -maxError) errorX = -maxError;
  if (errorY > maxError) errorY = maxError;
  else if (errorY < -maxError) errorY = -maxError;
  character.simErrorX = errorX;
  character.simErrorY = errorY;
  character.simPrevX = resolvedX;
  character.simPrevY = resolvedY;
  character.simX = resolvedX;
  character.simY = resolvedY;
}

export function reconcileRaidLocalCharacter(
  character: CharacterVisual,
  authoritativeX: number,
  authoritativeY: number,
  width: number,
  height: number,
  ctx: RaidReconcileContext,
): void {
  const mapWidthPixels = width * ctx.tileSize;
  const mapHeightPixels = height * ctx.tileSize;
  let resolvedX = authoritativeX;
  let resolvedY = authoritativeY;

  for (const input of ctx.pendingRaidInputs) {
    const replayed = applyRaidPredictedMovement(
      resolvedX, resolvedY, input.x, input.y,
      input.durationMs / 1000,
      ctx.tileSize, mapWidthPixels, mapHeightPixels,
      ctx.raidBlockedTiles, width, height, ctx.raidChestBlockedTiles,
      ctx.speed, ctx.mobBlockers,
    );
    resolvedX = replayed.x;
    resolvedY = replayed.y;
  }

  applyReconciliation(character, resolvedX, resolvedY, ctx.tileSize, ctx.strongDesyncDistance);
}

export function reconcileWorldLocalCharacter(
  character: CharacterVisual,
  authoritativeX: number,
  authoritativeY: number,
  ctx: WorldReconcileContext,
): void {
  let resolvedX = authoritativeX;
  let resolvedY = authoritativeY;

  for (const input of ctx.pendingWorldInputs) {
    const replayed = applyWorldPredictedMovement(
      resolvedX, resolvedY, input.x, input.y,
      input.durationMs,
      ctx.tileSize, ctx.mapWidth, ctx.mapHeight,
      ctx.meadowDecorations, ctx.meadowStamps,
      ctx.speed, ctx.mobBlockers,
    );
    resolvedX = replayed.x;
    resolvedY = replayed.y;
  }

  applyReconciliation(character, resolvedX, resolvedY, ctx.tileSize, ctx.strongDesyncDistance);
}
