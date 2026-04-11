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

export const EQUIPMENT_ITEM_IDS = ["default_staff", "fire_robe"] as const;
export type EquipmentItemId = typeof EQUIPMENT_ITEM_IDS[number];

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

export const CONSUMABLE_ITEM_IDS = ["healing_potion", "teleport_scroll"] as const;
export type ConsumableItemId = typeof CONSUMABLE_ITEM_IDS[number];

export const QUEST_ITEM_IDS = ["sealed_relic"] as const;
export type QuestItemId = typeof QUEST_ITEM_IDS[number];

export type EquippableItemId = EquipmentItemId | GemItemId;
export type ItemId = EquippableItemId | ConsumableItemId | QuestItemId;
export type ItemTier = 1 | 2 | 3;
export type GemType = "weapon" | "armor";
export type ItemType = "equipment" | "consumable" | "gem" | "quest";

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

export const ITEM_DEFINITIONS: Record<ItemId, SharedItemDefinition> = {
  default_staff: {
    id: "default_staff",
    type: "equipment",
    name: "Default Staff",
    value: 90,
    iconPath: "/items/equipment/default-staff.png",
    slot: "weapon",
    tier: 3,
    socketType: "weapon",
    socketCount: 3,
    tooltipStats: ["Unlocks Fireball", "3 gem sockets"],
    fireResistancePercent: 0,
  },
  fire_robe: {
    id: "fire_robe",
    type: "equipment",
    name: "Fire Robe",
    value: 120,
    iconPath: "/character/equipment/fire_robe/fire_robe_idle.png",
    slot: "body",
    tier: 2,
    socketType: "armor",
    socketCount: 3,
    tooltipStats: ["Body armor", "3 gem sockets"],
    fireResistancePercent: 15,
  },
  fire_trail_gem: {
    id: "fire_trail_gem",
    type: "gem",
    name: "Fire Trail Gem",
    value: 55,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Fireball leaves burning trail", "Trail lasts 5s", "+0.2s cast time"],
    fireResistancePercent: 0,
  },
  fire_shatter_gem: {
    id: "fire_shatter_gem",
    type: "gem",
    name: "Fire Shatter Gem",
    value: 70,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Fireball bursts into 9 shards", "Shards deal no direct damage"],
    fireResistancePercent: 0,
  },
  fire_return_gem: {
    id: "fire_return_gem",
    type: "gem",
    name: "Fire Return Gem",
    value: 50,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Projectiles that miss return to cast point"],
    fireResistancePercent: 0,
  },
  fire_bounce_gem: {
    id: "fire_bounce_gem",
    type: "gem",
    name: "Fire Bounce Gem",
    value: 45,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "+2 wall bounces per gem"],
    fireResistancePercent: 0,
  },
  fire_longshot_gem: {
    id: "fire_longshot_gem",
    type: "gem",
    name: "Fire Longshot Gem",
    value: 65,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "+200% projectile range", "Damage falls from 100% to 0% over distance"],
    fireResistancePercent: 0,
  },
  fire_split_gem: {
    id: "fire_split_gem",
    type: "gem",
    name: "Fire Split Gem",
    value: 60,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Fireball becomes 2 smaller shots", "Damage is split between them"],
    fireResistancePercent: 0,
  },
  fire_range_gem: {
    id: "fire_range_gem",
    type: "gem",
    name: "Fire Range Gem",
    value: 50,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "+25% cast range", "+25% fireball cooldown"],
    fireResistancePercent: 0,
  },
  cast_speed_gem: {
    id: "cast_speed_gem",
    type: "gem",
    name: "Cast Speed Gem",
    value: 70,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "-35% cast time", "-12% direct damage"],
    fireResistancePercent: 0,
  },
  pierce_gem: {
    id: "pierce_gem",
    type: "gem",
    name: "Pierce Gem",
    value: 65,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Projectile pierces 2 targets", "-18% direct damage"],
    fireResistancePercent: 0,
  },
  chain_gem: {
    id: "chain_gem",
    type: "gem",
    name: "Chain Gem",
    value: 75,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Projectile chains 2 times", "-15% direct damage"],
    fireResistancePercent: 0,
  },
  homing_gem: {
    id: "homing_gem",
    type: "gem",
    name: "Homing Gem",
    value: 70,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Projectile seeks nearby targets", "-10% projectile speed"],
    fireResistancePercent: 0,
  },
  area_gem: {
    id: "area_gem",
    type: "gem",
    name: "Area Gem",
    value: 55,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Impact deals splash damage", "-20% direct damage"],
    fireResistancePercent: 0,
  },
  duration_gem: {
    id: "duration_gem",
    type: "gem",
    name: "Duration Gem",
    value: 50,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "+50% burn and trail duration"],
    fireResistancePercent: 0,
  },
  knockback_gem: {
    id: "knockback_gem",
    type: "gem",
    name: "Knockback Gem",
    value: 45,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Hit pushes targets back"],
    fireResistancePercent: 0,
  },
  lifesteal_gem: {
    id: "lifesteal_gem",
    type: "gem",
    name: "Lifesteal Gem",
    value: 90,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Heal for 10% of direct damage dealt"],
    fireResistancePercent: 0,
  },
  execution_gem: {
    id: "execution_gem",
    type: "gem",
    name: "Execution Gem",
    value: 80,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "+50% damage to targets below 30% HP"],
    fireResistancePercent: 0,
  },
  critical_gem: {
    id: "critical_gem",
    type: "gem",
    name: "Critical Gem",
    value: 85,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "20% chance to crit for 200% damage"],
    fireResistancePercent: 0,
  },
  fire_spread_gem: {
    id: "fire_spread_gem",
    type: "gem",
    name: "Fire Spread Gem",
    value: 65,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Fires 3 projectiles in a fan", "-40% damage per projectile"],
    fireResistancePercent: 0,
  },
  fire_burst_gem: {
    id: "fire_burst_gem",
    type: "gem",
    name: "Fire Burst Gem",
    value: 60,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Fires 3 rapid shots", "-60% damage per shot", "+50% cooldown"],
    fireResistancePercent: 0,
  },
  fire_nova_impact_gem: {
    id: "fire_nova_impact_gem",
    type: "gem",
    name: "Fire Nova Impact Gem",
    value: 75,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "On hit: ring of 6 mini-projectiles", "Mini-projectiles deal 30% damage", "-25% direct damage"],
    fireResistancePercent: 0,
  },
  fire_spiral_gem: {
    id: "fire_spiral_gem",
    type: "gem",
    name: "Fire Spiral Gem",
    value: 55,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Projectile spirals in flight", "Covers wider area", "-15% projectile speed"],
    fireResistancePercent: 0,
  },
  fire_fork_gem: {
    id: "fire_fork_gem",
    type: "gem",
    name: "Fire Fork Gem",
    value: 70,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Splits into 2 at half range", "Forks deal 50% damage"],
    fireResistancePercent: 0,
  },
  fire_orbit_gem: {
    id: "fire_orbit_gem",
    type: "gem",
    name: "Fire Orbit Gem",
    value: 60,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Projectile orbits caster before launch", "0.5s delay before flight"],
    fireResistancePercent: 0,
  },
  fire_aftershock_gem: {
    id: "fire_aftershock_gem",
    type: "gem",
    name: "Fire Aftershock Gem",
    value: 70,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "Second explosion after 0.3s", "Aftershock deals 50% damage", "-15% direct damage"],
    fireResistancePercent: 0,
  },
  fire_clone_gem: {
    id: "fire_clone_gem",
    type: "gem",
    name: "Fire Clone Gem",
    value: 80,
    iconPath: "/items/gems/gem_basic.png",
    slot: "weapon-gem-1",
    gemType: "weapon",
    socketableInto: ["default_staff"],
    tooltipStats: ["Socket into staff", "On hit: clone flies to nearest enemy", "Clone deals 40% damage", "-20% direct damage"],
    fireResistancePercent: 0,
  },
  healing_potion: {
    id: "healing_potion",
    type: "consumable",
    name: "Healing Potion",
    value: 12,
    iconPath: "/pack/potion and poison asset pack/Crimson Health Elixir.png",
    tooltipStats: ["Restores 20 HP over 10s", "Cooldown: 20s", "Stacks to 5"],
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
export const TELEPORT_SCROLL_ID = "teleport_scroll" as const;

export function isItemId(value: string): value is ItemId {
  return value in ITEM_DEFINITIONS;
}

export function isGemItemId(value: string): value is GemItemId {
  return GEM_ITEM_IDS.includes(value as GemItemId);
}

export function getItemDefinition(itemId: ItemId) {
  return ITEM_DEFINITIONS[itemId];
}
