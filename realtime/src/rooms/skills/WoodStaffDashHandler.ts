import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillHandler, SkillCastContext } from "./SkillHandler.js";

export const WoodStaffDashHandler: SkillHandler = {
  skillId: "woodStaffDash",
  needsTarget: true,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffDashCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffDashCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return ctx.profile.woodStaffDashCooldownMs;
  },

  getCastTimeMs(ctx: SkillCastContext) {
    return ctx.profile.woodStaffDashCastMs;
  },

  canPerform(ctx: SkillCastContext, targetX: number, targetY: number) {
    return Math.hypot(targetX - ctx.player.x, targetY - ctx.player.y) > 0.001;
  },

  performCast(ctx: SkillCastContext, targetX: number, targetY: number) {
    ctx.performWoodStaffDash(ctx.player, targetX, targetY);
    return 180;
  },
};
