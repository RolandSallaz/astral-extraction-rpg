import { ITEM_DEFINITIONS as SHARED_ITEM_DEFINITIONS, type ItemId } from '@mmorpg/shared/items/catalog';
import { createGemTemplateData } from '@mmorpg/shared/skills/gemEffects';

type DefaultItemTemplate = {
  code: string;
  name: string;
  slot: string | null;
  iconPath: string;
  value: number;
  stackable?: boolean;
  maxStack?: number;
  data?: Record<string, unknown>;
};

const RAW_DEFAULT_ITEM_TEMPLATES: ReadonlyArray<DefaultItemTemplate> = [
  {
    code: 'magic_hat',
    name: 'Magic Hat',
    slot: 'head',
    iconPath: '/items/equipment/magic-hat.png',
    value: 45,
    data: {
      socketCount: 1,
      tier: 1,
      socketType: 'armor',
    },
  },
  {
    code: 'robe_tunic',
    name: 'Robe Tunic',
    slot: 'body',
    iconPath: '/items/equipment/robe-tunic-8x8.png',
    value: 70,
    data: {
      socketCount: 2,
      tier: 2,
      socketType: 'armor',
      resistances: {
        fire: 0.2,
      },
    },
  },
  {
    code: 'default_staff',
    name: 'Default Staff',
    slot: 'weapon',
    iconPath: '/items/equipment/default-staff.png',
    value: 90,
    data: {
      socketCount: 3,
      tier: 3,
      socketType: 'weapon',
    },
  },
  {
    code: 'fire_trail_gem',
    name: 'Fire Trail Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 55,
    data: createGemTemplateData('fire_trail_gem'),
  },
  {
    code: 'fire_shatter_gem',
    name: 'Fire Shatter Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 70,
    data: createGemTemplateData('fire_shatter_gem'),
  },
  {
    code: 'fire_return_gem',
    name: 'Fire Return Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 50,
    data: createGemTemplateData('fire_return_gem'),
  },
  {
    code: 'fire_bounce_gem',
    name: 'Fire Bounce Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 45,
    data: createGemTemplateData('fire_bounce_gem'),
  },
  {
    code: 'fire_longshot_gem',
    name: 'Fire Longshot Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 65,
    data: createGemTemplateData('fire_longshot_gem'),
  },
  {
    code: 'fire_split_gem',
    name: 'Fire Split Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 60,
    data: createGemTemplateData('fire_split_gem'),
  },
  {
    code: 'fire_range_gem',
    name: 'Fire Range Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 50,
    data: createGemTemplateData('fire_range_gem'),
  },
  {
    code: 'cast_speed_gem',
    name: 'Cast Speed Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 70,
    data: createGemTemplateData('cast_speed_gem'),
  },
  {
    code: 'pierce_gem',
    name: 'Pierce Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 65,
    data: createGemTemplateData('pierce_gem'),
  },
  {
    code: 'chain_gem',
    name: 'Chain Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 75,
    data: createGemTemplateData('chain_gem'),
  },
  {
    code: 'homing_gem',
    name: 'Homing Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 70,
    data: createGemTemplateData('homing_gem'),
  },
  {
    code: 'area_gem',
    name: 'Area Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 55,
    data: createGemTemplateData('area_gem'),
  },
  {
    code: 'duration_gem',
    name: 'Duration Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 50,
    data: createGemTemplateData('duration_gem'),
  },
  {
    code: 'knockback_gem',
    name: 'Knockback Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 45,
    data: createGemTemplateData('knockback_gem'),
  },
  {
    code: 'lifesteal_gem',
    name: 'Lifesteal Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 90,
    data: createGemTemplateData('lifesteal_gem'),
  },
  {
    code: 'execution_gem',
    name: 'Execution Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 80,
    data: createGemTemplateData('execution_gem'),
  },
  {
    code: 'critical_gem',
    name: 'Critical Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 85,
    data: createGemTemplateData('critical_gem'),
  },
  {
    code: 'fire_spread_gem',
    name: 'Fire Spread Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 65,
    data: createGemTemplateData('fire_spread_gem'),
  },
  {
    code: 'fire_burst_gem',
    name: 'Fire Burst Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 60,
    data: createGemTemplateData('fire_burst_gem'),
  },
  {
    code: 'fire_nova_impact_gem',
    name: 'Impact Nova Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 75,
    data: createGemTemplateData('fire_nova_impact_gem'),
  },
  {
    code: 'fire_spiral_gem',
    name: 'Fire Spiral Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 55,
    data: createGemTemplateData('fire_spiral_gem'),
  },
  {
    code: 'fire_fork_gem',
    name: 'Fire Fork Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 70,
    data: createGemTemplateData('fire_fork_gem'),
  },
  {
    code: 'fire_orbit_gem',
    name: 'Fire Orbit Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 60,
    data: createGemTemplateData('fire_orbit_gem'),
  },
  {
    code: 'fire_aftershock_gem',
    name: 'Aftershock Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 70,
    data: createGemTemplateData('fire_aftershock_gem'),
  },
  {
    code: 'fire_clone_gem',
    name: 'Fire Clone Gem',
    slot: 'weapon-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 80,
    data: createGemTemplateData('fire_clone_gem'),
  },
  {
    code: 'guard_gem',
    name: 'Guard Gem',
    slot: 'armor-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 40,
    data: createGemTemplateData('guard_gem'),
  },
  {
    code: 'focus_gem',
    name: 'Focus Gem',
    slot: 'armor-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 50,
    data: createGemTemplateData('focus_gem'),
  },
  {
    code: 'vitality_gem',
    name: 'Vitality Gem',
    slot: 'armor-gem',
    iconPath: '/items/gems/gem_basic.png',
    value: 55,
    data: createGemTemplateData('vitality_gem'),
  },
  {
    code: 'healing_potion',
    name: 'Healing Potion',
    slot: null,
    iconPath: '/pack/potion and poison asset pack/Crimson Health Elixir.png',
    value: 12,
    stackable: true,
    maxStack: 5,
    data: {
      kind: 'consumable',
      effect: 'heal_over_time',
      totalHeal: 20,
      durationMs: 10000,
      cooldownMs: 20000,
    },
  },
  {
    code: 'teleport_scroll',
    name: 'Teleport Scroll',
    slot: null,
    iconPath: '/items/scroll.png',
    value: 32,
    stackable: true,
    maxStack: 1,
    data: {
      kind: 'consumable',
      effect: 'teleport_random',
      castTimeMs: 3000,
    },
  },
  {
    code: 'sealed_relic',
    name: 'Sealed Relic',
    slot: null,
    iconPath: '/items/gems/gem_basic.png',
    value: 0,
    data: {
      kind: 'quest',
      questId: 'sealed_relic',
    },
  },
];

export const DEFAULT_ITEM_TEMPLATES: ReadonlyArray<DefaultItemTemplate> = RAW_DEFAULT_ITEM_TEMPLATES.map((template) => {
  const sharedDefinition = SHARED_ITEM_DEFINITIONS[template.code as ItemId];
  if (!sharedDefinition) {
    return template;
  }

  return {
    ...template,
    code: sharedDefinition.id,
    name: sharedDefinition.name,
    slot: sharedDefinition.slot ?? null,
    value: sharedDefinition.value,
    stackable: sharedDefinition.stackable,
    maxStack: sharedDefinition.maxStack,
  };
});
