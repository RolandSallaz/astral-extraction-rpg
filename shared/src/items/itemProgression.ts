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
] as const;

export type ItemProgressionId = typeof ITEM_PROGRESSION_IDS[number];
export type ItemProgressionLevel = 1 | 2 | 3 | 4 | 5;
export type ItemProgressionTier = Exclude<ItemProgressionLevel, 1>;

export type ItemProgressionState = {
  level: ItemProgressionLevel;
  selectedUpgradeIds: ItemProgressionId[];
};

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
  maxLevel: 5,
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
        title: "Focused Grip",
        description: "Placeholder branch with no combat effect yet.",
        isPlaceholder: true,
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
        description: "Placeholder branch with no combat effect yet.",
        isPlaceholder: true,
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
        title: "Astral Weight",
        description: "Placeholder branch with no combat effect yet.",
        isPlaceholder: true,
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
        title: "Empty Path",
        description: "Placeholder branch for a future skill choice.",
        isPlaceholder: true,
      },
    ],
  },
};

const ITEM_PROGRESSION_TREES: Partial<Record<EquipmentItemId, ItemProgressionTree>> = {
  wood_staff: WOOD_STAFF_PROGRESSION_TREE,
};
const ITEM_PROGRESSION_TIERS: ItemProgressionTier[] = [2, 3, 4, 5];

export type ItemProgressionBonuses = {
  meleeStrikeRangeBonusPx: number;
  meleeStrikeCooldownDeltaMs: number;
  woodStaffStrikeKnockbackBonusTiles: number;
  grantsWoodStaffDash: boolean;
};

const EMPTY_ITEM_PROGRESSION_BONUSES: ItemProgressionBonuses = {
  meleeStrikeRangeBonusPx: 0,
  meleeStrikeCooldownDeltaMs: 0,
  woodStaffStrikeKnockbackBonusTiles: 0,
  grantsWoodStaffDash: false,
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
      case "wood_staff_cooldown_3":
        bonuses.meleeStrikeCooldownDeltaMs -= 100;
        break;
      case "wood_staff_knockback_4":
        bonuses.woodStaffStrikeKnockbackBonusTiles += 0.5;
        break;
      case "wood_staff_dash_5":
        bonuses.grantsWoodStaffDash = true;
        break;
      default:
        break;
    }
  });

  return bonuses;
}
