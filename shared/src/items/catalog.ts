export const EQUIPMENT_ITEM_SLOTS = [
  "head",
  "amulet",
  "body",
  "weapon",
  "head-gem-1",
  "head-gem-2",
  "head-gem-3",
  "weapon-gem-1",
  "weapon-gem-2",
  "weapon-gem-3",
  "body-gem-1",
  "body-gem-2",
  "body-gem-3",
  "offhand",
  "ring-1",
  "ring-2",
] as const;

export type EquipmentItemSlot = typeof EQUIPMENT_ITEM_SLOTS[number];
export type EquipmentSlot = EquipmentItemSlot;

export const BASE_EQUIPMENT_SLOTS = [
  "head",
  "amulet",
  "body",
  "weapon",
  "offhand",
  "ring-1",
  "ring-2",
] as const;

export type BaseEquipmentSlot = typeof BASE_EQUIPMENT_SLOTS[number];

export const EQUIPMENT_ITEM_IDS = [
  "wood_staff",
  "wood_staff_t2",
  "wood_staff_t3",
  "fire_robe",
  "fire_robe_t2",
  "fire_robe_t3",
] as const;
export type EquipmentItemId = typeof EQUIPMENT_ITEM_IDS[number];
export const EQUIPMENT_ITEM_BASE_IDS = ["wood_staff", "fire_robe"] as const;
export type EquipmentItemBaseId = typeof EQUIPMENT_ITEM_BASE_IDS[number];

export const GEM_ITEM_IDS = [
  "fire_trail_gem",
  "fire_shatter_gem",
  "fire_return_gem",
  "fire_bounce_gem",
  "fire_longshot_gem",
  "fire_split_gem",
  "fire_range_gem",
  "cast_speed_gem",
  "pierce_gem",
  "chain_gem",
  "homing_gem",
  "area_gem",
  "duration_gem",
  "knockback_gem",
  "lifesteal_gem",
  "execution_gem",
  "critical_gem",
  "fire_spread_gem",
  "fire_burst_gem",
  "fire_nova_impact_gem",
  "fire_spiral_gem",
  "fire_fork_gem",
  "fire_orbit_gem",
  "fire_aftershock_gem",
  "fire_clone_gem",
] as const;
export type GemItemId = typeof GEM_ITEM_IDS[number];

export const CONSUMABLE_ITEM_IDS = [
  "healing_potion",
  "poison_potion",
  "slow_potion",
  "antidote",
  "speed_potion",
  "fire_resistance_potion",
  "teleport_scroll",
] as const;
export type ConsumableItemId = typeof CONSUMABLE_ITEM_IDS[number];

export const MISC_ITEM_IDS = [
  "wood",
  "stone",
  "fire_essence",
  "lightning_essence",
  "ice_essence",
  "darkness_essence",
  "void_essence",
] as const;
export type MiscItemId = typeof MISC_ITEM_IDS[number];

export const QUEST_ITEM_IDS = ["sealed_relic"] as const;
export type QuestItemId = typeof QUEST_ITEM_IDS[number];

export type EquippableItemId = EquipmentItemId | GemItemId;
export type ItemId = EquippableItemId | ConsumableItemId | MiscItemId | QuestItemId;
export type ItemTier = 1 | 2 | 3;
export type GemType = "weapon" | "armor";
export type ItemType = "equipment" | "consumable" | "gem" | "misc" | "quest";

export type SharedItemDefinition = {
  id: ItemId;
  name: string;
  type: ItemType;
  value: number;
  iconPath: string;
  slot?: EquipmentSlot;
  tier?: ItemTier;
  socketType?: GemType;
  gemType?: GemType;
  socketableInto?: EquipmentItemId[];
  socketCount?: number;
  tooltipStats: string[];
  stackable?: boolean;
  maxStack?: number;
  fireResistancePercent?: number;
};

const LEGACY_ITEM_ID_ALIASES: Partial<Record<string, ItemId>> = {
  default_staff: "wood_staff",
};

const EQUIPMENT_ITEM_FAMILY_BY_ID: Record<EquipmentItemId, EquipmentItemBaseId> = {
  wood_staff: "wood_staff",
  wood_staff_t2: "wood_staff",
  wood_staff_t3: "wood_staff",
  fire_robe: "fire_robe",
  fire_robe_t2: "fire_robe",
  fire_robe_t3: "fire_robe",
};

const EQUIPMENT_ITEM_VARIANTS_BY_TIER: Record<EquipmentItemBaseId, Record<ItemTier, EquipmentItemId>> = {
  wood_staff: {
    1: "wood_staff",
    2: "wood_staff_t2",
    3: "wood_staff_t3",
  },
  fire_robe: {
    1: "fire_robe",
    2: "fire_robe_t2",
    3: "fire_robe_t3",
  },
};

export const ITEM_DEFINITIONS: Record<ItemId, SharedItemDefinition> = {
  wood_staff: {
    id: "wood_staff",
    type: "equipment",
    name: "Wood Staff",
    value: 10,
    iconPath: "/items/equipment/wood_staff.png",
    slot: "weapon",
    tier: 1,
    socketType: "weapon",
    socketCount: 1,
    tooltipStats: ["Melee weapon", "Astral catalyst", "1 gem socket"],
    fireResistancePercent: 0,
  },
  wood_staff_t2: {
    id: "wood_staff_t2",
    type: "equipment",
    name: "Wood Staff (Rare)",
    value: 10,
    iconPath: "/items/equipment/wood_staff.png",
    slot: "weapon",
    tier: 2,
    socketType: "weapon",
    socketCount: 2,
    tooltipStats: ["Melee weapon", "Astral catalyst", "2 gem sockets", "Rare chest drop"],
    fireResistancePercent: 0,
  },
  wood_staff_t3: {
    id: "wood_staff_t3",
    type: "equipment",
    name: "Wood Staff (Very Rare)",
    value: 10,
    iconPath: "/items/equipment/wood_staff.png",
    slot: "weapon",
    tier: 3,
    socketType: "weapon",
    socketCount: 3,
    tooltipStats: ["Melee weapon", "Astral catalyst", "3 gem sockets", "Very rare chest drop"],
    fireResistancePercent: 0,
  },
  fire_robe: {
    id: "fire_robe",
    type: "equipment",
    name: "Fire Robe",
    value: 120,
    iconPath: "/character/equipment/fire_robe/fire_robe_idle.png",
    slot: "body",
    tier: 1,
    socketType: "armor",
    socketCount: 1,
    tooltipStats: ["Body armor", "1 gem socket"],
    fireResistancePercent: 15,
  },
  fire_robe_t2: {
    id: "fire_robe_t2",
    type: "equipment",
    name: "Fire Robe (Rare)",
    value: 120,
    iconPath: "/character/equipment/fire_robe/fire_robe_idle.png",
    slot: "body",
    tier: 2,
    socketType: "armor",
    socketCount: 2,
    tooltipStats: ["Body armor", "2 gem sockets", "Rare chest drop"],
    fireResistancePercent: 15,
  },
  fire_robe_t3: {
    id: "fire_robe_t3",
    type: "equipment",
    name: "Fire Robe (Very Rare)",
    value: 120,
    iconPath: "/character/equipment/fire_robe/fire_robe_idle.png",
    slot: "body",
    tier: 3,
    socketType: "armor",
    socketCount: 3,
    tooltipStats: ["Body armor", "3 gem sockets", "Very rare chest drop"],
    fireResistancePercent: 15,
  },
  fire_trail_gem: {
    id: "fire_trail_gem",
    type: "gem",
    name: "Fire Trail Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Fireball leaves burning trail", "Trail lasts 5s", "+0.2s cast time"],
    fireResistancePercent: 0,
  },
  fire_shatter_gem: {
    id: "fire_shatter_gem",
    type: "gem",
    name: "Fire Shatter Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Fireball bursts into 9 shards", "Shards deal no direct damage"],
    fireResistancePercent: 0,
  },
  fire_return_gem: {
    id: "fire_return_gem",
    type: "gem",
    name: "Fire Return Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Projectiles that miss return to cast point"],
    fireResistancePercent: 0,
  },
  fire_bounce_gem: {
    id: "fire_bounce_gem",
    type: "gem",
    name: "Fire Bounce Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "+2 wall bounces per gem"],
    fireResistancePercent: 0,
  },
  fire_longshot_gem: {
    id: "fire_longshot_gem",
    type: "gem",
    name: "Fire Longshot Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "+200% projectile range", "Damage falls from 100% to 0% over distance"],
    fireResistancePercent: 0,
  },
  fire_split_gem: {
    id: "fire_split_gem",
    type: "gem",
    name: "Fire Split Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Fireball becomes 2 smaller shots", "Damage is split between them"],
    fireResistancePercent: 0,
  },
  fire_range_gem: {
    id: "fire_range_gem",
    type: "gem",
    name: "Fire Range Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "+25% cast range", "+25% fireball cooldown"],
    fireResistancePercent: 0,
  },
  cast_speed_gem: {
    id: "cast_speed_gem",
    type: "gem",
    name: "Cast Speed Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "-35% cast time", "-12% direct damage"],
    fireResistancePercent: 0,
  },
  pierce_gem: {
    id: "pierce_gem",
    type: "gem",
    name: "Pierce Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Projectile pierces 2 targets", "-18% direct damage"],
    fireResistancePercent: 0,
  },
  chain_gem: {
    id: "chain_gem",
    type: "gem",
    name: "Chain Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Projectile chains 2 times", "-15% direct damage"],
    fireResistancePercent: 0,
  },
  homing_gem: {
    id: "homing_gem",
    type: "gem",
    name: "Homing Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Projectile seeks nearby targets", "-10% projectile speed"],
    fireResistancePercent: 0,
  },
  area_gem: {
    id: "area_gem",
    type: "gem",
    name: "Area Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Impact deals splash damage", "-20% direct damage"],
    fireResistancePercent: 0,
  },
  duration_gem: {
    id: "duration_gem",
    type: "gem",
    name: "Duration Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "+50% burn and trail duration"],
    fireResistancePercent: 0,
  },
  knockback_gem: {
    id: "knockback_gem",
    type: "gem",
    name: "Knockback Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Hit pushes targets back"],
    fireResistancePercent: 0,
  },
  lifesteal_gem: {
    id: "lifesteal_gem",
    type: "gem",
    name: "Lifesteal Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Heal for 10% of direct damage dealt"],
    fireResistancePercent: 0,
  },
  execution_gem: {
    id: "execution_gem",
    type: "gem",
    name: "Execution Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "+50% damage to targets below 30% HP"],
    fireResistancePercent: 0,
  },
  critical_gem: {
    id: "critical_gem",
    type: "gem",
    name: "Critical Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "20% chance to crit for 200% damage"],
    fireResistancePercent: 0,
  },
  fire_spread_gem: {
    id: "fire_spread_gem",
    type: "gem",
    name: "Fire Spread Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Fires 3 projectiles in a fan", "-40% damage per projectile"],
    fireResistancePercent: 0,
  },
  fire_burst_gem: {
    id: "fire_burst_gem",
    type: "gem",
    name: "Fire Burst Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Fires 3 rapid shots", "-60% damage per shot", "+50% cooldown"],
    fireResistancePercent: 0,
  },
  fire_nova_impact_gem: {
    id: "fire_nova_impact_gem",
    type: "gem",
    name: "Fire Nova Impact Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "On hit: ring of 6 mini-projectiles", "Mini-projectiles deal 30% damage", "-25% direct damage"],
    fireResistancePercent: 0,
  },
  fire_spiral_gem: {
    id: "fire_spiral_gem",
    type: "gem",
    name: "Fire Spiral Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Projectile spirals in flight", "Covers wider area", "-15% projectile speed"],
    fireResistancePercent: 0,
  },
  fire_fork_gem: {
    id: "fire_fork_gem",
    type: "gem",
    name: "Fire Fork Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Splits into 2 at half range", "Forks deal 50% damage"],
    fireResistancePercent: 0,
  },
  fire_orbit_gem: {
    id: "fire_orbit_gem",
    type: "gem",
    name: "Fire Orbit Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Projectile orbits caster before launch", "0.5s delay before flight"],
    fireResistancePercent: 0,
  },
  fire_aftershock_gem: {
    id: "fire_aftershock_gem",
    type: "gem",
    name: "Fire Aftershock Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "Second explosion after 0.3s", "Aftershock deals 50% damage", "-15% direct damage"],
    fireResistancePercent: 0,
  },
  fire_clone_gem: {
    id: "fire_clone_gem",
    type: "gem",
    name: "Fire Clone Gem",
    value: 300,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["wood_staff"],
    tooltipStats: ["Socket into staff", "On hit: clone flies to nearest enemy", "Clone deals 40% damage", "-20% direct damage"],
    fireResistancePercent: 0,
  },
  healing_potion: {
    id: "healing_potion",
    type: "consumable",
    name: "Healing Potion",
    value: 12,
    iconPath: "/sprites/consumables/healing-potion-white.png",
    tooltipStats: ["Restores 20 HP over 10s", "Cooldown: 20s", "Stacks to 5"],
    stackable: true,
    maxStack: 5,
    fireResistancePercent: 0,
  },
  poison_potion: {
    id: "poison_potion",
    type: "consumable",
    name: "Poison Potion",
    value: 14,
    iconPath: "/sprites/consumables/healing-potion-white.png",
    tooltipStats: ["Poisons targets for 18 damage over 6s", "Thrown only", "Cooldown: 16s", "Stacks to 5"],
    stackable: true,
    maxStack: 5,
    fireResistancePercent: 0,
  },
  slow_potion: {
    id: "slow_potion",
    type: "consumable",
    name: "Slow Potion",
    value: 16,
    iconPath: "/sprites/consumables/healing-potion-white.png",
    tooltipStats: ["Slows targets by 40% for 5s", "Thrown only", "Cooldown: 18s", "Stacks to 5"],
    stackable: true,
    maxStack: 5,
    fireResistancePercent: 0,
  },
  antidote: {
    id: "antidote",
    type: "consumable",
    name: "Antidote",
    value: 10,
    iconPath: "/sprites/consumables/healing-potion-white.png",
    tooltipStats: ["Instantly removes poison", "Cooldown: 10s", "Stacks to 5"],
    stackable: true,
    maxStack: 5,
    fireResistancePercent: 0,
  },
  speed_potion: {
    id: "speed_potion",
    type: "consumable",
    name: "Speed Potion",
    value: 18,
    iconPath: "/sprites/consumables/healing-potion-white.png",
    tooltipStats: ["Increases speed by 40% for 8s", "Cooldown: 30s", "Stacks to 5"],
    stackable: true,
    maxStack: 5,
    fireResistancePercent: 0,
  },
  fire_resistance_potion: {
    id: "fire_resistance_potion",
    type: "consumable",
    name: "Fire Resistance Potion",
    value: 20,
    iconPath: "/sprites/consumables/healing-potion-white.png",
    tooltipStats: ["Reduces fire damage by 50% for 12s", "Cooldown: 30s", "Stacks to 5"],
    stackable: true,
    maxStack: 5,
    fireResistancePercent: 0,
  },
  teleport_scroll: {
    id: "teleport_scroll",
    type: "consumable",
    name: "Teleport Scroll",
    value: 32,
    iconPath: "/items/scroll.png",
    tooltipStats: ["3s use time", "Teleports to random floor tile", "Stacks to 1"],
    stackable: true,
    maxStack: 1,
    fireResistancePercent: 0,
  },
  wood: {
    id: "wood",
    type: "misc",
    name: "Wood",
    value: 2,
    iconPath: "/items/resources/wood_1.png",
    tooltipStats: ["Common loot item", "Can be found in chests", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  stone: {
    id: "stone",
    type: "misc",
    name: "Stone",
    value: 2,
    iconPath: "/items/resources/stone-16x16.png",
    tooltipStats: ["Common loot item", "Solid crafting material", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  fire_essence: {
    id: "fire_essence",
    type: "misc",
    name: "Fire Essence",
    value: 6,
    iconPath: "/items/resources/fire-essence-16x16.png",
    tooltipStats: ["Elemental crafting reagent", "Warm to the touch", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  lightning_essence: {
    id: "lightning_essence",
    type: "misc",
    name: "Lightning Essence",
    value: 6,
    iconPath: "/items/resources/lightning-essence-16x16.png",
    tooltipStats: ["Elemental crafting reagent", "Crackles with static", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  ice_essence: {
    id: "ice_essence",
    type: "misc",
    name: "Ice Essence",
    value: 6,
    iconPath: "/items/resources/ice-essence-16x16.png",
    tooltipStats: ["Elemental crafting reagent", "Cold and pristine", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  darkness_essence: {
    id: "darkness_essence",
    type: "misc",
    name: "Darkness Essence",
    value: 6,
    iconPath: "/items/resources/darkness-essence-16x16.png",
    tooltipStats: ["Elemental crafting reagent", "Swallows nearby light", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  void_essence: {
    id: "void_essence",
    type: "misc",
    name: "Void Essence",
    value: 6,
    iconPath: "/items/resources/void-essence-16x16.png",
    tooltipStats: ["Elemental crafting reagent", "Hums with empty space", "Stacks to 99"],
    stackable: true,
    maxStack: 99,
    fireResistancePercent: 0,
  },
  sealed_relic: {
    id: "sealed_relic",
    type: "quest",
    name: "Sealed Relic",
    value: 0,
    iconPath: "/items/gems/gem_basic.png",
    tooltipStats: ["Quest item", "Bring it back to the Old Mage", "Cannot be sold or used"],
    fireResistancePercent: 0,
  },
};

export const ITEM_IDS = Object.keys(ITEM_DEFINITIONS) as ItemId[];
export const INVENTORY_SIZE = 24;
export const EMPTY_ITEM_SLOT = "" as const;
export const ALLOWED_ITEM_IDS = new Set<string>([EMPTY_ITEM_SLOT, ...ITEM_IDS]);
export const HEALING_POTION_ID = "healing_potion" as const;
export const POISON_POTION_ID = "poison_potion" as const;
export const SLOW_POTION_ID = "slow_potion" as const;
export const ANTIDOTE_ID = "antidote" as const;
export const SPEED_POTION_ID = "speed_potion" as const;
export const FIRE_RESISTANCE_POTION_ID = "fire_resistance_potion" as const;
export const TELEPORT_SCROLL_ID = "teleport_scroll" as const;

export function isItemId(value: string): value is ItemId {
  return value in ITEM_DEFINITIONS;
}

export function canonicalizeItemId(value: string | null | undefined): ItemId | null {
  if (!value) {
    return null;
  }

  const canonical = LEGACY_ITEM_ID_ALIASES[value] ?? value;
  return isItemId(canonical) ? canonical : null;
}

export function isGemItemId(value: string): value is GemItemId {
  return GEM_ITEM_IDS.includes(value as GemItemId);
}

export function isEquipmentItemId(value: string): value is EquipmentItemId {
  return EQUIPMENT_ITEM_IDS.includes(value as EquipmentItemId);
}

export function getEquipmentItemBaseId(itemId: string | null | undefined): EquipmentItemBaseId | null {
  if (!itemId || !isEquipmentItemId(itemId)) {
    return null;
  }

  return EQUIPMENT_ITEM_FAMILY_BY_ID[itemId];
}

export function isSameEquipmentItemFamily(
  leftItemId: string | null | undefined,
  rightItemId: string | null | undefined,
) {
  const leftBaseId = getEquipmentItemBaseId(leftItemId);
  const rightBaseId = getEquipmentItemBaseId(rightItemId);
  return leftBaseId !== null && leftBaseId === rightBaseId;
}

export function resolveEquipmentItemTierVariant(
  itemId: string | null | undefined,
  tier: ItemTier,
): EquipmentItemId | null {
  const baseId = getEquipmentItemBaseId(itemId);
  if (!baseId) {
    return null;
  }

  return EQUIPMENT_ITEM_VARIANTS_BY_TIER[baseId][tier] ?? null;
}

export function getItemDefinition(itemId: ItemId) {
  return ITEM_DEFINITIONS[itemId];
}

