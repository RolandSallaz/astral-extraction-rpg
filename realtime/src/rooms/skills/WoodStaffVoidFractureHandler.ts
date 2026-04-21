import type { BasePlayerState } from "../schema/BasePlayerState.js";
import type { SkillCastContext, SkillHandler } from "./SkillHandler.js";

const WOOD_STAFF_VOID_FRACTURE_MIN_COOLDOWN_MS = 12000;

export const WoodStaffVoidFractureHandler: SkillHandler = {
  skillId: "woodStaffVoidFracture",
  needsTarget: false,

  getCooldownEndsAt(player: BasePlayerState) {
    return player.woodStaffVoidFractureCooldownEndsAt;
  },

  setCooldownEndsAt(player: BasePlayerState, value: number) {
    player.woodStaffVoidFractureCooldownEndsAt = value;
  },

  getCooldownMs(ctx: SkillCastContext) {
    return Math.max(
      WOOD_STAFF_VOID_FRACTURE_MIN_COOLDOWN_MS,
      ctx.profile.woodStaffVoidFractureCooldownMs - ctx.woodStaffVoidFractureCooldownReductionMs,
    );
  },

  getCastTimeMs() {
    return 0;
  },

  performCast(ctx: SkillCastContext, _targetX: number, _targetY: number) {
    ctx.performWoodStaffVoidFracture(ctx.player);
    return 400;
  },
};
