import type { RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { DamageType, BurstSpawnRequest, PendingAftershock } from "../projectileSkills.js";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { MobState } from "../schema/MobState.js";

type ProjectileSystemContext = {
  getProfile: () => RoomGameplayProfile;
  getPlayer: (playerId: string) => BasePlayerState | undefined;
  getPlayers: () => Iterable<BasePlayerState>;
  getMobs: () => Iterable<MobState>;
  spawnProjectile: (
    ownerId: string,
    skillId: string,
    x: number,
    y: number,
    directionX: number,
    directionY: number,
    lifetime: number,
    damageScale?: number,
    sizeScale?: number,
  ) => void;
  updateProjectiles: (deltaSeconds: number, now: number) => void;
  applyDamageToPlayer: (player: BasePlayerState, amount: number, damageType: DamageType) => number;
  handlePlayerKilled: (player: BasePlayerState) => void;
  handleMobDeath: (mob: MobState) => void;
  awardExperience: (playerId: string, amount: number) => void;
};

export class ProjectileSystem {
  private readonly pendingBurstSpawns: BurstSpawnRequest[] = [];
  private readonly pendingAftershocks: PendingAftershock[] = [];

  constructor(private readonly context: ProjectileSystemContext) {}

  queueBurstSpawns(bursts: BurstSpawnRequest[]) {
    if (bursts.length === 0) {
      return;
    }
    this.pendingBurstSpawns.push(...bursts);
  }

  queueAftershock(aftershock: PendingAftershock) {
    this.pendingAftershocks.push(aftershock);
  }

  transferOwnerReferences(fromId: string, toId: string) {
    if (fromId === toId) {
      return;
    }

    for (const burst of this.pendingBurstSpawns) {
      if (burst.ownerId === fromId) {
        burst.ownerId = toId;
      }
    }

    for (const shock of this.pendingAftershocks) {
      if (shock.ownerId === fromId) {
        shock.ownerId = toId;
      }
    }
  }

  clearOwnerData(ownerId: string) {
    for (let index = this.pendingBurstSpawns.length - 1; index >= 0; index -= 1) {
      if (this.pendingBurstSpawns[index]?.ownerId === ownerId) {
        this.pendingBurstSpawns.splice(index, 1);
      }
    }
    for (let index = this.pendingAftershocks.length - 1; index >= 0; index -= 1) {
      if (this.pendingAftershocks[index]?.ownerId === ownerId) {
        this.pendingAftershocks.splice(index, 1);
      }
    }
  }

  clearAll() {
    this.pendingBurstSpawns.length = 0;
    this.pendingAftershocks.length = 0;
  }

  update(deltaSeconds: number, now: number) {
    this.updatePendingBurstSpawns(now);
    this.updatePendingAftershocks(now);
    this.context.updateProjectiles(deltaSeconds, now);
  }

  private updatePendingBurstSpawns(now: number) {
    const profile = this.context.getProfile();
    let i = 0;
    while (i < this.pendingBurstSpawns.length) {
      const burst = this.pendingBurstSpawns[i];
      if (burst.spawnAt > now) {
        i++;
        continue;
      }

      const player = this.context.getPlayer(burst.ownerId);
      if (!player || player.dead) {
        this.pendingBurstSpawns.splice(i, 1);
        continue;
      }

      this.context.spawnProjectile(
        burst.ownerId,
        "fireball",
        burst.x,
        burst.y,
        burst.directionX,
        burst.directionY,
        profile.fireballLifetime,
      );
      this.pendingBurstSpawns.splice(i, 1);
    }
  }

  private updatePendingAftershocks(now: number) {
    const profile = this.context.getProfile();
    const AFTERSHOCK_RADIUS = 48;
    let i = 0;
    while (i < this.pendingAftershocks.length) {
      const shock = this.pendingAftershocks[i];
      if (shock.triggerAt > now) {
        i++;
        continue;
      }

      const damage = Math.max(0, Math.round(profile.fireballBaseDamage * shock.damageScale));
      if (damage > 0) {
        for (const player of this.context.getPlayers()) {
          if (player.dead || player.id === shock.ownerId) {
            continue;
          }
          if (Math.hypot(player.x - shock.x, player.y - shock.y) > AFTERSHOCK_RADIUS) {
            continue;
          }
          this.context.applyDamageToPlayer(player, damage, "fire");
          if (player.health <= 0) {
            this.context.handlePlayerKilled(player);
          }
        }

        for (const mob of this.context.getMobs()) {
          if (mob.dead) {
            continue;
          }
          if (Math.hypot(mob.x - shock.x, mob.y - shock.y) > AFTERSHOCK_RADIUS) {
            continue;
          }
          mob.health = Math.max(0, mob.health - damage);
          if (mob.health <= 0) {
            this.context.handleMobDeath(mob);
            this.context.awardExperience(shock.ownerId, mob.experienceReward);
          }
        }
      }

      this.pendingAftershocks.splice(i, 1);
    }
  }
}
