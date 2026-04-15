export type SerializedRaidMobState = {
  id: string;
  kind: string;
  name: string;
  texture: string;
  aggroTargetId: string;
  aggroLockedUntil: number;
  spawnX: number;
  spawnY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  patrolMinX: number;
  patrolMaxX: number;
  patrolY: number;
  patrolRadiusY: number;
  patrolPhase: number;
  moveSpeed: number;
  aggroRange: number;
  leashRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  attackCooldownEndsAt: number;
  castingSkillId: string;
  castStartedAt: number;
  castEndsAt: number;
  skillLungeStartedAt: number;
  skillLungeEndsAt: number;
  skillLungeFromX: number;
  skillLungeFromY: number;
  skillLungeToX: number;
  skillLungeToY: number;
  experienceReward: number;
  health: number;
  maxHealth: number;
  burnTicksRemaining: number;
  burnEndsAt: number;
  dead: boolean;
  respawnAt: number;
};

export type SerializedRaidChestState = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  x: number;
  y: number;
  slots: string[];
};

export type SerializedRaidGroundEffectState = {
  id: string;
  ownerId: string;
  skillId: string;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  expiresAt: number;
  nextTickAt: number;
};

export type RaidRuntimeState = {
  status: string;
  expiresAt: number;
  updatedAt: string;
  mobs: SerializedRaidMobState[];
  chests: SerializedRaidChestState[];
  groundEffects: SerializedRaidGroundEffectState[];
};
