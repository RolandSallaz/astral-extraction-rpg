import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillHandler, SkillCastContext } from "./SkillHandler.js";
import { getFireballCooldownMs, getFireballCastRange } from "../fireballGems.js";
import { buildFireballCastPlan } from "../projectileSkills.js";

export const FireballHandler: SkillHandler = {
  skillId: "fireball",
  needsTarget: true,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.fireballCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.fireballCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return getFireballCooldownMs(ctx.profile.fireballCooldownMs, ctx.player);
  },

  canPerform(ctx: SkillCastContext, targetX: number, targetY: number) {
    const startX = ctx.player.x;
    const startY = ctx.player.y + ctx.profile.fireballSpawnOffsetY;
    return Math.hypot(targetX - startX, targetY - startY) > 0.001;
  },

  performCast(ctx: SkillCastContext, targetX: number, targetY: number) {
    const p = ctx.profile;
    const gemConfig = ctx.getOwnerProjectileGemConfig(ctx.sessionId, "fireball");
    const plan = buildFireballCastPlan({
      ownerId: ctx.sessionId,
      startX: ctx.player.x,
      startY: ctx.player.y + p.fireballSpawnOffsetY,
      targetX,
      targetY,
      now: ctx.now,
      fireballLifetime: p.fireballLifetime,
      splitAngleOffsetRad: p.fireSplitAngleOffsetRad,
      splitProjectile: ctx.hasSplitProjectileGem(ctx.sessionId),
      gemConfig,
    });

    ctx.queueBurstSpawns(plan.delayedSpawns);
    plan.immediateSpawns.forEach((spawn) => {
      ctx.spawnProjectile(
        spawn.ownerId,
        spawn.skillId,
        spawn.x,
        spawn.y,
        spawn.directionX,
        spawn.directionY,
        spawn.lifetime,
        spawn.damageScale ?? 1,
        spawn.sizeScale ?? 1,
      );
    });

    return plan.postCastLockMs;
  },
};
