'use client';

import type { EquipmentState } from '@mmorpg/shared/player/contracts';
import type { MouseActionSlotKey, MouseSkillBindings, SkillId } from '@/components/game-hud/types';
import type { CharacterVisual } from '@/components/game-canvas/gameCanvasVisualTypes';
import type { RealtimeRoom } from '@/components/game-canvas/networkTypes';
import type { CastHelpersConfig } from '@/components/game-canvas/castHelpers';
import {
  clampTargetToCastRange,
  getCharacterCastTimeMs,
  hasWoodStaffEquipped,
} from '@/components/game-canvas/castHelpers';
import {
  createTimedCastSkillMessage,
  readStoredMouseSkillBindings,
} from '@/components/game-canvas/mouseInput';
import { applyCastingToCharacterVisual } from '@/components/game-canvas/statusEffectHelpers';

const WOOD_STAFF_DASH_CAST_MS = 700;
const WOOD_STAFF_STRIKE_LOCK_MS = 180;

export type SkillCooldownState = {
  woodStaffStrike: number;
  woodStaffDash: number;
  fireball: number;
  fireNova: number;
  fireField: number;
};

export type CastContext = {
  room: RealtimeRoom | null;
  skillCooldowns: SkillCooldownState;
  localSessionId: string | null;
  characters: Map<string, CharacterVisual>;
  equipment: EquipmentState;
  estimatedOneWayLatencyMs: number;
  castHelpersConfig: CastHelpersConfig;
  onFireballCast?: ((target: { x: number; y: number }) => void) | null;
  mouseSkillBindings: MouseSkillBindings;
};

export function castFireball(ctx: CastContext, targetX: number, targetY: number): void {
  if (!ctx.room) return;
  const now = Date.now();
  if ((ctx.skillCooldowns.fireball ?? 0) > now) return;
  const localCharacter = ctx.localSessionId ? ctx.characters.get(ctx.localSessionId) : undefined;
  if (localCharacter && localCharacter.currentCastEndsAt > now) return;
  const resolvedTarget = localCharacter
    ? clampTargetToCastRange(
        ctx.equipment,
        localCharacter.container.x,
        localCharacter.container.y,
        targetX,
        targetY,
        ctx.castHelpersConfig,
      )
    : { x: targetX, y: targetY, clamped: false };
  const castSkillMessage = createTimedCastSkillMessage(
    { skillId: 'fireball', targetX: resolvedTarget.x, targetY: resolvedTarget.y },
    ctx.estimatedOneWayLatencyMs,
  );
  ctx.room.send('castSkill', castSkillMessage);
  if (localCharacter) {
    const castStartedAt = Date.now();
    const castTimeMs = getCharacterCastTimeMs(ctx.equipment, ctx.castHelpersConfig);
    if (castTimeMs > 0) {
      applyCastingToCharacterVisual(localCharacter, 'fireball', castStartedAt, castStartedAt + castTimeMs);
    }
  }
  ctx.onFireballCast?.({ x: resolvedTarget.x, y: resolvedTarget.y });
}

export function castFireNova(ctx: CastContext): void {
  if (!ctx.room) return;
  const now = Date.now();
  if ((ctx.skillCooldowns.fireNova ?? 0) > now) return;
  const localCharacter = ctx.localSessionId ? ctx.characters.get(ctx.localSessionId) : undefined;
  if (localCharacter && localCharacter.currentCastEndsAt > now) return;
  const castSkillMessage = createTimedCastSkillMessage({ skillId: 'fireNova' }, ctx.estimatedOneWayLatencyMs);
  ctx.room.send('castSkill', castSkillMessage);
}

export function castFireField(ctx: CastContext, targetX: number, targetY: number): void {
  if (!ctx.room) return;
  const now = Date.now();
  if ((ctx.skillCooldowns.fireField ?? 0) > now) return;
  const localCharacter = ctx.localSessionId ? ctx.characters.get(ctx.localSessionId) : undefined;
  if (localCharacter && localCharacter.currentCastEndsAt > now) return;
  const resolvedTarget = localCharacter
    ? clampTargetToCastRange(
        ctx.equipment,
        localCharacter.container.x,
        localCharacter.container.y,
        targetX,
        targetY,
        ctx.castHelpersConfig,
      )
    : { x: targetX, y: targetY, clamped: false };
  const castSkillMessage = createTimedCastSkillMessage(
    { skillId: 'fireField', targetX: resolvedTarget.x, targetY: resolvedTarget.y },
    ctx.estimatedOneWayLatencyMs,
  );
  ctx.room.send('castSkill', castSkillMessage);
}

export function castWoodStaffDash(ctx: CastContext, targetX: number, targetY: number): void {
  if (!ctx.room || !hasWoodStaffEquipped(ctx.equipment, ctx.castHelpersConfig)) return;
  const localCharacter = ctx.localSessionId ? ctx.characters.get(ctx.localSessionId) : undefined;
  const now = Date.now();
  if ((ctx.skillCooldowns.woodStaffDash ?? 0) > now) return;
  if (localCharacter && localCharacter.currentCastEndsAt > now) return;
  const castSkillMessage = createTimedCastSkillMessage(
    { skillId: 'woodStaffDash', targetX, targetY },
    ctx.estimatedOneWayLatencyMs,
  );
  ctx.room.send('castSkill', castSkillMessage);
  if (localCharacter) {
    const castStartedAt = Date.now();
    applyCastingToCharacterVisual(localCharacter, 'woodStaffDash', castStartedAt, castStartedAt + WOOD_STAFF_DASH_CAST_MS);
  }
}

export function castWoodStaffStrike(ctx: CastContext, targetX: number, targetY: number): void {
  if (!ctx.room || !hasWoodStaffEquipped(ctx.equipment, ctx.castHelpersConfig)) return;
  const localCharacter = ctx.localSessionId ? ctx.characters.get(ctx.localSessionId) : undefined;
  const now = Date.now();
  if ((ctx.skillCooldowns.woodStaffStrike ?? 0) > now) return;
  if (localCharacter && localCharacter.currentCastEndsAt > now) return;
  const castSkillMessage = createTimedCastSkillMessage(
    { skillId: 'woodStaffStrike', targetX, targetY },
    ctx.estimatedOneWayLatencyMs,
  );
  ctx.room.send('castSkill', castSkillMessage);
  if (localCharacter) {
    const castStartedAt = Date.now();
    applyCastingToCharacterVisual(localCharacter, 'woodStaffStrike', castStartedAt, castStartedAt + WOOD_STAFF_STRIKE_LOCK_MS);
  }
}

export function castMouseBoundSkill(ctx: CastContext, skillId: SkillId, targetX: number, targetY: number): void {
  if (skillId === 'woodStaffStrike') { castWoodStaffStrike(ctx, targetX, targetY); return; }
  if (skillId === 'woodStaffDash') { castWoodStaffDash(ctx, targetX, targetY); return; }
  if (skillId === 'fireball') { castFireball(ctx, targetX, targetY); return; }
  if (skillId === 'fireField') { castFireField(ctx, targetX, targetY); return; }
  castFireNova(ctx);
}

export function getMouseBoundSkill(ctx: CastContext, slotKey: MouseActionSlotKey): SkillId | null {
  const stored = readStoredMouseSkillBindings();
  return slotKey === 'LMB'
    ? ctx.mouseSkillBindings.LMB ?? stored.LMB
    : ctx.mouseSkillBindings.RMB ?? stored.RMB;
}
