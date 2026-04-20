import type { MapSchema } from "@colyseus/schema";
import type { SkillBalanceConfig } from "@mmorpg/shared";
import type { RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import type { DamageType } from "../runtime/projectileSkills.js";
import { BurnService } from "../services/BurnService.js";
import { HealingService, type HealablePlayer } from "../services/HealingService.js";
import { PoisonService, type PoisonableEntity } from "../services/PoisonService.js";
import { setMobAggroTarget } from "../runtime/mobAi.js";
import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { GroundEffectState } from "../schema/GroundEffectState.js";
import type { MobState } from "../schema/MobState.js";
import { applyRoomBurnToEntity, updateRoomBurningEntities, updateRoomHealingTargets } from "../runtime/statusRuntime.js";

type PoisonablePlayer = BasePlayerState & PoisonableEntity;
type PoisonableMob = MobState & PoisonableEntity;

type StatusEffectContext = {
  getProfile: () => RoomGameplayProfile;
  getSkillBalance: () => SkillBalanceConfig;
  getPlayer: (playerId: string) => BasePlayerState | undefined;
  getMob: (mobId: string) => MobState | undefined;
  getPlayers: () => Iterable<BasePlayerState>;
  getMobs: () => Iterable<MobState>;
  getGroundEffects: () => MapSchema<GroundEffectState>;
  applyDamageToPlayer: (player: BasePlayerState, amount: number, damageType: DamageType) => number;
  handlePlayerKilled: (player: BasePlayerState) => void;
  handleMobDeath: (mob: MobState) => void;
  onCombatLog: (text: string) => void;
  showHealingText: (x: number, y: number, amount: number) => void;
  awardExperience: (playerId: string, amount: number) => void;
  getOwnerProjectileGemConfig: (ownerId: string) => { durationMultiplier: number };
};

export class StatusEffectSystem {
  private readonly playerBurns = new BurnService();
  private readonly mobBurns = new BurnService();
  private readonly playerPoisons = new PoisonService();
  private readonly mobPoisons = new PoisonService();
  private readonly playerHealing = new HealingService();

  constructor(private readonly context: StatusEffectContext) {}

  update(now: number, options: { includeMobBurns?: boolean } = {}) {
    this.updateBurningPlayers(now);
    this.updatePoisonedPlayers(now);
    if (options.includeMobBurns) {
      this.updateBurningMobs(now);
      this.updatePoisonedMobs(now);
    }
    this.updateHealingPlayers(now);
    this.updateGroundEffects(now);
  }

  startHealing(
    playerId: string,
    totalTicks: number,
    tickMs: number,
    durationMs: number,
    player: HealablePlayer,
    now = Date.now(),
  ) {
    this.playerHealing.start(playerId, totalTicks, tickMs, durationMs, player, now);
  }

  startPlayerPoison(
    playerId: string,
    totalTicks: number,
    tickMs: number,
    damagePerTick: number,
    player: PoisonablePlayer,
    now = Date.now(),
  ) {
    this.playerPoisons.start(playerId, player, totalTicks, tickMs, damagePerTick, now);
  }

  startMobPoison(
    mobId: string,
    totalTicks: number,
    tickMs: number,
    damagePerTick: number,
    mob: PoisonableMob,
    now = Date.now(),
  ) {
    this.mobPoisons.start(mobId, mob, totalTicks, tickMs, damagePerTick, now);
  }

  applyBurnToPlayer(player: BasePlayerState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string) {
    applyRoomBurnToEntity({
      service: this.playerBurns,
      entityId: player.id,
      entity: player,
      sourceSkill,
      ownerId,
      skillBalance: this.context.getSkillBalance(),
      burnTickMs: this.context.getProfile().fireballBurnTickMs,
      getDurationMultiplier: (nextOwnerId) => this.context.getOwnerProjectileGemConfig(nextOwnerId).durationMultiplier,
    });
  }

  applyBurnToMob(mob: MobState, sourceSkill: keyof SkillBalanceConfig, ownerId?: string) {
    applyRoomBurnToEntity({
      service: this.mobBurns,
      entityId: mob.id,
      entity: mob,
      sourceSkill,
      ownerId,
      skillBalance: this.context.getSkillBalance(),
      burnTickMs: this.context.getProfile().fireballBurnTickMs,
      getDurationMultiplier: (nextOwnerId) => this.context.getOwnerProjectileGemConfig(nextOwnerId).durationMultiplier,
    });
  }

  clearPlayerPoison(playerId: string) {
    this.playerPoisons.delete(playerId);
    const player = this.context.getPlayer(playerId);
    if (player) {
      (player as PoisonablePlayer).poisonTicksRemaining = 0;
      (player as PoisonablePlayer).poisonEndsAt = 0;
    }
  }

  deletePlayerEffects(playerId: string) {
    this.playerBurns.delete(playerId);
    this.playerPoisons.delete(playerId);
    this.playerHealing.delete(playerId);
  }

  deleteMobBurn(mobId: string) {
    this.mobBurns.delete(mobId);
    this.mobPoisons.delete(mobId);
  }

  movePlayerEffects(fromId: string, toId: string) {
    this.playerBurns.move(fromId, toId);
    this.playerPoisons.move(fromId, toId);
    this.playerHealing.move(fromId, toId);
  }

  clearAll() {
    this.playerBurns.clear();
    this.mobBurns.clear();
    this.playerPoisons.clear();
    this.mobPoisons.clear();
    this.playerHealing.clear();
  }

  private updateBurningPlayers(now: number) {
    updateRoomBurningEntities({
      service: this.playerBurns,
      now,
      burnTickMs: this.context.getProfile().fireballBurnTickMs,
      skillBalance: this.context.getSkillBalance(),
      getEntity: (playerId) => this.context.getPlayer(playerId),
      onTick: (_playerId, player, damage) => {
        const resolvedDamage = this.context.applyDamageToPlayer(player, damage, "fire");
        this.context.onCombatLog(`${player.name} burns for ${resolvedDamage}.`);
        if (player.health <= 0) {
          this.context.handlePlayerKilled(player);
        }
      },
    });
  }

  private updateBurningMobs(now: number) {
    updateRoomBurningEntities({
      service: this.mobBurns,
      now,
      burnTickMs: this.context.getProfile().fireballBurnTickMs,
      skillBalance: this.context.getSkillBalance(),
      getEntity: (mobId) => this.context.getMob(mobId),
      onTick: (_mobId, mob, damage) => {
        mob.health = Math.max(0, mob.health - damage);
        this.context.onCombatLog(`${mob.name} burns for ${damage}.`);
        if (mob.health <= 0) {
          this.context.handleMobDeath(mob);
        }
      },
    });
  }

  private updatePoisonedPlayers(now: number) {
    this.playerPoisons.update({
      now,
      tickMs: this.context.getProfile().poisonPotionTickMs,
      getEntity: (playerId) => this.context.getPlayer(playerId) as PoisonablePlayer | undefined,
      onTick: (_playerId, player, damage) => {
        const resolvedDamage = this.context.applyDamageToPlayer(player, damage, "physical");
        this.context.onCombatLog(`${player.name} suffers ${resolvedDamage} poison damage.`);
        if (player.health <= 0) {
          this.context.handlePlayerKilled(player);
        }
      },
    });
  }

  private updatePoisonedMobs(now: number) {
    this.mobPoisons.update({
      now,
      tickMs: this.context.getProfile().poisonPotionTickMs,
      getEntity: (mobId) => this.context.getMob(mobId) as PoisonableMob | undefined,
      onTick: (_mobId, mob, damage) => {
        mob.health = Math.max(0, mob.health - damage);
        this.context.onCombatLog(`${mob.name} suffers ${damage} poison damage.`);
        if (mob.health <= 0) {
          this.context.handleMobDeath(mob);
        }
      },
    });
  }

  private updateHealingPlayers(now: number) {
    const profile = this.context.getProfile();
    updateRoomHealingTargets({
      service: this.playerHealing,
      now,
      tickMs: profile.healingPotionTickMs,
      healPerTick: profile.healingPotionTotalHeal / (profile.healingPotionDurationMs / profile.healingPotionTickMs),
      getPlayer: (playerId) => this.context.getPlayer(playerId) as HealablePlayer | undefined,
      onHeal: (_playerId, player, amount) => {
        this.context.showHealingText(player.x, player.y - 18, amount);
      },
    });
  }

  private updateGroundEffects(now: number) {
    const profile = this.context.getProfile();
    const skillBalance = this.context.getSkillBalance();
    const groundEffects = this.context.getGroundEffects();

    for (const [effectId, effect] of groundEffects.entries()) {
      if (effect.expiresAt <= now) {
        groundEffects.delete(effectId);
        continue;
      }

      if (effect.nextTickAt > now) {
        continue;
      }

      const owner = this.context.getPlayer(effect.ownerId);
      const effectDamage =
        effect.skillId === "fireTrail"
          ? skillBalance.fireball.burnDamage
          : skillBalance.fireField.damage;

      for (const player of this.context.getPlayers()) {
        if (player.dead || !this.isEntityOnGroundEffect(player.x, player.y, effect, profile.tileSize)) {
          continue;
        }

        const resolvedDamage = this.context.applyDamageToPlayer(player, effectDamage, "fire");
        this.applyBurnToPlayer(player, effect.skillId === "fireTrail" ? "fireball" : "fireField", effect.ownerId);
        this.context.onCombatLog(`${player.name} scorches for ${resolvedDamage}.`);

        if (player.health <= 0) {
          this.context.handlePlayerKilled(player);
        }
      }

      for (const mob of this.context.getMobs()) {
        if (mob.dead || !this.isEntityOnGroundEffect(mob.x, mob.y, effect, profile.tileSize)) {
          continue;
        }

        mob.health = Math.max(0, mob.health - effectDamage);
        this.applyBurnToMob(mob, effect.skillId === "fireTrail" ? "fireball" : "fireField", effect.ownerId);
        if (owner && !owner.dead) {
          setMobAggroTarget(mob, owner);
        }
        this.context.onCombatLog(`${mob.name} scorches for ${effectDamage}.`);

        if (mob.health <= 0) {
          this.context.handleMobDeath(mob);
          this.context.awardExperience(effect.ownerId, mob.experienceReward);
        }
      }

      effect.nextTickAt = now + (effect.skillId === "fireTrail" ? profile.fireTrailTickMs : profile.fireFieldTickMs);
    }
  }

  private isEntityOnGroundEffect(x: number, y: number, effect: GroundEffectState, tileSize: number) {
    return Math.abs(x - effect.x) <= tileSize / 2 && Math.abs(y - effect.y) <= tileSize / 2;
  }
}
