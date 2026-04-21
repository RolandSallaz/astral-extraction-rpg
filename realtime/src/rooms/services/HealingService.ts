/**
 * Manages healing-over-time state for players.
 *
 * Extracted from MyRoom / RaidRoom to eliminate the duplicated
 * updateHealingTargets loops.
 */

import { applyHealingMultiplier } from "../runtime/projectileSkills.js";
import { type ArmorGemCarrier } from "../runtime/armorGems.js";

export type HealablePlayer = ArmorGemCarrier & {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  dead: boolean;
  healingTicksRemaining: number;
  healingEndsAt: number;
};

type HealEntry = {
  nextTickAt: number;
  ticksRemaining: number;
};

export class HealingService {
  private readonly entries = new Map<string, HealEntry>();

  start(
    playerId: string,
    totalTicks: number,
    tickMs: number,
    durationMs: number,
    player: HealablePlayer,
    now = Date.now(),
  ) {
    this.entries.set(playerId, {
      nextTickAt: now + tickMs,
      ticksRemaining: totalTicks,
    });
    player.healingTicksRemaining = totalTicks;
    player.healingEndsAt = now + durationMs;
  }

  update(options: {
    now: number;
    tickMs: number;
    healPerTick: number;
    getPlayer: (id: string) => HealablePlayer | undefined;
    onHeal?: (playerId: string, player: HealablePlayer, amount: number) => void;
  }) {
    const { now, tickMs, healPerTick, getPlayer, onHeal } = options;

    for (const [playerId, entry] of this.entries.entries()) {
      const player = getPlayer(playerId);

      if (!player || player.dead || entry.ticksRemaining <= 0) {
        this.entries.delete(playerId);
        if (player) {
          player.healingTicksRemaining = 0;
          player.healingEndsAt = 0;
        }
        continue;
      }

      if (entry.nextTickAt > now) {
        continue;
      }

      const previousHealth = player.health;
      const healedAmount = applyHealingMultiplier(healPerTick, player);
      player.health = Math.min(player.maxHealth, player.health + healedAmount);
      const restoredHealth = Math.max(0, player.health - previousHealth);
      if (restoredHealth > 0) {
        onHeal?.(playerId, player, restoredHealth);
      }
      entry.ticksRemaining -= 1;

      if (entry.ticksRemaining <= 0) {
        this.entries.delete(playerId);
        player.healingTicksRemaining = 0;
        player.healingEndsAt = 0;
        continue;
      }

      player.healingTicksRemaining = entry.ticksRemaining;
      player.healingEndsAt = now + entry.ticksRemaining * tickMs;
      entry.nextTickAt = now + tickMs;
    }
  }

  delete(playerId: string) {
    this.entries.delete(playerId);
  }

  move(fromId: string, toId: string) {
    if (fromId === toId) {
      return;
    }

    const entry = this.entries.get(fromId);
    if (!entry) {
      return;
    }

    this.entries.delete(fromId);
    this.entries.set(toId, entry);
  }

  clear() {
    this.entries.clear();
  }
}
