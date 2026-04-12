import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillHandler, SkillCastContext } from "./SkillHandler.js";

export const FireNovaHandler: SkillHandler = {
  skillId: "fireNova",
  needsTarget: false,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.fireNovaCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.fireNovaCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return ctx.profile.fireNovaCooldownMs;
  },

  performCast(ctx: SkillCastContext, _targetX: number, _targetY: number) {
    const p = ctx.profile;
    const originX = ctx.player.x;
    const originY = ctx.player.y + p.fireballSpawnOffsetY;

    for (let index = 0; index < p.fireNovaProjectileCount; index += 1) {
      const angle = (Math.PI * 2 * index) / p.fireNovaProjectileCount;
      ctx.spawnProjectile(
        ctx.sessionId,
        "fireNova",
        originX,
        originY,
        Math.cos(angle),
        Math.sin(angle),
        p.fireballLifetime,
      );
    }
    return 0;
  },
};
