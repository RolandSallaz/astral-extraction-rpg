import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillHandler, SkillCastContext } from "./SkillHandler.js";

export const FireFieldHandler: SkillHandler = {
  skillId: "fireField",
  needsTarget: true,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.fireFieldCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.fireFieldCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return ctx.profile.fireFieldCooldownMs;
  },

  performCast(ctx: SkillCastContext, targetX: number, targetY: number) {
    ctx.createFireField(ctx.player, targetX, targetY, ctx.now);
    return 0;
  },
};
