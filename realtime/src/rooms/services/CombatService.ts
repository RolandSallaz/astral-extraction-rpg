/**
 * Pure combat calculations extracted from MyRoom / RaidRoom.
 * These functions are stateless — they accept entity data and
 * return results without mutating shared room state.
 */

import { type DamageType } from "../projectileSkills.js";
import {
  getSharedDamageTakenMultiplier,
  applyHealingMultiplier,
} from "../projectileSkills.js";
import { type ArmorGemCarrier } from "../armorGems.js";

export type DamageablePlayer = ArmorGemCarrier & {
  id: string;
  health: number;
  maxHealth: number;
  dead: boolean;
  bodyItem?: string;
  burnTicksRemaining: number;
  burnEndsAt: number;
  healingTicksRemaining: number;
  healingEndsAt: number;
};

/**
 * Apply damage to a player, accounting for armour gems and fire
 * resistance.  Mutates the player's health directly.
 *
 * @returns The effective damage dealt after multipliers.
 */
export function applyDamageToPlayer(
  player: DamageablePlayer,
  amount: number,
  damageType: DamageType,
  itemFireResistance: Map<string, number>,
  options?: { minimumHealth?: number },
) {
  const multiplier = getSharedDamageTakenMultiplier(
    player,
    damageType,
    itemFireResistance,
  );
  const resolvedDamage = Math.max(0, Math.round(amount * multiplier));
  const minimumHealth = options?.minimumHealth ?? 0;
  const previousHealth = player.health;
  player.health = Math.max(minimumHealth, player.health - resolvedDamage);
  return Math.max(0, previousHealth - player.health);
}

/**
 * Mark a player as dead and reset their transient combat state.
 */
export function killPlayer(
  player: DamageablePlayer & {
    moveX?: number;
    moveY?: number;
  },
) {
  player.dead = true;
  if ("moveX" in player) player.moveX = 0;
  if ("moveY" in player) player.moveY = 0;
  player.burnTicksRemaining = 0;
  player.burnEndsAt = 0;
  player.healingTicksRemaining = 0;
  player.healingEndsAt = 0;
}

/**
 * Apply lifesteal healing to the projectile owner.
 */
export function applyLifesteal(
  owner: DamageablePlayer | undefined,
  resolvedDamage: number,
  lifestealRatio: number,
) {
  if (!owner || owner.dead || lifestealRatio <= 0 || resolvedDamage <= 0) {
    return 0;
  }

  const healAmount = applyHealingMultiplier(
    resolvedDamage * lifestealRatio,
    owner,
  );
  owner.health = Math.min(owner.maxHealth, owner.health + healAmount);
  return healAmount;
}
