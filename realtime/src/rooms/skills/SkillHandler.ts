import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { ItemProgressionState } from "@mmorpg/shared";
import type { ProjectileGemConfig } from "../runtime/fireballGems.js";
import type { BurstSpawnRequest } from "../runtime/projectileSkills.js";

/**
 * Narrow interface that skill handlers receive instead of the entire room.
 * Keeps handlers decoupled from BaseGameRoom internals.
 */
export interface SkillCastContext {
  readonly sessionId: string;
  readonly player: BasePlayerState;
  readonly profile: RoomGameplayProfile;
  readonly now: number;
  readonly lagCompensatedAt: number;
  readonly lagCompensationEnabled: boolean;
  readonly weaponProgression: ItemProgressionState | null;

  getPlayerCastTimeMs(player: BasePlayerState): number;
  clampTargetToCastRange(
    player: BasePlayerState,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
  ): { x: number; y: number };
  clearPlayerMovement(sessionId: string): void;
  performWoodStaffStrike(player: BasePlayerState, targetX: number, targetY: number): void;
  performWoodStaffChainStrike(player: BasePlayerState, targetX: number, targetY: number): void;
  performWoodStaffDash(player: BasePlayerState, targetX: number, targetY: number): void;
  performWoodStaffSlam(player: BasePlayerState): void;

  // Fireball-specific helpers
  getOwnerProjectileGemConfig(ownerId: string, skillId: string): ProjectileGemConfig;
  hasSplitProjectileGem(ownerId: string): boolean;
  spawnProjectile(
    ownerId: string,
    skillId: string,
    x: number,
    y: number,
    directionX: number,
    directionY: number,
    lifetime: number,
    damageScale?: number,
    sizeScale?: number,
  ): void;
  queueBurstSpawns(bursts: BurstSpawnRequest[]): void;

  // FireField-specific helpers
  createFireField(player: BasePlayerState, targetX: number, targetY: number, now: number): void;
}

/**
 * Interface for a player skill handler.
 * Each skill (fireball, fireNova, fireField) implements this interface.
 */
export interface SkillHandler {
  readonly skillId: string;
  readonly needsTarget: boolean;

  /** Read the skill-specific cooldown timestamp from the player state. */
  getCooldownEndsAt(player: BasePlayerState): number;
  /** Write the skill-specific cooldown timestamp on the player state. */
  setCooldownEndsAt(player: BasePlayerState, value: number): void;
  /** Compute the cooldown duration for this skill. */
  getCooldownMs(ctx: SkillCastContext): number;
  /** Optional per-skill cast time override (defaults to room/player cast time). */
  getCastTimeMs?(ctx: SkillCastContext): number;

  /** Optional pre-cast validation (e.g. fireball needs non-zero distance). */
  canPerform?(ctx: SkillCastContext, targetX: number, targetY: number): boolean;

  /** Execute the cast. Returns post-cast lock duration in ms (0 = none). */
  performCast(ctx: SkillCastContext, targetX: number, targetY: number): number;
}
