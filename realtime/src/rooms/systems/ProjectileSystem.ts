export type ProjectileSystemHandlers = {
  updatePendingBurstSpawns: (now: number) => void;
  updatePendingAftershocks: (now: number) => void;
  updateProjectiles: (deltaSeconds: number, now: number) => void;
};

export class ProjectileSystem {
  constructor(private readonly handlers: ProjectileSystemHandlers) {}

  update(deltaSeconds: number, now: number) {
    this.handlers.updatePendingBurstSpawns(now);
    this.handlers.updatePendingAftershocks(now);
    this.handlers.updateProjectiles(deltaSeconds, now);
  }
}
