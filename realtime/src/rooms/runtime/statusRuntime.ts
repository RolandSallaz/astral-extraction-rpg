import { type BurnableEntity } from "../sharedGameplay.js";
import { type SkillBalanceConfig } from "@mmorpg/shared";
import { BurnService } from "../services/BurnService.js";
import { HealingService, type HealablePlayer } from "../services/HealingService.js";
import { getRoomSkillBurnDamage } from "./skillRuntime.js";

type BurningEntity = BurnableEntity & {
  health: number;
  dead?: boolean;
};

export function updateRoomBurningEntities<TEntity extends BurningEntity>(options: {
  service: BurnService;
  now: number;
  burnTickMs: number;
  skillBalance: SkillBalanceConfig;
  getEntity: (entityId: string) => TEntity | undefined;
  onTick: (entityId: string, entity: TEntity, damage: number) => void;
  onExpire?: (entityId: string) => void;
}) {
  options.service.update({
    now: options.now,
    burnTickMs: options.burnTickMs,
    getEntity: options.getEntity,
    getBurnDamage: (sourceSkill) => getRoomSkillBurnDamage(options.skillBalance, sourceSkill),
    onTick: (entityId, entity, damage) => options.onTick(entityId, entity as TEntity, damage),
    onExpire: options.onExpire ?? (() => {}),
  });
}

export function applyRoomBurnToEntity<TEntity extends BurnableEntity>(options: {
  service: BurnService;
  entityId: string;
  entity: TEntity;
  sourceSkill: keyof SkillBalanceConfig;
  ownerId?: string;
  skillBalance: SkillBalanceConfig;
  burnTickMs: number;
  getDurationMultiplier?: (ownerId: string) => number;
}) {
  const durationMultiplier =
    options.ownerId && options.getDurationMultiplier
      ? options.getDurationMultiplier(options.ownerId)
      : 1;

  options.service.applyBurn(
    options.entityId,
    options.entity,
    options.sourceSkill,
    options.skillBalance[options.sourceSkill].burnTicks,
    options.burnTickMs,
    durationMultiplier,
  );
}

export function updateRoomHealingTargets<TPlayer extends HealablePlayer>(options: {
  service: HealingService;
  now: number;
  tickMs: number;
  healPerTick: number;
  getPlayer: (playerId: string) => TPlayer | undefined;
  onHeal?: (playerId: string, player: TPlayer, amount: number) => void;
}) {
  options.service.update({
    now: options.now,
    tickMs: options.tickMs,
    healPerTick: options.healPerTick,
    getPlayer: options.getPlayer,
    onHeal: options.onHeal
      ? (playerId, player, amount) => options.onHeal?.(playerId, player as TPlayer, amount)
      : undefined,
  });
}
