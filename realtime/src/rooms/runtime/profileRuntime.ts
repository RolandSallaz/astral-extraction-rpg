import { createEquipmentStateSnapshot, type BaseProfileMessage } from "@mmorpg/shared/realtime/contracts";
import { GEMS_ENABLED } from "@mmorpg/shared/items/catalog";
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
  poisonTicksRemaining: number;
  poisonEndsAt: number;
  healingTicksRemaining: number;
  healingEndsAt: number;
  fireballCooldownEndsAt: number;
  fireNovaCooldownEndsAt: number;
  fireFieldCooldownEndsAt: number;
  woodStaffStrikeCooldownEndsAt: number;
  woodStaffDashCooldownEndsAt: number;
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
  allowVitalsSync?: boolean;
  allowStatsSync?: boolean;
  allowEquipmentSync?: boolean;
  defaultWeaponItem?: string;
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
  player.poisonTicksRemaining = 0;
  player.poisonEndsAt = 0;
  player.healingTicksRemaining = 0;
  player.healingEndsAt = 0;
  player.fireballCooldownEndsAt = 0;
  player.fireNovaCooldownEndsAt = 0;
  player.fireFieldCooldownEndsAt = 0;
  player.woodStaffStrikeCooldownEndsAt = 0;
  player.woodStaffDashCooldownEndsAt = 0;
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

  if (options.allowVitalsSync !== false) {
    const nextHealth = applyOptionalFloor(profile?.health, 0);
    if (nextHealth !== null) {
      player.health = nextHealth;
    }

    const nextMaxHealth = applyOptionalFloor(profile?.maxHealth, 1);
    if (nextMaxHealth !== null) {
      player.maxHealth = nextMaxHealth;
    }
  }

  if (options.allowStatsSync !== false) {
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
  }

  if (options.allowEquipmentSync !== false) {
    const nextEquipment = createEquipmentStateSnapshot(profile ?? {});
    player.bodyItem = nextEquipment.body ?? player.bodyItem;
    player.headItem = nextEquipment.head ?? player.headItem;
    player.weaponItem = nextEquipment.weapon ?? player.weaponItem;
    player.headGemItem1 = GEMS_ENABLED ? nextEquipment["head-gem-1"] ?? player.headGemItem1 : "";
    player.headGemItem2 = GEMS_ENABLED ? nextEquipment["head-gem-2"] ?? player.headGemItem2 : "";
    player.headGemItem3 = GEMS_ENABLED ? nextEquipment["head-gem-3"] ?? player.headGemItem3 : "";
    player.bodyGemItem1 = GEMS_ENABLED ? nextEquipment["body-gem-1"] ?? player.bodyGemItem1 : "";
    player.bodyGemItem2 = GEMS_ENABLED ? nextEquipment["body-gem-2"] ?? player.bodyGemItem2 : "";
    player.bodyGemItem3 = GEMS_ENABLED ? nextEquipment["body-gem-3"] ?? player.bodyGemItem3 : "";
    player.weaponGemItem1 = GEMS_ENABLED ? nextEquipment["weapon-gem-1"] ?? player.weaponGemItem1 : "";
    player.weaponGemItem2 = GEMS_ENABLED ? nextEquipment["weapon-gem-2"] ?? player.weaponGemItem2 : "";
    player.weaponGemItem3 = GEMS_ENABLED ? nextEquipment["weapon-gem-3"] ?? player.weaponGemItem3 : "";
  } else if (!player.weaponItem && options.defaultWeaponItem) {
    player.weaponItem = options.defaultWeaponItem;
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
  player.poisonTicksRemaining = 0;
  player.poisonEndsAt = 0;
  player.healingTicksRemaining = 0;
  player.healingEndsAt = 0;
  options.resetMovement?.();
  options.clearCastState();
  return true;
}
