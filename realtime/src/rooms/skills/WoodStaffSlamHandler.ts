import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "./SkillHandler.js";

export const WoodStaffSlamHandler: SkillHandler = {
  skillId: "woodStaffSlam",
  needsTarget: false,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffSlamCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffSlamCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return ctx.profile.woodStaffSlamCooldownMs;
  },

  getCastTimeMs() {
    return 0;
  },

  performCast(ctx: SkillCastContext, _targetX: number, _targetY: number) {
    ctx.performWoodStaffSlam(ctx.player);
    return 180;
  },
};
