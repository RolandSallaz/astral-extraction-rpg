/**
 * Manages burn (damage-over-time) state for players and mobs.
 *
 * Extracted from MyRoom / RaidRoom to eliminate the duplicated
 * updateBurningTargets / updateBurningMobs loops.
 */

import { applyBurnState, type BurnableEntity } from "../runtime/sharedGameplay.js";

export type BurnSourceKey = string; // e.g. "fireball" | "fireField"

export type BurnEntry = {
  nextTickAt: number;
  sourceSkill: BurnSourceKey;
};

/**
 * Stateful service that tracks all active burn effects and ticks
 * them each frame.
 */
export class BurnService {
  private readonly entries = new Map<string, BurnEntry>();

  applyBurn(
    entityId: string,
    entity: BurnableEntity,
    sourceSkill: BurnSourceKey,
    burnTicks: number,
    burnTickMs: number,
    durationMultiplier = 1,
  ) {
    const nextTickAt = applyBurnState(
      entity,
      burnTicks,
      burnTickMs,
      durationMultiplier,
    );
    this.entries.set(entityId, { nextTickAt, sourceSkill });
  }

  /**
   * Tick all burn entries.  Calls `onTick` for each entity that
   * should take burn damage this frame, and `onExpire` when
   * the burn wears off or the entity is dead/missing.
   */
  update(options: {
    now: number;
    burnTickMs: number;
    getEntity: (id: string) => (BurnableEntity & { dead?: boolean; health: number }) | undefined;
    getBurnDamage: (sourceSkill: BurnSourceKey) => number;
    onTick: (entityId: string, entity: BurnableEntity & { health: number }, damage: number) => void;
    onExpire: (entityId: string) => void;
  }) {
    const { now, burnTickMs, getEntity, getBurnDamage, onTick, onExpire } = options;

    for (const [entityId, entry] of this.entries.entries()) {
      const entity = getEntity(entityId);
      if (!entity || entity.dead) {
        this.entries.delete(entityId);
        if (entity) {
          entity.burnTicksRemaining = 0;
          entity.burnEndsAt = 0;
        }
        onExpire(entityId);
        continue;
      }

      if (entry.nextTickAt > now) {
        continue;
      }

      const damage = getBurnDamage(entry.sourceSkill);
      onTick(entityId, entity, damage);

      entity.burnTicksRemaining = Math.max(0, entity.burnTicksRemaining - 1);

      if (entity.health <= 0 || entity.burnTicksRemaining <= 0) {
        this.entries.delete(entityId);
        entity.burnTicksRemaining = 0;
        entity.burnEndsAt = 0;
        onExpire(entityId);
        continue;
      }

      entity.burnEndsAt = now + entity.burnTicksRemaining * burnTickMs;
      entry.nextTickAt = now + burnTickMs;
    }
  }

  delete(entityId: string) {
    this.entries.delete(entityId);
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
