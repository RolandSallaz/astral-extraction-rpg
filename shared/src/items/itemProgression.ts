import type { EquipmentItemId } from "./catalog";

export const ITEM_PROGRESSION_IDS = [
  "wood_staff_range_2",
  "wood_staff_focus_2",
  "wood_staff_cooldown_3",
  "wood_staff_channel_3",
  "wood_staff_knockback_4",
  "wood_staff_force_4",
  "wood_staff_dash_5",
  "wood_staff_nova_5",
  "wood_staff_rapid_6",
  "wood_staff_power_6",
  "wood_staff_mastery_7",
  "wood_staff_tempest_7",
  "wood_staff_echo_8",
  "wood_staff_leech_8",
  "wood_staff_ruin_9",
  "wood_staff_gale_9",
  "wood_staff_chain_10",
  "wood_staff_volley_10",
  "wood_staff_chain_jump_11",
  "wood_staff_chain_reach_12",
  "wood_staff_chain_seek_13",
  "wood_staff_chain_refund_14",
] as const;

export type ItemProgressionId = typeof ITEM_PROGRESSION_IDS[number];
export type ItemProgressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type ItemProgressionTier = Exclude<ItemProgressionLevel, 1>;

export type ItemProgressionState = {
  level: ItemProgressionLevel;
  selectedUpgradeIds: ItemProgressionId[];
};

export const WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT = 3;
export const WOOD_STAFF_CHAIN_STRIKE_BASE_BOUNCE_RADIUS_PX = 96;

export type ItemProgressionChoice = {
  id: ItemProgressionId;
  level: ItemProgressionTier;
  title: string;
  description: string;
  isPlaceholder?: boolean;
};

export type ItemProgressionTree = {
  itemId: EquipmentItemId;
  maxLevel: ItemProgressionLevel;
  choicesByLevel: Record<ItemProgressionTier, ItemProgressionChoice[]>;
};

const WOOD_STAFF_PROGRESSION_TREE: ItemProgressionTree = {
  itemId: "wood_staff",
  maxLevel: 14,
  choicesByLevel: {
    2: [
      {
        id: "wood_staff_range_2",
        level: 2,
        title: "Long Reach",
        description: "Slightly increases strike range.",
      },
      {
        id: "wood_staff_focus_2",
        level: 2,
        title: "Heavy Grip",
        description: "Increases strike damage by 3.",
      },
    ],
    3: [
      {
        id: "wood_staff_cooldown_3",
        level: 3,
        title: "Quick Recovery",
        description: "Reduces strike cooldown by 0.1s.",
      },
      {
        id: "wood_staff_channel_3",
        level: 3,
        title: "Astral Channel",
        description: "Increases strike damage by 15%.",
      },
    ],
    4: [
      {
        id: "wood_staff_knockback_4",
        level: 4,
        title: "Force Pulse",
        description: "Wood Staff Strike gains +0.5 tile knockback.",
      },
      {
        id: "wood_staff_force_4",
        level: 4,
        title: "Crippling Force",
        description: "Wood Staff Strike slows targets for 2s.",
      },
    ],
    5: [
      {
        id: "wood_staff_dash_5",
        level: 5,
        title: "Dash Skill",
        description: "Unlocks Wood Staff Dash.",
      },
      {
        id: "wood_staff_nova_5",
        level: 5,
        title: "Shockwave Slam",
        description: "Unlocks a close-range area strike around you.",
      },
    ],
    6: [
      {
        id: "wood_staff_rapid_6",
        level: 6,
        title: "Rapid Assault",
        description: "Reduces strike cooldown by an additional 0.15s.",
      },
      {
        id: "wood_staff_power_6",
        level: 6,
        title: "Power Surge",
        description: "Increases strike damage by 8.",
      },
    ],
    7: [
      {
        id: "wood_staff_mastery_7",
        level: 7,
        title: "Ancient Mastery",
        description: "Increases all strike damage by 30%.",
      },
      {
        id: "wood_staff_tempest_7",
        level: 7,
        title: "Tempest Strike",
        description: "Strike range +25px and knockback +0.5 tile.",
      },
    ],
    8: [
      {
        id: "wood_staff_echo_8",
        level: 8,
        title: "Resonant Echo",
        description: "Strike splashes 50% damage to adjacent enemies.",
      },
      {
        id: "wood_staff_leech_8",
        level: 8,
        title: "Life Leech",
        description: "Each strike hit restores 3 HP.",
      },
    ],
    9: [
      {
        id: "wood_staff_ruin_9",
        level: 9,
        title: "Ruinous Strikes",
        description: "Increases strike damage by 50%.",
      },
      {
        id: "wood_staff_gale_9",
        level: 9,
        title: "Gale Force",
        description: "Strike cooldown -0.2s and knockback +1 tile.",
      },
    ],
    10: [
      {
        id: "wood_staff_chain_10",
        level: 10,
        title: "Chain Strike",
        description: "Unlocks Chain Strike: bounces between up to 3 nearby enemies.",
      },
      {
        id: "wood_staff_volley_10",
        level: 10,
        title: "Spectral Volley",
        description: "Unlocks Spectral Volley: fires 3 bolts in a spread.",
      },
    ],
    11: [
      {
        id: "wood_staff_chain_jump_11",
        level: 11,
        title: "Linked Momentum",
        description: "Chain Strike gains +1 bounce.",
      },
    ],
    12: [
      {
        id: "wood_staff_chain_reach_12",
        level: 12,
        title: "Long Link",
        description: "Chain Strike can be started from +1 tile farther away.",
      },
    ],
    13: [
      {
        id: "wood_staff_chain_seek_13",
        level: 13,
        title: "Seeking Link",
        description: "Chain Strike searches +1 tile farther for the next target.",
      },
    ],
    14: [
      {
        id: "wood_staff_chain_refund_14",
        level: 14,
        title: "Endless Link",
        description: "Chain Strike has a 50% chance to keep a bounce after a chained hit deals damage.",
      },
    ],
  },
};

const ITEM_PROGRESSION_TREES: Partial<Record<EquipmentItemId, ItemProgressionTree>> = {
  wood_staff: WOOD_STAFF_PROGRESSION_TREE,
};
const ITEM_PROGRESSION_TIERS: ItemProgressionTier[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export type ItemProgressionBonuses = {
  meleeStrikeRangeBonusPx: number;
  meleeStrikeCooldownDeltaMs: number;
  meleeStrikeDamageFlatBonus: number;
  meleeStrikeDamageMultiplierBonus: number;
  woodStaffStrikeKnockbackBonusTiles: number;
  woodStaffStrikeSlowDurationMs: number;
  woodStaffStrikeAoeSplashEnabled: boolean;
  woodStaffStrikeHealOnHit: number;
  woodStaffChainStrikeBonusHits: number;
  woodStaffChainStrikeRangeBonusPx: number;
  woodStaffChainStrikeBounceRadiusBonusPx: number;
  woodStaffChainStrikeRefundChance: number;
  grantsWoodStaffDash: boolean;
  grantsWoodStaffSlam: boolean;
  grantsWoodStaffChainStrike: boolean;
  grantsWoodStaffSpectralVolley: boolean;
};

const EMPTY_ITEM_PROGRESSION_BONUSES: ItemProgressionBonuses = {
  meleeStrikeRangeBonusPx: 0,
  meleeStrikeCooldownDeltaMs: 0,
  meleeStrikeDamageFlatBonus: 0,
  meleeStrikeDamageMultiplierBonus: 0,
  woodStaffStrikeKnockbackBonusTiles: 0,
  woodStaffStrikeSlowDurationMs: 0,
  woodStaffStrikeAoeSplashEnabled: false,
  woodStaffStrikeHealOnHit: 0,
  woodStaffChainStrikeBonusHits: 0,
  woodStaffChainStrikeRangeBonusPx: 0,
  woodStaffChainStrikeBounceRadiusBonusPx: 0,
  woodStaffChainStrikeRefundChance: 0,
  grantsWoodStaffDash: false,
  grantsWoodStaffSlam: false,
  grantsWoodStaffChainStrike: false,
  grantsWoodStaffSpectralVolley: false,
};

export function getItemProgressionTree(itemId: string | null | undefined): ItemProgressionTree | null {
  if (!itemId) {
    return null;
  }

  return ITEM_PROGRESSION_TREES[itemId as EquipmentItemId] ?? null;
}

export function supportsItemProgression(itemId: string | null | undefined): itemId is EquipmentItemId {
  return getItemProgressionTree(itemId) !== null;
}

export function getItemProgressionChoice(
  itemId: string | null | undefined,
  progressionId: string | null | undefined,
): ItemProgressionChoice | null {
  const tree = getItemProgressionTree(itemId);
  if (!tree || !progressionId) {
    return null;
  }

  for (const level of ITEM_PROGRESSION_TIERS) {
    const choice = tree.choicesByLevel[level].find((entry) => entry.id === progressionId);
    if (choice) {
      return choice;
    }
  }

  return null;
}

export function getItemProgressionChoicesForLevel(
  itemId: string | null | undefined,
  level: ItemProgressionTier,
) {
  return getItemProgressionTree(itemId)?.choicesByLevel[level] ?? [];
}

export function createBaseItemProgressionState(): ItemProgressionState {
  return {
    level: 1,
    selectedUpgradeIds: [],
  };
}

export function normalizeItemProgressionState(
  itemId: string | null | undefined,
  progression: ItemProgressionState | null | undefined,
): ItemProgressionState | null {
  const tree = getItemProgressionTree(itemId);
  if (!tree) {
    return null;
  }

  const selectedUpgradeIds: ItemProgressionId[] = [];
  const seenIds = new Set<ItemProgressionId>();

  for (const rawId of progression?.selectedUpgradeIds ?? []) {
    const choice = getItemProgressionChoice(tree.itemId, rawId);
    if (!choice || seenIds.has(choice.id)) {
      continue;
    }

    seenIds.add(choice.id);
    selectedUpgradeIds.push(choice.id);
  }

  const maxUnlockedLevel = selectedUpgradeIds.reduce<ItemProgressionLevel>((currentMax, upgradeId) => {
    const choice = getItemProgressionChoice(tree.itemId, upgradeId);
    if (!choice) {
      return currentMax;
    }

    return (Math.max(currentMax, choice.level) as ItemProgressionLevel);
  }, 1);

  const normalizedLevel = progression?.level
    ? (Math.max(1, Math.min(tree.maxLevel, Math.max(progression.level, maxUnlockedLevel))) as ItemProgressionLevel)
    : maxUnlockedLevel;

  const filteredUpgradeIds = selectedUpgradeIds.filter((upgradeId) => {
    const choice = getItemProgressionChoice(tree.itemId, upgradeId);
    return choice ? choice.level <= normalizedLevel : false;
  });

  return {
    level: normalizedLevel,
    selectedUpgradeIds: filteredUpgradeIds,
  };
}

export function canSelectItemProgressionChoice(
  itemId: string | null | undefined,
  progression: ItemProgressionState | null | undefined,
  progressionId: string | null | undefined,
): boolean {
  const tree = getItemProgressionTree(itemId);
  const choice = getItemProgressionChoice(itemId, progressionId);
  const normalized = normalizeItemProgressionState(itemId, progression);
  if (!tree || !choice || !normalized) {
    return false;
  }

  if (normalized.selectedUpgradeIds.includes(choice.id)) {
    return false;
  }

  return choice.level === Math.min(tree.maxLevel, normalized.level + 1);
}

export function applyItemProgressionChoice(
  itemId: string | null | undefined,
  progression: ItemProgressionState | null | undefined,
  progressionId: string | null | undefined,
): ItemProgressionState | null {
  if (!canSelectItemProgressionChoice(itemId, progression, progressionId)) {
    return normalizeItemProgressionState(itemId, progression);
  }

  const choice = getItemProgressionChoice(itemId, progressionId);
  const normalized = normalizeItemProgressionState(itemId, progression) ?? createBaseItemProgressionState();
  if (!choice) {
    return normalized;
  }

  return {
    level: choice.level,
    selectedUpgradeIds: [...normalized.selectedUpgradeIds, choice.id],
  };
}

export function getItemProgressionBonuses(
  itemId: string | null | undefined,
  progression: ItemProgressionState | null | undefined,
): ItemProgressionBonuses {
  const normalized = normalizeItemProgressionState(itemId, progression);
  if (!normalized) {
    return EMPTY_ITEM_PROGRESSION_BONUSES;
  }

  const bonuses: ItemProgressionBonuses = {
    ...EMPTY_ITEM_PROGRESSION_BONUSES,
  };

  normalized.selectedUpgradeIds.forEach((upgradeId) => {
    switch (upgradeId) {
      case "wood_staff_range_2":
        bonuses.meleeStrikeRangeBonusPx += 10;
        break;
      case "wood_staff_focus_2":
        bonuses.meleeStrikeDamageFlatBonus += 3;
        break;
      case "wood_staff_cooldown_3":
        bonuses.meleeStrikeCooldownDeltaMs -= 100;
        break;
      case "wood_staff_channel_3":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.15;
        break;
      case "wood_staff_knockback_4":
        bonuses.woodStaffStrikeKnockbackBonusTiles += 0.5;
        break;
      case "wood_staff_force_4":
        bonuses.woodStaffStrikeSlowDurationMs = Math.max(bonuses.woodStaffStrikeSlowDurationMs, 2000);
        break;
      case "wood_staff_dash_5":
        bonuses.grantsWoodStaffDash = true;
        break;
      case "wood_staff_nova_5":
        bonuses.grantsWoodStaffSlam = true;
        break;
      case "wood_staff_rapid_6":
        bonuses.meleeStrikeCooldownDeltaMs -= 150;
        break;
      case "wood_staff_power_6":
        bonuses.meleeStrikeDamageFlatBonus += 8;
        break;
      case "wood_staff_chain_jump_11":
        bonuses.woodStaffChainStrikeBonusHits += 1;
        break;
      case "wood_staff_mastery_7":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.30;
        break;
      case "wood_staff_tempest_7":
        bonuses.meleeStrikeRangeBonusPx += 25;
        bonuses.woodStaffStrikeKnockbackBonusTiles += 0.5;
        break;
      case "wood_staff_chain_reach_12":
        bonuses.woodStaffChainStrikeRangeBonusPx += 32;
        break;
      case "wood_staff_echo_8":
        bonuses.woodStaffStrikeAoeSplashEnabled = true;
        break;
      case "wood_staff_leech_8":
        bonuses.woodStaffStrikeHealOnHit += 3;
        break;
      case "wood_staff_chain_seek_13":
        bonuses.woodStaffChainStrikeBounceRadiusBonusPx += 32;
        break;
      case "wood_staff_ruin_9":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.50;
        break;
      case "wood_staff_gale_9":
        bonuses.meleeStrikeCooldownDeltaMs -= 200;
        bonuses.woodStaffStrikeKnockbackBonusTiles += 1.0;
        break;
      case "wood_staff_chain_refund_14":
        bonuses.woodStaffChainStrikeRefundChance += 0.5;
        break;
      case "wood_staff_chain_10":
        bonuses.grantsWoodStaffChainStrike = true;
        break;
      case "wood_staff_volley_10":
        bonuses.grantsWoodStaffSpectralVolley = true;
        break;
      default:
        break;
    }
  });

  return bonuses;
}

export function resolveWoodStaffStrikeDamage(
  baseDamage: number,
  bonuses: Pick<ItemProgressionBonuses, "meleeStrikeDamageFlatBonus" | "meleeStrikeDamageMultiplierBonus">,
) {
  const scaledDamage = (baseDamage + bonuses.meleeStrikeDamageFlatBonus) * (1 + bonuses.meleeStrikeDamageMultiplierBonus);
  return Math.max(1, Math.round(scaledDamage));
}
