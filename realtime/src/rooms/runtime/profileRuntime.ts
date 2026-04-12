import { type BaseProfileMessage } from "@mmorpg/shared/realtime/contracts";
import { type BasePlayerState } from "../schema/BasePlayerState.js";

type RoomProfilePlayer = BasePlayerState & {
  name: string;
  role: string;
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
  fireballCooldownEndsAt: number;
  fireNovaCooldownEndsAt: number;
  fireFieldCooldownEndsAt: number;
  woodStaffStrikeCooldownEndsAt: number;
  castingSkillId: string;
  castStartedAt: number;
  castEndsAt: number;
  lastProcessedInput: number;
  dead: boolean;
  bodyItem: string;
  headItem: string;
  weaponItem: string;
  headGemItem1: string;
  headGemItem2: string;
  headGemItem3: string;
  bodyGemItem1: string;
  bodyGemItem2: string;
  bodyGemItem3: string;
  weaponGemItem1: string;
  weaponGemItem2: string;
  weaponGemItem3: string;
};

type RoomProfilePatchOptions = {
  defaultName?: string;
  defaultRole?: string;
  roleTransform?: (value: string) => string;
};

function normalizeProfileText(
  value: string | null | undefined,
  maxLength: number,
  transform?: (value: string) => string,
) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return (transform ? transform(trimmed) : trimmed).slice(0, maxLength);
}

function applyOptionalFloor(
  value: number | null | undefined,
  minValue: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(minValue, Math.floor(value));
}

export function initializeRoomPlayerTransientState(player: RoomProfilePlayer) {
  player.burnTicksRemaining = 0;
  player.burnEndsAt = 0;
  player.healingTicksRemaining = 0;
  player.healingEndsAt = 0;
  player.fireballCooldownEndsAt = 0;
  player.fireNovaCooldownEndsAt = 0;
  player.fireFieldCooldownEndsAt = 0;
  player.woodStaffStrikeCooldownEndsAt = 0;
  player.castingSkillId = "";
  player.castStartedAt = 0;
  player.castEndsAt = 0;
  player.lastProcessedInput = 0;
  player.dead = false;
}

export function applyRoomProfilePatch(
  player: RoomProfilePlayer,
  profile: Partial<BaseProfileMessage> | null | undefined,
  options: RoomProfilePatchOptions = {},
) {
  const nextName = normalizeProfileText(profile?.name, 24);
  if (nextName) {
    player.name = nextName;
  } else if (!player.name && options.defaultName) {
    player.name = options.defaultName;
  }

  const nextRole = normalizeProfileText(profile?.role, 24, options.roleTransform);
  if (nextRole) {
    player.role = nextRole;
  } else if (!player.role && options.defaultRole) {
    player.role = options.defaultRole;
  }

  const nextHealth = applyOptionalFloor(profile?.health, 0);
  if (nextHealth !== null) {
    player.health = nextHealth;
  }

  const nextMaxHealth = applyOptionalFloor(profile?.maxHealth, 1);
  if (nextMaxHealth !== null) {
    player.maxHealth = nextMaxHealth;
  }

  const nextLevel = applyOptionalFloor(profile?.level, 1);
  if (nextLevel !== null) {
    player.level = nextLevel;
  }

  const nextExperience = applyOptionalFloor(profile?.experience, 0);
  if (nextExperience !== null) {
    player.experience = nextExperience;
  }

  const nextStrength = applyOptionalFloor(profile?.strength, 1);
  if (nextStrength !== null) {
    player.strength = nextStrength;
  }

  const nextAgility = applyOptionalFloor(profile?.agility, 1);
  if (nextAgility !== null) {
    player.agility = nextAgility;
  }

  const nextIntellect = applyOptionalFloor(profile?.intellect, 1);
  if (nextIntellect !== null) {
    player.intellect = nextIntellect;
  }

  if (typeof profile?.bodyItem === "string") {
    player.bodyItem = profile.bodyItem;
  }
  if (typeof profile?.headItem === "string") {
    player.headItem = profile.headItem;
  }
  if (typeof profile?.weaponItem === "string") {
    player.weaponItem = profile.weaponItem;
  }
  if (typeof profile?.headGemItem1 === "string") {
    player.headGemItem1 = profile.headGemItem1;
  }
  if (typeof profile?.headGemItem2 === "string") {
    player.headGemItem2 = profile.headGemItem2;
  }
  if (typeof profile?.headGemItem3 === "string") {
    player.headGemItem3 = profile.headGemItem3;
  }
  if (typeof profile?.bodyGemItem1 === "string") {
    player.bodyGemItem1 = profile.bodyGemItem1;
  }
  if (typeof profile?.bodyGemItem2 === "string") {
    player.bodyGemItem2 = profile.bodyGemItem2;
  }
  if (typeof profile?.bodyGemItem3 === "string") {
    player.bodyGemItem3 = profile.bodyGemItem3;
  }
  if (typeof profile?.weaponGemItem1 === "string") {
    player.weaponGemItem1 = profile.weaponGemItem1;
  }
  if (typeof profile?.weaponGemItem2 === "string") {
    player.weaponGemItem2 = profile.weaponGemItem2;
  }
  if (typeof profile?.weaponGemItem3 === "string") {
    player.weaponGemItem3 = profile.weaponGemItem3;
  }

  if (player.health > player.maxHealth) {
    player.health = player.maxHealth;
  }
}

export function applyRoomZeroHealthState(
  player: RoomProfilePlayer,
  options: {
    clearCastState: () => void;
    resetMovement?: () => void;
  },
) {
  if (player.health > 0) {
    return false;
  }

  player.dead = true;
  player.burnTicksRemaining = 0;
  player.burnEndsAt = 0;
  player.healingTicksRemaining = 0;
  player.healingEndsAt = 0;
  options.resetMovement?.();
  options.clearCastState();
  return true;
}
