import { type Client } from "colyseus";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { type MapSchema } from "@colyseus/schema";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { ArmorGemCarrier } from "../armorGems.js";
import { HEALING_POTION_ID, TELEPORT_SCROLL_ID } from "../roomItems.js";
import { consumeSupportedRoomConsumable } from "./inventoryRuntime.js";
import type { StatusEffectSystem } from "../systems/StatusEffectSystem.js";
import type { SkillCastSystem } from "../systems/SkillCastSystem.js";

export interface ConsumableRuntimeContext {
  profile: RoomGameplayProfile;
  consumableCooldownEndsAt: Map<string, number>;
  statusEffects: StatusEffectSystem;
  skillCastSystem: SkillCastSystem;
  roomPlayers: MapSchema<BasePlayerState>;
  clients: readonly Client[];
  getMapWidthPx(): number;
  getMapHeightPx(): number;
  clearPlayerMovement(sessionId: string): void;
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

  if (parsed.code === HEALING_POTION_ID) {
    const activeCooldownEndsAt = ctx.consumableCooldownEndsAt.get(sessionId) ?? 0;
    if (activeCooldownEndsAt > now) {
      return;
    }
  }

  sourceSlots[slotIndex] = consumedEntry.nextValue;
  commitSlots(sourceSlots);

  if (parsed.code === HEALING_POTION_ID) {
    const nextCooldownEndsAt = now + p.healingPotionCooldownMs;
    ctx.consumableCooldownEndsAt.set(sessionId, nextCooldownEndsAt);
    if (mode === "throw") {
      applyThrownHealingPotion(ctx, player, options.targetX, options.targetY, now);
    } else {
      applyHealingPotionToPlayer(ctx, sessionId, player, now);
    }

    const client = ctx.clients.find((c) => c.sessionId === sessionId);
    client?.send("consumableCooldown", {
      itemId: HEALING_POTION_ID,
      cooldownEndsAt: nextCooldownEndsAt,
    });
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
  targetX: number | undefined,
  targetY: number | undefined,
  now: number,
): void {
  const tileSize = ctx.profile.tileSize;
  const landingX = Number.isFinite(targetX) ? Math.max(0, Math.min(ctx.getMapWidthPx(), targetX!)) : sourcePlayer.x;
  const landingY = Number.isFinite(targetY) ? Math.max(0, Math.min(ctx.getMapHeightPx(), targetY!)) : sourcePlayer.y;
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
