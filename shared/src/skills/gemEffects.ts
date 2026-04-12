import type { GemItemId } from "../items/catalog";

export const FIRE_TRAIL_GEM_ID = "fire_trail_gem" as const;
export const FIRE_SHATTER_GEM_ID = "fire_shatter_gem" as const;
export const FIRE_RETURN_GEM_ID = "fire_return_gem" as const;
export const FIRE_BOUNCE_GEM_ID = "fire_bounce_gem" as const;
export const FIRE_LONGSHOT_GEM_ID = "fire_longshot_gem" as const;
export const FIRE_SPLIT_GEM_ID = "fire_split_gem" as const;
export const FIRE_RANGE_GEM_ID = "fire_range_gem" as const;
export const CAST_SPEED_GEM_ID = "cast_speed_gem" as const;
export const PIERCE_GEM_ID = "pierce_gem" as const;
export const CHAIN_GEM_ID = "chain_gem" as const;
export const HOMING_GEM_ID = "homing_gem" as const;
export const AREA_GEM_ID = "area_gem" as const;
export const DURATION_GEM_ID = "duration_gem" as const;
export const KNOCKBACK_GEM_ID = "knockback_gem" as const;
export const LIFESTEAL_GEM_ID = "lifesteal_gem" as const;
export const EXECUTION_GEM_ID = "execution_gem" as const;
export const CRITICAL_GEM_ID = "critical_gem" as const;
export const FIRE_SPREAD_GEM_ID = "fire_spread_gem" as const;
export const FIRE_BURST_GEM_ID = "fire_burst_gem" as const;
export const FIRE_NOVA_IMPACT_GEM_ID = "fire_nova_impact_gem" as const;
export const FIRE_SPIRAL_GEM_ID = "fire_spiral_gem" as const;
export const FIRE_FORK_GEM_ID = "fire_fork_gem" as const;
export const FIRE_ORBIT_GEM_ID = "fire_orbit_gem" as const;
export const FIRE_AFTERSHOCK_GEM_ID = "fire_aftershock_gem" as const;
export const FIRE_CLONE_GEM_ID = "fire_clone_gem" as const;

export const FIREBALL_SHARD_SKILL_ID = "fireballShard" as const;
export const FIREBALL_SPLIT_SKILL_ID = "fireballSplit" as const;
export const PROJECTILE_SKILL_IDS = ["fireball", FIREBALL_SHARD_SKILL_ID, FIREBALL_SPLIT_SKILL_ID] as const;

export type GemTemplateData = {
  kind: "gem";
  effect: string;
  gemType?: "armor";
  [key: string]: string | number | boolean | undefined;
};

export type ProjectileGemDescriptor = {
  templateData: GemTemplateData;
  runtime?: Partial<{
    trail: boolean;
    shatter: boolean;
    returnOnMiss: boolean;
    castTimeFlatMs: number;
    bounceCountMultiplier: number;
    projectileRangeMultiplier: number;
    castRangeMultiplier: number;
    cooldownMultiplier: number;
    castTimeMultiplier: number;
    directDamageMultiplier: number;
    projectileSpeedMultiplier: number;
    splitProjectile: boolean;
    pierceCount: number;
    chainCount: number;
    homingStrength: number;
    splashRadius: number;
    splashDamageScale: number;
    durationMultiplier: number;
    knockbackDistance: number;
    lifestealRatio: number;
    executionThreshold: number;
    executionDamageMultiplier: number;
    criticalChance: number;
    criticalDamageMultiplier: number;
    spreadCount: number;
    spreadAngleDeg: number;
    burstCount: number;
    burstDelayMs: number;
    novaImpactCount: number;
    novaImpactDamageScale: number;
    spiralAmplitude: number;
    spiralFrequency: number;
    fork: boolean;
    forkDamageScale: number;
    orbitDurationMs: number;
    orbitRadius: number;
    aftershockDelayMs: number;
    aftershockDamageScale: number;
    cloneOnHit: boolean;
    cloneDamageScale: number;
    projectileOnly: boolean;
    fireballOnly: boolean;
    countStacks: boolean;
  }>;
};

export const GEM_EFFECT_DESCRIPTORS: Record<GemItemId, ProjectileGemDescriptor> = {
  fire_trail_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_trail",
      durationMs: 5000,
      castTimePenaltyMs: 200,
    },
    runtime: {
      trail: true,
      castTimeFlatMs: 200,
      projectileOnly: true,
    },
  },
  fire_shatter_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_shatter",
      shardCount: 9,
      directDamage: 0,
    },
    runtime: {
      shatter: true,
    },
  },
  fire_return_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_return",
      returnsOnMiss: true,
    },
    runtime: {
      returnOnMiss: true,
      projectileOnly: true,
    },
  },
  fire_bounce_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_bounce",
      bounces: 2,
    },
    runtime: {
      bounceCountMultiplier: 1,
      projectileOnly: true,
      countStacks: true,
    },
  },
  fire_longshot_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_longshot",
      rangeMultiplier: 3,
      damageFalloffToZero: true,
    },
    runtime: {
      projectileRangeMultiplier: 3,
      projectileOnly: true,
    },
  },
  fire_split_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_split",
      projectileCount: 2,
      damageScale: 0.5,
    },
    runtime: {
      splitProjectile: true,
      fireballOnly: true,
    },
  },
  fire_range_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_range",
      castRangeMultiplier: 1.25,
      cooldownMultiplier: 1.25,
    },
    runtime: {
      castRangeMultiplier: 1.25,
      cooldownMultiplier: 1.25,
    },
  },
  cast_speed_gem: {
    templateData: {
      kind: "gem",
      effect: "cast_speed",
      castTimeMultiplier: 0.65,
      damageMultiplier: 0.88,
    },
    runtime: {
      castTimeMultiplier: 0.65,
      directDamageMultiplier: 0.88,
    },
  },
  pierce_gem: {
    templateData: {
      kind: "gem",
      effect: "pierce",
      pierceCount: 2,
      damageMultiplier: 0.82,
    },
    runtime: {
      pierceCount: 2,
      directDamageMultiplier: 0.82,
      projectileOnly: true,
    },
  },
  chain_gem: {
    templateData: {
      kind: "gem",
      effect: "chain",
      chains: 2,
      damageMultiplier: 0.85,
    },
    runtime: {
      chainCount: 2,
      directDamageMultiplier: 0.85,
      projectileOnly: true,
    },
  },
  homing_gem: {
    templateData: {
      kind: "gem",
      effect: "homing",
      homingStrength: 3.2,
      projectileSpeedMultiplier: 0.9,
    },
    runtime: {
      homingStrength: 3.2,
      projectileSpeedMultiplier: 0.9,
      projectileOnly: true,
    },
  },
  area_gem: {
    templateData: {
      kind: "gem",
      effect: "area",
      splashRadius: 48,
      splashDamageScale: 0.6,
      damageMultiplier: 0.8,
    },
    runtime: {
      splashRadius: 48,
      splashDamageScale: 0.6,
      directDamageMultiplier: 0.8,
      projectileOnly: true,
    },
  },
  duration_gem: {
    templateData: {
      kind: "gem",
      effect: "duration",
      durationMultiplier: 1.5,
    },
    runtime: {
      durationMultiplier: 1.5,
    },
  },
  knockback_gem: {
    templateData: {
      kind: "gem",
      effect: "knockback",
      knockbackDistance: 28,
    },
    runtime: {
      knockbackDistance: 28,
      projectileOnly: true,
    },
  },
  lifesteal_gem: {
    templateData: {
      kind: "gem",
      effect: "lifesteal",
      lifestealRatio: 0.1,
    },
    runtime: {
      lifestealRatio: 0.1,
      projectileOnly: true,
    },
  },
  execution_gem: {
    templateData: {
      kind: "gem",
      effect: "execution",
      threshold: 0.3,
      damageMultiplier: 1.5,
    },
    runtime: {
      executionThreshold: 0.3,
      executionDamageMultiplier: 1.5,
      projectileOnly: true,
    },
  },
  critical_gem: {
    templateData: {
      kind: "gem",
      effect: "critical",
      critChance: 0.2,
      critMultiplier: 2,
    },
    runtime: {
      criticalChance: 0.2,
      criticalDamageMultiplier: 2,
      projectileOnly: true,
    },
  },
  fire_spread_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_spread",
      projectileCount: 3,
      spreadAngleDeg: 15,
      damageMultiplier: 0.6,
    },
    runtime: {
      spreadCount: 3,
      spreadAngleDeg: 15,
      directDamageMultiplier: 0.6,
      fireballOnly: true,
    },
  },
  fire_burst_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_burst",
      shotCount: 3,
      delayMs: 100,
      damageMultiplier: 0.4,
      cooldownMultiplier: 1.5,
    },
    runtime: {
      burstCount: 3,
      burstDelayMs: 100,
      directDamageMultiplier: 0.4,
      cooldownMultiplier: 1.5,
      fireballOnly: true,
    },
  },
  fire_nova_impact_gem: {
    templateData: {
      kind: "gem",
      effect: "nova_impact",
      novaCount: 6,
      novaDamageScale: 0.3,
      damageMultiplier: 0.75,
    },
    runtime: {
      novaImpactCount: 6,
      novaImpactDamageScale: 0.3,
      directDamageMultiplier: 0.75,
      projectileOnly: true,
    },
  },
  fire_spiral_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_spiral",
      amplitude: 24,
      frequency: 8,
      speedMultiplier: 0.85,
    },
    runtime: {
      spiralAmplitude: 24,
      spiralFrequency: 8,
      projectileSpeedMultiplier: 0.85,
      projectileOnly: true,
    },
  },
  fire_fork_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_fork",
      forkDamageScale: 0.5,
    },
    runtime: {
      fork: true,
      forkDamageScale: 0.5,
      projectileOnly: true,
    },
  },
  fire_orbit_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_orbit",
      orbitDurationMs: 500,
      orbitRadius: 40,
    },
    runtime: {
      orbitDurationMs: 500,
      orbitRadius: 40,
      fireballOnly: true,
    },
  },
  fire_aftershock_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_aftershock",
      delayMs: 300,
      aftershockDamageScale: 0.5,
      damageMultiplier: 0.85,
    },
    runtime: {
      aftershockDelayMs: 300,
      aftershockDamageScale: 0.5,
      directDamageMultiplier: 0.85,
      projectileOnly: true,
    },
  },
  fire_clone_gem: {
    templateData: {
      kind: "gem",
      effect: "fire_clone",
      cloneDamageScale: 0.4,
      damageMultiplier: 0.8,
    },
    runtime: {
      cloneOnHit: true,
      cloneDamageScale: 0.4,
      directDamageMultiplier: 0.8,
      projectileOnly: true,
    },
  },
};

export function createGemTemplateData(gemItemId: GemItemId): GemTemplateData {
  return {
    ...GEM_EFFECT_DESCRIPTORS[gemItemId].templateData,
  };
}
