/**
 * Skill system interface.
 *
 * Defines a composable SkillDefinition so that adding new skills
 * only requires registering a new entry — no changes to room
 * message handlers, cast logic, or cooldown tracking.
 */

export type SkillId = "fireball" | "fireNova" | "fireField";

export type SkillCategory = "projectile" | "nova" | "ground";

export type SkillDefinition = {
  id: SkillId;
  category: SkillCategory;
  /** Display name for UI / combat log */
  name: string;
  /** Requires this weapon to cast (empty = no requirement) */
  requiredWeapon: string;
  /** Base cooldown before gem modifiers */
  baseCooldownMs: number;
  /** Whether the skill fires projectiles */
  spawnsProjectile: boolean;
};

export const SKILL_REGISTRY: Record<SkillId, SkillDefinition> = {
  fireball: {
    id: "fireball",
    category: "projectile",
    name: "Fireball",
    requiredWeapon: "default_staff",
    baseCooldownMs: 1000,
    spawnsProjectile: true,
  },
  fireNova: {
    id: "fireNova",
    category: "nova",
    name: "Fire Nova",
    requiredWeapon: "default_staff",
    baseCooldownMs: 10000,
    spawnsProjectile: true,
  },
  fireField: {
    id: "fireField",
    category: "ground",
    name: "Fire Field",
    requiredWeapon: "default_staff",
    baseCooldownMs: 12000,
    spawnsProjectile: false,
  },
};

/**
 * Look up a skill definition.  Returns undefined for unknown IDs.
 */
export function getSkillDefinition(
  skillId: string,
): SkillDefinition | undefined {
  return SKILL_REGISTRY[skillId as SkillId];
}

/**
 * Check if a player can cast a skill based on their weapon.
 */
export function canCastSkill(
  skillId: string,
  weaponItem: string,
): boolean {
  const skill = getSkillDefinition(skillId);
  if (!skill) return false;
  if (!skill.requiredWeapon) return true;
  return weaponItem === skill.requiredWeapon;
}
