import { ProjectileSystem, type ProjectileSystemHandlers } from "./ProjectileSystem.js";
import { StatusEffectSystem, type StatusEffectSystemHandlers } from "./StatusEffectSystem.js";

export type SharedCombatTickHandlers = ProjectileSystemHandlers & StatusEffectSystemHandlers & {
  updatePendingCasts: (now: number) => void;
};

export class SharedCombatTickSystem {
  private readonly projectileSystem: ProjectileSystem;
  private readonly statusEffectSystem: StatusEffectSystem;

  constructor(
    private readonly handlers: SharedCombatTickHandlers,
  ) {
    this.projectileSystem = new ProjectileSystem(handlers);
    this.statusEffectSystem = new StatusEffectSystem(handlers);
  }

  update(deltaSeconds: number, now: number) {
    this.handlers.updatePendingCasts(now);
    this.statusEffectSystem.update(now);
    this.projectileSystem.update(deltaSeconds, now);
  }
}
