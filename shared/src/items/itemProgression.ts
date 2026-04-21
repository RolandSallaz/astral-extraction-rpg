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
  "wood_staff_volley_scatter_11",
  "wood_staff_chain_reach_12",
  "wood_staff_volley_spread_12",
  "wood_staff_chain_seek_13",
  "wood_staff_volley_pierce_13",
  "wood_staff_chain_refund_14",
  "wood_staff_volley_echo_14",
  // Levels 15–19: neutral mastery upgrades (no branch requirement)
  "wood_staff_fleet_15",
  "wood_staff_runic_15",
  "wood_staff_grandmaster_16",
  "wood_staff_warlord_16",
  "wood_staff_vampire_17",
  "wood_staff_surge_17",
  "wood_staff_phantom_18",
  "wood_staff_warforged_18",
  "wood_staff_rune_19",
  "wood_staff_voidconduit_19",
  // Level 20: ultimate fork
  "wood_staff_storm_20",
  "wood_staff_fracture_20",
  // Levels 21–25: Storm Incarnate path
  "wood_staff_storm_haste_21",
  "wood_staff_storm_amp_22",
  "wood_staff_storm_heal_23",
  "wood_staff_storm_chain_24",
  "wood_staff_storm_finale_25",
  // Levels 21–25: Void Fracture path
  "wood_staff_fracture_amp_21",
  "wood_staff_fracture_stun_22",
  "wood_staff_fracture_refund_23",
  "wood_staff_fracture_soul_24",
  "wood_staff_fracture_twin_25",
] as const;

export type ItemProgressionId = typeof ITEM_PROGRESSION_IDS[number];
export type ItemProgressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25;
export type ItemProgressionTier = Exclude<ItemProgressionLevel, 1>;

export type ItemProgressionState = {
  level: ItemProgressionLevel;
  selectedUpgradeIds: ItemProgressionId[];
};

export const WOOD_STAFF_CHAIN_STRIKE_BASE_HIT_COUNT = 3;
export const WOOD_STAFF_CHAIN_STRIKE_BASE_BOUNCE_RADIUS_PX = 96;
export const WOOD_STAFF_CHAIN_STRIKE_COOLDOWN_MS = 1400;
export const WOOD_STAFF_STRIKE_MIN_COOLDOWN_MS = 250;
export const WOOD_STAFF_STRIKE_MAX_COOLDOWN_REDUCTION_MS = 200;
export const WOOD_STAFF_STRIKE_MAX_DAMAGE_FLAT_BONUS = 32;
export const WOOD_STAFF_STRIKE_MAX_DAMAGE_MULTIPLIER_BONUS = 1.25;
export const WOOD_STAFF_STRIKE_MAX_KNOCKBACK_BONUS_TILES = 2;
export const WOOD_STAFF_CHAIN_STRIKE_MAX_REFUND_CHANCE = 0.25;
export const WOOD_STAFF_SPECTRAL_VOLLEY_MAX_REFUND_CHANCE = 0.25;

export type ItemProgressionChoice = {
  id: ItemProgressionId;
  level: ItemProgressionTier;
  title: string;
  description: string;
  isPlaceholder?: boolean;
  requiresUpgrade?: ItemProgressionId;
};

export type ItemProgressionTree = {
  itemId: EquipmentItemId;
  maxLevel: ItemProgressionLevel;
  choicesByLevel: Record<ItemProgressionTier, ItemProgressionChoice[]>;
};

const WOOD_STAFF_PROGRESSION_TREE: ItemProgressionTree = {
  itemId: "wood_staff",
  maxLevel: 25,
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
        description: "Reduces strike cooldown by 0.06s.",
      },
      {
        id: "wood_staff_channel_3",
        level: 3,
        title: "Astral Channel",
        description: "Increases strike damage by 10%.",
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
        description: "Reduces strike cooldown by an additional 0.08s.",
      },
      {
        id: "wood_staff_power_6",
        level: 6,
        title: "Power Surge",
        description: "Increases strike damage by 6.",
      },
    ],
    7: [
      {
        id: "wood_staff_mastery_7",
        level: 7,
        title: "Ancient Mastery",
        description: "Increases all strike damage by 20%.",
      },
      {
        id: "wood_staff_tempest_7",
        level: 7,
        title: "Tempest Strike",
        description: "Strike range +20px and knockback +0.25 tile.",
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
        description: "Increases strike damage by 25%.",
      },
      {
        id: "wood_staff_gale_9",
        level: 9,
        title: "Gale Force",
        description: "Strike cooldown -0.08s and knockback +0.5 tile.",
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
        requiresUpgrade: "wood_staff_chain_10",
      },
      {
        id: "wood_staff_volley_scatter_11",
        level: 11,
        title: "Scatter Shot",
        description: "Spectral Volley fires +1 additional bolt (4 total).",
        requiresUpgrade: "wood_staff_volley_10",
      },
    ],
    12: [
      {
        id: "wood_staff_chain_reach_12",
        level: 12,
        title: "Long Link",
        description: "Chain Strike can be started from +1 tile farther away.",
        requiresUpgrade: "wood_staff_chain_10",
      },
      {
        id: "wood_staff_volley_spread_12",
        level: 12,
        title: "Wide Arc",
        description: "Spectral Volley bolts spread across a 15° wider angle.",
        requiresUpgrade: "wood_staff_volley_10",
      },
    ],
    13: [
      {
        id: "wood_staff_chain_seek_13",
        level: 13,
        title: "Seeking Link",
        description: "Chain Strike searches +1 tile farther for the next target.",
        requiresUpgrade: "wood_staff_chain_10",
      },
      {
        id: "wood_staff_volley_pierce_13",
        level: 13,
        title: "Phantom Bolts",
        description: "Spectral Volley bolts pierce through enemies.",
        requiresUpgrade: "wood_staff_volley_10",
      },
    ],
    14: [
      {
        id: "wood_staff_chain_refund_14",
        level: 14,
        title: "Endless Link",
        description: "Chain Strike has a 25% chance to keep a bounce after a chained hit deals damage.",
        requiresUpgrade: "wood_staff_chain_10",
      },
      {
        id: "wood_staff_volley_echo_14",
        level: 14,
        title: "Echo Volley",
        description: "Spectral Volley has a 25% chance to fire a weaker second volley.",
        requiresUpgrade: "wood_staff_volley_10",
      },
    ],
    15: [
      {
        id: "wood_staff_fleet_15",
        level: 15,
        title: "Fleet Mastery",
        description: "Reduces strike cooldown by 0.1s.",
      },
      {
        id: "wood_staff_runic_15",
        level: 15,
        title: "Runic Power",
        description: "Increases strike damage by 8.",
      },
    ],
    16: [
      {
        id: "wood_staff_grandmaster_16",
        level: 16,
        title: "Grandmaster's Edge",
        description: "Increases all strike damage by 25%.",
      },
      {
        id: "wood_staff_warlord_16",
        level: 16,
        title: "Warlord's Fury",
        description: "Knockback +0.75 tiles and slows targets for 1s.",
      },
    ],
    17: [
      {
        id: "wood_staff_vampire_17",
        level: 17,
        title: "Vampiric Edge",
        description: "Strike heals +3 HP on each hit.",
      },
      {
        id: "wood_staff_surge_17",
        level: 17,
        title: "Power Surge",
        description: "Increases strike damage by 10.",
      },
    ],
    18: [
      {
        id: "wood_staff_phantom_18",
        level: 18,
        title: "Phantom Strikes",
        description: "Increases all strike damage by 30%.",
      },
      {
        id: "wood_staff_warforged_18",
        level: 18,
        title: "War Forged",
        description: "Strike damage +8 and cooldown -0.08s.",
      },
    ],
    19: [
      {
        id: "wood_staff_rune_19",
        level: 19,
        title: "Rune of Destruction",
        description: "Increases all strike damage by 35%.",
      },
      {
        id: "wood_staff_voidconduit_19",
        level: 19,
        title: "Void Conduit",
        description: "Knockback +1 tile and strike range +16px.",
      },
    ],
    20: [
      {
        id: "wood_staff_storm_20",
        level: 20,
        title: "Storm Incarnate",
        description: "Ultimate: Enter a storm for 5s. Auto-strike the nearest enemy every 0.4s with reduced power.",
      },
      {
        id: "wood_staff_fracture_20",
        level: 20,
        title: "Void Fracture",
        description: "Ultimate: Release a burst dealing 350% strike damage to all nearby enemies and stunning them for 1.5s.",
      },
    ],
    21: [
      {
        id: "wood_staff_storm_haste_21",
        level: 21,
        title: "Unleashed",
        description: "Storm Incarnate lasts +2s longer.",
        requiresUpgrade: "wood_staff_storm_20",
      },
      {
        id: "wood_staff_fracture_amp_21",
        level: 21,
        title: "Fracture Amplified",
        description: "Void Fracture deals +50% more damage.",
        requiresUpgrade: "wood_staff_fracture_20",
      },
    ],
    22: [
      {
        id: "wood_staff_storm_amp_22",
        level: 22,
        title: "Tempest Frenzy",
        description: "Each strike during Storm Incarnate deals +35% more damage.",
        requiresUpgrade: "wood_staff_storm_20",
      },
      {
        id: "wood_staff_fracture_stun_22",
        level: 22,
        title: "Shatter",
        description: "Void Fracture stun lasts +1s longer.",
        requiresUpgrade: "wood_staff_fracture_20",
      },
    ],
    23: [
      {
        id: "wood_staff_storm_heal_23",
        level: 23,
        title: "Vampiric Storm",
        description: "Each strike during Storm Incarnate heals 4 HP.",
        requiresUpgrade: "wood_staff_storm_20",
      },
      {
        id: "wood_staff_fracture_refund_23",
        level: 23,
        title: "Rift Mastery",
        description: "Void Fracture cooldown reduced by 8s.",
        requiresUpgrade: "wood_staff_fracture_20",
      },
    ],
    24: [
      {
        id: "wood_staff_storm_chain_24",
        level: 24,
        title: "Chain Storm",
        description: "Each storm strike can chain to a nearby enemy.",
        requiresUpgrade: "wood_staff_storm_20",
      },
      {
        id: "wood_staff_fracture_soul_24",
        level: 24,
        title: "Soul Rend",
        description: "Void Fracture heals you for 12% of total damage dealt.",
        requiresUpgrade: "wood_staff_fracture_20",
      },
    ],
    25: [
      {
        id: "wood_staff_storm_finale_25",
        level: 25,
        title: "Final Thunder",
        description: "When Storm Incarnate ends, release a capped final strike based on storm damage dealt.",
        requiresUpgrade: "wood_staff_storm_20",
      },
      {
        id: "wood_staff_fracture_twin_25",
        level: 25,
        title: "Twin Fracture",
        description: "Void Fracture fires a second burst 1.5s later at 50% power.",
        requiresUpgrade: "wood_staff_fracture_20",
      },
    ],
  },
};

const ITEM_PROGRESSION_TREES: Partial<Record<EquipmentItemId, ItemProgressionTree>> = {
  wood_staff: WOOD_STAFF_PROGRESSION_TREE,
};
const ITEM_PROGRESSION_TIERS: ItemProgressionTier[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

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
  woodStaffSpectralVolleyBonusBolts: number;
  woodStaffSpectralVolleySpreadBonusDeg: number;
  woodStaffSpectralVolleyPiercing: boolean;
  woodStaffSpectralVolleyRefundChance: number;
  grantsWoodStaffDash: boolean;
  grantsWoodStaffSlam: boolean;
  grantsWoodStaffChainStrike: boolean;
  grantsWoodStaffSpectralVolley: boolean;
  // Storm Incarnate ultimate
  grantsWoodStaffStormIncarnate: boolean;
  woodStaffStormIncarnateDurationBonusMs: number;
  woodStaffStormIncarnateStrikeDamageMultiplier: number;
  woodStaffStormIncarnateHealPerStrike: number;
  woodStaffStormIncarnateChainOnHit: boolean;
  woodStaffStormIncarnateThunderFinale: boolean;
  // Void Fracture ultimate
  grantsWoodStaffVoidFracture: boolean;
  woodStaffVoidFractureDamageMultiplierBonus: number;
  woodStaffVoidFractureStunDurationBonusMs: number;
  woodStaffVoidFractureCooldownReductionMs: number;
  woodStaffVoidFractureLifestealPercent: number;
  woodStaffVoidFractureTwinBurst: boolean;
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
  woodStaffSpectralVolleyBonusBolts: 0,
  woodStaffSpectralVolleySpreadBonusDeg: 0,
  woodStaffSpectralVolleyPiercing: false,
  woodStaffSpectralVolleyRefundChance: 0,
  grantsWoodStaffDash: false,
  grantsWoodStaffSlam: false,
  grantsWoodStaffChainStrike: false,
  grantsWoodStaffSpectralVolley: false,
  grantsWoodStaffStormIncarnate: false,
  woodStaffStormIncarnateDurationBonusMs: 0,
  woodStaffStormIncarnateStrikeDamageMultiplier: 0,
  woodStaffStormIncarnateHealPerStrike: 0,
  woodStaffStormIncarnateChainOnHit: false,
  woodStaffStormIncarnateThunderFinale: false,
  grantsWoodStaffVoidFracture: false,
  woodStaffVoidFractureDamageMultiplierBonus: 0,
  woodStaffVoidFractureStunDurationBonusMs: 0,
  woodStaffVoidFractureCooldownReductionMs: 0,
  woodStaffVoidFractureLifestealPercent: 0,
  woodStaffVoidFractureTwinBurst: false,
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

  const rawChoices = (progression?.selectedUpgradeIds ?? [])
    .map((rawId, index) => {
      const choice = getItemProgressionChoice(tree.itemId, rawId);
      return choice ? { choice, index } : null;
    })
    .filter((entry): entry is { choice: ItemProgressionChoice; index: number } => entry !== null);

  const maxUnlockedLevel = rawChoices.reduce<ItemProgressionLevel>(
    (currentMax, { choice }) => (Math.max(currentMax, choice.level) as ItemProgressionLevel),
    1,
  );

  const normalizedLevel = progression?.level
    ? (Math.max(1, Math.min(tree.maxLevel, Math.max(progression.level, maxUnlockedLevel))) as ItemProgressionLevel)
    : maxUnlockedLevel;

  const selectedUpgradeIds: ItemProgressionId[] = [];
  const seenIds = new Set<ItemProgressionId>();
  const seenLevels = new Set<ItemProgressionTier>();

  rawChoices.sort((a, b) => a.choice.level - b.choice.level || a.index - b.index).forEach(({ choice }) => {
    if (
      choice.level > normalizedLevel ||
      seenIds.has(choice.id) ||
      seenLevels.has(choice.level) ||
      (choice.requiresUpgrade && !seenIds.has(choice.requiresUpgrade))
    ) {
      return;
    }

    seenIds.add(choice.id);
    seenLevels.add(choice.level);
    selectedUpgradeIds.push(choice.id);
  });

  return {
    level: normalizedLevel,
    selectedUpgradeIds,
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

  if (choice.requiresUpgrade && !normalized.selectedUpgradeIds.includes(choice.requiresUpgrade)) {
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
        bonuses.meleeStrikeCooldownDeltaMs -= 60;
        break;
      case "wood_staff_channel_3":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.10;
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
        bonuses.meleeStrikeCooldownDeltaMs -= 80;
        break;
      case "wood_staff_power_6":
        bonuses.meleeStrikeDamageFlatBonus += 6;
        break;
      case "wood_staff_chain_jump_11":
        bonuses.woodStaffChainStrikeBonusHits += 1;
        break;
      case "wood_staff_mastery_7":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.20;
        break;
      case "wood_staff_tempest_7":
        bonuses.meleeStrikeRangeBonusPx += 20;
        bonuses.woodStaffStrikeKnockbackBonusTiles += 0.25;
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
        bonuses.meleeStrikeDamageMultiplierBonus += 0.25;
        break;
      case "wood_staff_gale_9":
        bonuses.meleeStrikeCooldownDeltaMs -= 80;
        bonuses.woodStaffStrikeKnockbackBonusTiles += 0.5;
        break;
      case "wood_staff_chain_refund_14":
        bonuses.woodStaffChainStrikeRefundChance += 0.25;
        break;
      case "wood_staff_chain_10":
        bonuses.grantsWoodStaffChainStrike = true;
        break;
      case "wood_staff_volley_10":
        bonuses.grantsWoodStaffSpectralVolley = true;
        break;
      case "wood_staff_volley_scatter_11":
        bonuses.woodStaffSpectralVolleyBonusBolts += 1;
        break;
      case "wood_staff_volley_spread_12":
        bonuses.woodStaffSpectralVolleySpreadBonusDeg += 15;
        break;
      case "wood_staff_volley_pierce_13":
        bonuses.woodStaffSpectralVolleyPiercing = true;
        break;
      case "wood_staff_volley_echo_14":
        bonuses.woodStaffSpectralVolleyRefundChance += 0.25;
        break;
      // Levels 15–19: neutral mastery
      case "wood_staff_fleet_15":
        bonuses.meleeStrikeCooldownDeltaMs -= 100;
        break;
      case "wood_staff_runic_15":
        bonuses.meleeStrikeDamageFlatBonus += 8;
        break;
      case "wood_staff_grandmaster_16":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.25;
        break;
      case "wood_staff_warlord_16":
        bonuses.woodStaffStrikeKnockbackBonusTiles += 0.75;
        bonuses.woodStaffStrikeSlowDurationMs = Math.max(bonuses.woodStaffStrikeSlowDurationMs, 1000);
        break;
      case "wood_staff_vampire_17":
        bonuses.woodStaffStrikeHealOnHit += 3;
        break;
      case "wood_staff_surge_17":
        bonuses.meleeStrikeDamageFlatBonus += 10;
        break;
      case "wood_staff_phantom_18":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.30;
        break;
      case "wood_staff_warforged_18":
        bonuses.meleeStrikeDamageFlatBonus += 8;
        bonuses.meleeStrikeCooldownDeltaMs -= 80;
        break;
      case "wood_staff_rune_19":
        bonuses.meleeStrikeDamageMultiplierBonus += 0.35;
        break;
      case "wood_staff_voidconduit_19":
        bonuses.woodStaffStrikeKnockbackBonusTiles += 1.0;
        bonuses.meleeStrikeRangeBonusPx += 16;
        break;
      // Level 20: ultimates
      case "wood_staff_storm_20":
        bonuses.grantsWoodStaffStormIncarnate = true;
        break;
      case "wood_staff_fracture_20":
        bonuses.grantsWoodStaffVoidFracture = true;
        break;
      // Levels 21–25: Storm Incarnate path
      case "wood_staff_storm_haste_21":
        bonuses.woodStaffStormIncarnateDurationBonusMs += 2000;
        break;
      case "wood_staff_storm_amp_22":
        bonuses.woodStaffStormIncarnateStrikeDamageMultiplier += 0.35;
        break;
      case "wood_staff_storm_heal_23":
        bonuses.woodStaffStormIncarnateHealPerStrike += 4;
        break;
      case "wood_staff_storm_chain_24":
        bonuses.woodStaffStormIncarnateChainOnHit = true;
        break;
      case "wood_staff_storm_finale_25":
        bonuses.woodStaffStormIncarnateThunderFinale = true;
        break;
      // Levels 21–25: Void Fracture path
      case "wood_staff_fracture_amp_21":
        bonuses.woodStaffVoidFractureDamageMultiplierBonus += 0.5;
        break;
      case "wood_staff_fracture_stun_22":
        bonuses.woodStaffVoidFractureStunDurationBonusMs += 1000;
        break;
      case "wood_staff_fracture_refund_23":
        bonuses.woodStaffVoidFractureCooldownReductionMs += 8000;
        break;
      case "wood_staff_fracture_soul_24":
        bonuses.woodStaffVoidFractureLifestealPercent += 0.12;
        break;
      case "wood_staff_fracture_twin_25":
        bonuses.woodStaffVoidFractureTwinBurst = true;
        break;
      default:
        break;
    }
  });

  return clampWoodStaffProgressionBonuses(bonuses);
}

function clampWoodStaffProgressionBonuses(bonuses: ItemProgressionBonuses): ItemProgressionBonuses {
  return {
    ...bonuses,
    meleeStrikeCooldownDeltaMs: Math.max(
      bonuses.meleeStrikeCooldownDeltaMs,
      -WOOD_STAFF_STRIKE_MAX_COOLDOWN_REDUCTION_MS,
    ),
    meleeStrikeDamageFlatBonus: Math.min(
      bonuses.meleeStrikeDamageFlatBonus,
      WOOD_STAFF_STRIKE_MAX_DAMAGE_FLAT_BONUS,
    ),
    meleeStrikeDamageMultiplierBonus: Math.min(
      bonuses.meleeStrikeDamageMultiplierBonus,
      WOOD_STAFF_STRIKE_MAX_DAMAGE_MULTIPLIER_BONUS,
    ),
    woodStaffStrikeKnockbackBonusTiles: Math.min(
      bonuses.woodStaffStrikeKnockbackBonusTiles,
      WOOD_STAFF_STRIKE_MAX_KNOCKBACK_BONUS_TILES,
    ),
    woodStaffChainStrikeRefundChance: Math.min(
      Math.max(0, bonuses.woodStaffChainStrikeRefundChance),
      WOOD_STAFF_CHAIN_STRIKE_MAX_REFUND_CHANCE,
    ),
    woodStaffSpectralVolleyRefundChance: Math.min(
      Math.max(0, bonuses.woodStaffSpectralVolleyRefundChance),
      WOOD_STAFF_SPECTRAL_VOLLEY_MAX_REFUND_CHANCE,
    ),
    woodStaffStormIncarnateStrikeDamageMultiplier: Math.min(
      bonuses.woodStaffStormIncarnateStrikeDamageMultiplier,
      0.35,
    ),
    woodStaffVoidFractureDamageMultiplierBonus: Math.min(
      bonuses.woodStaffVoidFractureDamageMultiplierBonus,
      0.5,
    ),
    woodStaffVoidFractureCooldownReductionMs: Math.min(
      bonuses.woodStaffVoidFractureCooldownReductionMs,
      8000,
    ),
  };
}

export function resolveWoodStaffStrikeDamage(
  baseDamage: number,
  bonuses: Pick<ItemProgressionBonuses, "meleeStrikeDamageFlatBonus" | "meleeStrikeDamageMultiplierBonus">,
) {
  const scaledDamage = (baseDamage + bonuses.meleeStrikeDamageFlatBonus) * (1 + bonuses.meleeStrikeDamageMultiplierBonus);
  return Math.max(1, Math.round(scaledDamage));
}

export function resolveWoodStaffStrikeCooldownMs(
  baseCooldownMs: number,
  bonuses: Pick<ItemProgressionBonuses, "meleeStrikeCooldownDeltaMs">,
) {
  return Math.max(WOOD_STAFF_STRIKE_MIN_COOLDOWN_MS, baseCooldownMs + bonuses.meleeStrikeCooldownDeltaMs);
}
