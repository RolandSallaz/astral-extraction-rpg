export type PoisonableEntity = {
  poisonTicksRemaining: number;
  poisonEndsAt: number;
};

export type PoisonEntry = {
  nextTickAt: number;
  damagePerTick: number;
};

export class PoisonService {
  private readonly entries = new Map<string, PoisonEntry>();

  start(
    entityId: string,
    entity: PoisonableEntity,
    totalTicks: number,
    tickMs: number,
    damagePerTick: number,
    now = Date.now(),
  ) {
    this.entries.set(entityId, {
      nextTickAt: now + tickMs,
      damagePerTick,
    });
    entity.poisonTicksRemaining = totalTicks;
    entity.poisonEndsAt = now + totalTicks * tickMs;
  }

  update<TEntity extends PoisonableEntity & { dead?: boolean; health: number }>(options: {
    now: number;
    tickMs: number;
    getEntity: (id: string) => TEntity | undefined;
    onTick: (entityId: string, entity: TEntity, damage: number) => void;
    onExpire?: (entityId: string) => void;
  }) {
    const { now, tickMs, getEntity, onTick, onExpire } = options;

    for (const [entityId, entry] of this.entries.entries()) {
      const entity = getEntity(entityId);
      if (!entity || entity.dead) {
        this.entries.delete(entityId);
        if (entity) {
          entity.poisonTicksRemaining = 0;
          entity.poisonEndsAt = 0;
        }
        onExpire?.(entityId);
        continue;
      }

      if (entry.nextTickAt > now) {
        continue;
      }

      onTick(entityId, entity, entry.damagePerTick);
      entity.poisonTicksRemaining = Math.max(0, entity.poisonTicksRemaining - 1);

      if (entity.health <= 0 || entity.poisonTicksRemaining <= 0) {
        this.entries.delete(entityId);
        entity.poisonTicksRemaining = 0;
        entity.poisonEndsAt = 0;
        onExpire?.(entityId);
        continue;
      }

      entity.poisonEndsAt = now + entity.poisonTicksRemaining * tickMs;
      entry.nextTickAt = now + tickMs;
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
