import { type Client } from "colyseus";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { type MapSchema } from "@colyseus/schema";
import type { ThrownConsumableMessage } from "@mmorpg/shared/realtime/contracts";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";
import type { ArmorGemCarrier } from "./armorGems.js";
import {
  HEALING_POTION_ID,
  POISON_POTION_ID,
  SLOW_POTION_ID,
  ANTIDOTE_ID,
  SPEED_POTION_ID,
  FIRE_RESISTANCE_POTION_ID,
  TELEPORT_SCROLL_ID,
} from "../roomItems.js";
import { consumeSupportedRoomConsumable } from "./inventoryRuntime.js";
import type { StatusEffectSystem } from "../systems/StatusEffectSystem.js";
import type { SkillCastSystem } from "../systems/SkillCastSystem.js";

const THROWN_CONSUMABLE_MIN_DURATION_MS = 180;
const THROWN_CONSUMABLE_MAX_DURATION_MS = 360;
const THROWN_CONSUMABLE_DURATION_PER_PIXEL = 1.1;

export interface ConsumableRuntimeContext {
  profile: RoomGameplayProfile;
  consumableCooldownEndsAt: Map<string, Map<string, number>>;
  statusEffects: StatusEffectSystem;
  skillCastSystem: SkillCastSystem;
  roomPlayers: MapSchema<BasePlayerState>;
  roomMobs: MapSchema<MobState>;
  clients: readonly Client[];
  getMapWidthPx(): number;
  getMapHeightPx(): number;
  clearPlayerMovement(sessionId: string): void;
  broadcastThrownConsumable(payload: ThrownConsumableMessage): void;
}

export function handleUseConsumable(
  ctx: ConsumableRuntimeContext,
  sessionId: string,
  player: BasePlayerState,
  sourceSlots: string[],
  slotIndex: number,
  commitSlots: (nextSlots: string[]) => void,
  options: { mode?: "self" | "throw"; targetX?: number; targetY?: number } = {},
): void {
  const consumedEntry = consumeSupportedRoomConsumable(sourceSlots[slotIndex]);
  const parsed = consumedEntry?.parsed;
  if (!consumedEntry || !parsed) {
    return;
  }
  if (parsed.raidUnidentified) {
    return;
  }

  const now = Date.now();
  const p = ctx.profile;
  const mode = options.mode === "throw" ? "throw" : "self";

  const cooldownMs = getConsumableCooldownMs(parsed.code, p);
  if (cooldownMs > 0) {
    const playerCooldowns = ctx.consumableCooldownEndsAt.get(sessionId);
    const activeCooldownEndsAt = playerCooldowns?.get(parsed.code) ?? 0;
    if (activeCooldownEndsAt > now) {
      return;
    }
  }

  if ((parsed.code === POISON_POTION_ID || parsed.code === SLOW_POTION_ID) && mode !== "throw") {
    return;
  }

  sourceSlots[slotIndex] = consumedEntry.nextValue;
  commitSlots(sourceSlots);

  if (parsed.code === HEALING_POTION_ID) {
    const nextCooldownEndsAt = now + p.healingPotionCooldownMs;
    setPlayerCooldown(ctx.consumableCooldownEndsAt, sessionId, HEALING_POTION_ID, nextCooldownEndsAt);
    if (mode === "throw") {
      const landing = resolveThrownConsumableLanding(ctx, player, options.targetX, options.targetY);
      ctx.broadcastThrownConsumable({
        itemId: HEALING_POTION_ID,
        sourcePlayerId: player.id,
        startX: player.x,
        startY: player.y - ctx.profile.playerHitRadius - ctx.profile.tileSize * 0.2,
        targetX: landing.x,
        targetY: landing.y,
        durationMs: resolveThrownConsumableDurationMs(player.x, player.y, landing.x, landing.y),
      });
      applyThrownHealingPotion(ctx, player, landing.x, landing.y, now);
    } else {
      applyHealingPotionToPlayer(ctx, sessionId, player, now);
    }
    sendCooldown(ctx, sessionId, HEALING_POTION_ID, nextCooldownEndsAt);
    return;
  }

  if (parsed.code === POISON_POTION_ID) {
    const nextCooldownEndsAt = now + p.poisonPotionCooldownMs;
    setPlayerCooldown(ctx.consumableCooldownEndsAt, sessionId, POISON_POTION_ID, nextCooldownEndsAt);
    const landing = resolveThrownConsumableLanding(ctx, player, options.targetX, options.targetY);
    ctx.broadcastThrownConsumable({
      itemId: POISON_POTION_ID,
      sourcePlayerId: player.id,
      startX: player.x,
      startY: player.y - ctx.profile.playerHitRadius - ctx.profile.tileSize * 0.2,
      targetX: landing.x,
      targetY: landing.y,
      durationMs: resolveThrownConsumableDurationMs(player.x, player.y, landing.x, landing.y),
    });
    applyThrownPoisonPotion(ctx, player, landing.x, landing.y, now);
    sendCooldown(ctx, sessionId, POISON_POTION_ID, nextCooldownEndsAt);
    return;
  }

  if (parsed.code === SLOW_POTION_ID) {
    const nextCooldownEndsAt = now + p.slowPotionCooldownMs;
    setPlayerCooldown(ctx.consumableCooldownEndsAt, sessionId, SLOW_POTION_ID, nextCooldownEndsAt);
    const landing = resolveThrownConsumableLanding(ctx, player, options.targetX, options.targetY);
    ctx.broadcastThrownConsumable({
      itemId: SLOW_POTION_ID,
      sourcePlayerId: player.id,
      startX: player.x,
      startY: player.y - ctx.profile.playerHitRadius - ctx.profile.tileSize * 0.2,
      targetX: landing.x,
      targetY: landing.y,
      durationMs: resolveThrownConsumableDurationMs(player.x, player.y, landing.x, landing.y),
    });
    applyThrownSlowPotion(ctx, player, landing.x, landing.y, now);
    sendCooldown(ctx, sessionId, SLOW_POTION_ID, nextCooldownEndsAt);
    return;
  }

  if (parsed.code === ANTIDOTE_ID) {
    const nextCooldownEndsAt = now + p.antidoteCooldownMs;
    setPlayerCooldown(ctx.consumableCooldownEndsAt, sessionId, ANTIDOTE_ID, nextCooldownEndsAt);
    ctx.statusEffects.clearPlayerPoison(sessionId);
    sendCooldown(ctx, sessionId, ANTIDOTE_ID, nextCooldownEndsAt);
    return;
  }

  if (parsed.code === SPEED_POTION_ID) {
    const nextCooldownEndsAt = now + p.speedPotionCooldownMs;
    setPlayerCooldown(ctx.consumableCooldownEndsAt, sessionId, SPEED_POTION_ID, nextCooldownEndsAt);
    player.speedBuffEndsAt = now + p.speedPotionDurationMs;
    sendCooldown(ctx, sessionId, SPEED_POTION_ID, nextCooldownEndsAt);
    return;
  }

  if (parsed.code === FIRE_RESISTANCE_POTION_ID) {
    const nextCooldownEndsAt = now + p.fireResistancePotionCooldownMs;
    setPlayerCooldown(ctx.consumableCooldownEndsAt, sessionId, FIRE_RESISTANCE_POTION_ID, nextCooldownEndsAt);
    player.fireResistanceBuffEndsAt = now + p.fireResistancePotionDurationMs;
    sendCooldown(ctx, sessionId, FIRE_RESISTANCE_POTION_ID, nextCooldownEndsAt);
    return;
  }

  // Teleport scroll
  ctx.clearPlayerMovement(sessionId);
  player.castingSkillId = TELEPORT_SCROLL_ID;
  player.castStartedAt = now;
  player.castEndsAt = now + p.teleportScrollCastMs;
  ctx.skillCastSystem.queueTeleportScroll(sessionId);
}

function applyHealingPotionToPlayer(
  ctx: ConsumableRuntimeContext,
  sessionId: string,
  player: BasePlayerState,
  now: number,
): void {
  const p = ctx.profile;
  const healingTicks = p.healingPotionDurationMs / p.healingPotionTickMs;
  ctx.statusEffects.startHealing(
    sessionId,
    healingTicks,
    p.healingPotionTickMs,
    p.healingPotionDurationMs,
    player as BasePlayerState & ArmorGemCarrier & { healingTicksRemaining: number; healingEndsAt: number },
    now,
  );
}

function applyThrownHealingPotion(
  ctx: ConsumableRuntimeContext,
  sourcePlayer: BasePlayerState,
  landingX: number,
  landingY: number,
  now: number,
): void {
  const tileSize = ctx.profile.tileSize;
  const centerTileX = Math.floor(landingX / tileSize);
  const centerTileY = Math.floor(landingY / tileSize);

  for (const player of ctx.roomPlayers.values()) {
    if (player.dead) {
      continue;
    }
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor(player.y / tileSize);
    if (Math.abs(playerTileX - centerTileX) > 1 || Math.abs(playerTileY - centerTileY) > 1) {
      continue;
    }
    applyHealingPotionToPlayer(ctx, player.id, player, now);
  }
}

function applyThrownPoisonPotion(
  ctx: ConsumableRuntimeContext,
  sourcePlayer: BasePlayerState,
  landingX: number,
  landingY: number,
  now: number,
): void {
  const tileSize = ctx.profile.tileSize;
  const centerTileX = Math.floor(landingX / tileSize);
  const centerTileY = Math.floor(landingY / tileSize);
  const poisonTicks = Math.max(1, Math.floor(ctx.profile.poisonPotionDurationMs / ctx.profile.poisonPotionTickMs));
  const poisonDamagePerTick = Math.max(1, Math.round(ctx.profile.poisonPotionTotalDamage / poisonTicks));

  for (const player of ctx.roomPlayers.values()) {
    if (player.dead || player.id === sourcePlayer.id) {
      continue;
    }
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor(player.y / tileSize);
    if (Math.abs(playerTileX - centerTileX) > 1 || Math.abs(playerTileY - centerTileY) > 1) {
      continue;
    }
    ctx.statusEffects.startPlayerPoison(player.id, poisonTicks, ctx.profile.poisonPotionTickMs, poisonDamagePerTick, player, now);
  }

  for (const mob of ctx.roomMobs.values()) {
    if (mob.dead) {
      continue;
    }
    const mobTileX = Math.floor(mob.x / tileSize);
    const mobTileY = Math.floor(mob.y / tileSize);
    if (Math.abs(mobTileX - centerTileX) > 1 || Math.abs(mobTileY - centerTileY) > 1) {
      continue;
    }
    ctx.statusEffects.startMobPoison(mob.id, poisonTicks, ctx.profile.poisonPotionTickMs, poisonDamagePerTick, mob, now);
  }
}

function resolveThrownConsumableLanding(
  ctx: Pick<ConsumableRuntimeContext, "getMapWidthPx" | "getMapHeightPx">,
  sourcePlayer: BasePlayerState,
  targetX: number | undefined,
  targetY: number | undefined,
) {
  return {
    x: Number.isFinite(targetX) ? Math.max(0, Math.min(ctx.getMapWidthPx(), targetX!)) : sourcePlayer.x,
    y: Number.isFinite(targetY) ? Math.max(0, Math.min(ctx.getMapHeightPx(), targetY!)) : sourcePlayer.y,
  };
}

function applyThrownSlowPotion(
  ctx: ConsumableRuntimeContext,
  sourcePlayer: BasePlayerState,
  landingX: number,
  landingY: number,
  now: number,
): void {
  const tileSize = ctx.profile.tileSize;
  const centerTileX = Math.floor(landingX / tileSize);
  const centerTileY = Math.floor(landingY / tileSize);
  const slowEndsAt = now + ctx.profile.slowPotionDurationMs;

  for (const player of ctx.roomPlayers.values()) {
    if (player.dead || player.id === sourcePlayer.id) {
      continue;
    }
    const playerTileX = Math.floor(player.x / tileSize);
    const playerTileY = Math.floor(player.y / tileSize);
    if (Math.abs(playerTileX - centerTileX) > 1 || Math.abs(playerTileY - centerTileY) > 1) {
      continue;
    }
    player.slowEndsAt = slowEndsAt;
  }

  for (const mob of ctx.roomMobs.values()) {
    if (mob.dead) {
      continue;
    }
    const mobTileX = Math.floor(mob.x / tileSize);
    const mobTileY = Math.floor(mob.y / tileSize);
    if (Math.abs(mobTileX - centerTileX) > 1 || Math.abs(mobTileY - centerTileY) > 1) {
      continue;
    }
    mob.slowEndsAt = slowEndsAt;
  }
}

function sendCooldown(
  ctx: ConsumableRuntimeContext,
  sessionId: string,
  itemId: string,
  cooldownEndsAt: number,
): void {
  const client = ctx.clients.find((c) => c.sessionId === sessionId);
  client?.send("consumableCooldown", { itemId, cooldownEndsAt });
}

function getConsumableCooldownMs(code: string, p: RoomGameplayProfile): number {
  switch (code) {
    case HEALING_POTION_ID: return p.healingPotionCooldownMs;
    case POISON_POTION_ID: return p.poisonPotionCooldownMs;
    case SLOW_POTION_ID: return p.slowPotionCooldownMs;
    case ANTIDOTE_ID: return p.antidoteCooldownMs;
    case SPEED_POTION_ID: return p.speedPotionCooldownMs;
    case FIRE_RESISTANCE_POTION_ID: return p.fireResistancePotionCooldownMs;
    default: return 0;
  }
}

function setPlayerCooldown(
  map: Map<string, Map<string, number>>,
  sessionId: string,
  itemId: string,
  endsAt: number,
) {
  let inner = map.get(sessionId);
  if (!inner) {
    inner = new Map();
    map.set(sessionId, inner);
  }
  inner.set(itemId, endsAt);
}

function resolveThrownConsumableDurationMs(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
) {
  const distance = Math.hypot(targetX - startX, targetY - startY);
  return Math.round(
    Math.max(
      THROWN_CONSUMABLE_MIN_DURATION_MS,
      Math.min(
        THROWN_CONSUMABLE_MAX_DURATION_MS,
        THROWN_CONSUMABLE_MIN_DURATION_MS + distance * THROWN_CONSUMABLE_DURATION_PER_PIXEL,
      ),
    ),
  );
}
