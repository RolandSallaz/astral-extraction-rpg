export type NetworkPlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  strength: number;
  agility: number;
  intellect: number;
  burnTicksRemaining: number;
  burnEndsAt: number;
  healingTicksRemaining: number;
  healingEndsAt: number;
  woodStaffStrikeCooldownEndsAt: number;
  woodStaffDashCooldownEndsAt: number;
  fireballCooldownEndsAt: number;
  fireNovaCooldownEndsAt: number;
  fireFieldCooldownEndsAt: number;
  castingSkillId?: string;
  castStartedAt?: number;
  castEndsAt?: number;
  lastProcessedInput?: number;
  dead: boolean;
  bodyItem: string;
  headItem: string;
  weaponItem: string;
  headGemItem1?: string;
  headGemItem2?: string;
  headGemItem3?: string;
  bodyGemItem1?: string;
  bodyGemItem2?: string;
  bodyGemItem3?: string;
  weaponGemItem1?: string;
  weaponGemItem2?: string;
  weaponGemItem3?: string;
};

export type NetworkGroundEffectState = {
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

export type NetworkChestState = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  x: number;
  y: number;
  slots: string[];
};

export function getChestTextureKey(chest: Pick<NetworkChestState, 'subtitle'>) {
  return chest.subtitle === 'Dropped Loot' ? 'loot-bag-8x8' : 'chest-8x8';
}

export type NetworkMobState = {
  id: string;
  name: string;
  texture: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  health: number;
  maxHealth: number;
  burnTicksRemaining: number;
  burnEndsAt: number;
  castingSkillId: string;
  castStartedAt: number;
  castEndsAt: number;
  skillLungeStartedAt: number;
  skillLungeEndsAt: number;
  attackCooldownMs: number;
  attackCooldownEndsAt: number;
  dead: boolean;
};

export type NetworkProjectileState = {
  id: string;
  ownerId: string;
  skillId: string;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  lifetime: number;
};

export function getWorldStampTextureKey(texturePath: string) {
  return `world-stamp:${encodeURIComponent(texturePath)}`;
}

import type { Room } from '@colyseus/sdk';

export type WorldRoom = Room<{
  players: Map<string, NetworkPlayerState>;
  mobs: Map<string, NetworkMobState>;
  chests: Map<string, NetworkChestState>;
  groundEffects: Map<string, NetworkGroundEffectState>;
  projectiles: Map<string, NetworkProjectileState>;
}>;

export type RaidNetworkPlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  level?: number;
  experience?: number;
  burnTicksRemaining?: number;
  burnEndsAt?: number;
  healingTicksRemaining?: number;
  healingEndsAt?: number;
  woodStaffStrikeCooldownEndsAt?: number;
  woodStaffDashCooldownEndsAt?: number;
  fireballCooldownEndsAt?: number;
  fireNovaCooldownEndsAt?: number;
  fireFieldCooldownEndsAt?: number;
  castingSkillId?: string;
  castStartedAt?: number;
  castEndsAt?: number;
  bodyItem?: string;
  headItem?: string;
  weaponItem?: string;
  dead?: boolean;
  lastProcessedInput?: number;
};

export type PendingRaidInputSample = {
  sequence: number;
  x: number;
  y: number;
  durationMs: number;
};

export type PendingWorldInputSample = {
  sequence: number;
  x: number;
  y: number;
  durationMs: number;
};

export type RaidRoom = Room<{
  raidRunId: string;
  templateCode: string;
  templateName: string;
  biome: string;
  seed: string;
  status: string;
  width: number;
  height: number;
  tiles: string[];
  rooms: string[];
  spawnPoints: string[];
  exitPoints: string[];
  players: Map<string, RaidNetworkPlayerState>;
  mobs: Map<string, NetworkMobState>;
  chests: Map<string, NetworkChestState>;
  groundEffects: Map<string, NetworkGroundEffectState>;
  projectiles: Map<string, NetworkProjectileState>;
}>;

export type RealtimeRoom = WorldRoom | RaidRoom;
