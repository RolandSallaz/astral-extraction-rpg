export type StatusEffectSystemHandlers = {
  updateBurningTargets: (now: number) => void;
  updateHealingTargets: (now: number) => void;
  updateGroundEffects: (now: number) => void;
  updateBurningMobs?: (now: number) => void;
};

export class StatusEffectSystem {
  constructor(private readonly handlers: StatusEffectSystemHandlers) {}

  update(now: number) {
    this.handlers.updateBurningTargets(now);
    this.handlers.updateHealingTargets(now);
    this.handlers.updateGroundEffects(now);
    this.handlers.updateBurningMobs?.(now);
  }
}
