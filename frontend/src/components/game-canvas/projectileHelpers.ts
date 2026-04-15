import type { SkillEffectConfig, SkillEffectId, SkillEffectOverrides } from "@/lib/skillEffects";
import type { SpriteSheetAnimation } from "@/lib/animations/runtime";

type ProjectileAnimation = SpriteSheetAnimation & {
  skillId?: SkillEffectId;
};

export function getProjectileAnimation(
  skillId: string,
  projectileAnimations: Pick<Record<SkillEffectId, ProjectileAnimation>, "fireball" | "fireNova">,
) {
  return skillId === "fireNova" ? projectileAnimations.fireNova : projectileAnimations.fireball;
}

export function getProjectileDisplaySize(skillId: string, skillEffects: SkillEffectOverrides) {
  if (skillId === "fireNova") {
    return skillEffects.fireNova.displaySize;
  }

  if (skillId === "fireballShard") {
    return Math.max(12, Math.round(skillEffects.fireball.displaySize * 0.6));
  }

  if (skillId === "fireballSplit") {
    return Math.max(14, Math.round(skillEffects.fireball.displaySize * 0.8));
  }

  return skillEffects.fireball.displaySize;
}

export type { SkillEffectConfig, SkillEffectId };
