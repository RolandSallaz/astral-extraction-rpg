import { isSameEquipmentItemFamily } from "../items/catalog";
import { WOOD_STAFF_CHAIN_STRIKE_COOLDOWN_MS } from "../items/itemProgression";

/**
 * Skill system interface.
 *
 * Defines a composable SkillDefinition so that adding new skills
 * only requires registering a new entry — no changes to room
 * message handlers, cast logic, or cooldown tracking.
 */

export type SkillId =
  | "woodStaffStrike"
  | "woodStaffDash"
  | "woodStaffSlam"
  | "woodStaffChainStrike"
  | "woodStaffSpectralVolley"
  | "woodStaffStormIncarnate"
  | "woodStaffVoidFracture"
  | "fireball"
  | "fireNova"
  | "fireField";

export type SkillCategory = "melee" | "projectile" | "nova" | "ground";

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
  woodStaffStrike: {
    id: "woodStaffStrike",
    category: "melee",
    name: "Wood Staff Strike",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 450,
    spawnsProjectile: false,
  },
  woodStaffDash: {
    id: "woodStaffDash",
    category: "melee",
    name: "Wood Staff Dash",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 2000,
    spawnsProjectile: false,
  },
  woodStaffSlam: {
    id: "woodStaffSlam",
    category: "nova",
    name: "Wood Staff Slam",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 6000,
    spawnsProjectile: false,
  },
  woodStaffChainStrike: {
    id: "woodStaffChainStrike",
    category: "melee",
    name: "Wood Staff Chain Strike",
    requiredWeapon: "wood_staff",
    baseCooldownMs: WOOD_STAFF_CHAIN_STRIKE_COOLDOWN_MS,
    spawnsProjectile: false,
  },
  fireball: {
    id: "fireball",
    category: "projectile",
    name: "Fireball",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 1000,
    spawnsProjectile: true,
  },
  fireNova: {
    id: "fireNova",
    category: "nova",
    name: "Fire Nova",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 10000,
    spawnsProjectile: true,
  },
  fireField: {
    id: "fireField",
    category: "ground",
    name: "Fire Field",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 12000,
    spawnsProjectile: false,
  },
  woodStaffSpectralVolley: {
    id: "woodStaffSpectralVolley",
    category: "projectile",
    name: "Spectral Volley",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 3000,
    spawnsProjectile: true,
  },
  woodStaffStormIncarnate: {
    id: "woodStaffStormIncarnate",
    category: "nova",
    name: "Storm Incarnate",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 30000,
    spawnsProjectile: false,
  },
  woodStaffVoidFracture: {
    id: "woodStaffVoidFracture",
    category: "nova",
    name: "Void Fracture",
    requiredWeapon: "wood_staff",
    baseCooldownMs: 25000,
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
  return weaponItem === skill.requiredWeapon || isSameEquipmentItemFamily(weaponItem, skill.requiredWeapon);
}
