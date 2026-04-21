/**
 * Authentication service for Colyseus rooms.
 *
 * Verifies session tokens against the NestJS backend and returns
 * authoritative player data.  All stats, equipment and inventory
 * must originate from the backend - never from client options.
 */

import {
  GEMS_ENABLED,
  INVENTORY_SIZE,
  canonicalizeItemId,
  normalizeItemProgressionState,
  type EquipmentItemProgressionState,
} from "@mmorpg/shared";
import { normalizeRoomInventorySlots } from "./roomItems.js";

const BACKEND_BASE_URL =
  process.env.BACKEND_URL ?? process.env.BACKEND_API_URL ?? "http://localhost:3000";

export type VerifiedPlayer = {
  id: string;
  nickname: string;
  role: string;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  strength: number;
  agility: number;
  intellect: number;
  equipment: {
    head?: string;
    body?: string;
    weapon?: string;
    "head-gem-1"?: string;
    "head-gem-2"?: string;
    "head-gem-3"?: string;
    "body-gem-1"?: string;
    "body-gem-2"?: string;
    "body-gem-3"?: string;
    "weapon-gem-1"?: string;
    "weapon-gem-2"?: string;
    "weapon-gem-3"?: string;
  };
  inventory: Array<string | null>;
  equipmentItemProgression: EquipmentItemProgressionState;
  position: { x: number; y: number };
};

/**
 * Verify a session token with the backend and return authoritative
 * player data.  Throws when the token is missing or invalid.
 */
export async function verifySessionToken(
  sessionToken: string | undefined | null,
): Promise<VerifiedPlayer> {
  if (!sessionToken || typeof sessionToken !== "string") {
    throw new Error("Missing session token");
  }

  const response = await fetch(`${BACKEND_BASE_URL}/players/me`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    id: string;
    nickname: string;
    role: string;
    character: {
      equipment: VerifiedPlayer["equipment"];
      inventory: VerifiedPlayer["inventory"];
      equipmentItemProgression?: VerifiedPlayer["equipmentItemProgression"];
      position: VerifiedPlayer["position"];
      health: number;
      maxHealth: number;
      level: number;
      experience: number;
      strength: number;
      agility: number;
      intellect: number;
    };
  };

  return {
    id: data.id,
    nickname: data.nickname,
    role: data.role ?? "USER",
    health: data.character.health,
    maxHealth: data.character.maxHealth,
    level: data.character.level,
    experience: data.character.experience,
    strength: data.character.strength,
    agility: data.character.agility,
    intellect: data.character.intellect,
    equipment: data.character.equipment ?? {},
    inventory: data.character.inventory ?? [],
    equipmentItemProgression: data.character.equipmentItemProgression ?? {},
    position: data.character.position ?? { x: 0, y: 0 },
  };
}

/**
 * Apply verified player data to a Colyseus player state schema.
 * Works for both PlayerState (world) and RaidPlayerState (raid).
 */
type InventoryTarget = {
  inventory?: {
    clear(): void;
    push(value: string): unknown;
  };
};

export function applyVerifiedProfile(
  player: {
    name: string;
    role: string;
    health: number;
    maxHealth: number;
    level: number;
    experience: number;
    strength: number;
    agility: number;
    intellect: number;
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
  } & InventoryTarget,
  verified: VerifiedPlayer,
) {
  const canonicalBodyItem = canonicalizeItemId(verified.equipment.body) ?? "";
  const canonicalHeadItem = canonicalizeItemId(verified.equipment.head) ?? "";
  const canonicalWeaponItem = canonicalizeItemId(verified.equipment.weapon) ?? "";
  player.name = verified.nickname.slice(0, 24) || "Wanderer";
  player.role = verified.role;
  player.health = Math.max(1, verified.health);
  player.maxHealth = Math.max(1, verified.maxHealth);
  player.level = Math.max(1, verified.level);
  player.experience = Math.max(0, verified.experience);
  player.strength = Math.max(1, verified.strength);
  player.agility = Math.max(1, verified.agility);
  player.intellect = Math.max(1, verified.intellect);
  player.bodyItem = canonicalBodyItem;
  player.headItem = canonicalHeadItem;
  player.weaponItem = canonicalWeaponItem;
  player.headGemItem1 = GEMS_ENABLED ? verified.equipment["head-gem-1"] ?? "" : "";
  player.headGemItem2 = GEMS_ENABLED ? verified.equipment["head-gem-2"] ?? "" : "";
  player.headGemItem3 = GEMS_ENABLED ? verified.equipment["head-gem-3"] ?? "" : "";
  player.bodyGemItem1 = GEMS_ENABLED ? verified.equipment["body-gem-1"] ?? "" : "";
  player.bodyGemItem2 = GEMS_ENABLED ? verified.equipment["body-gem-2"] ?? "" : "";
  player.bodyGemItem3 = GEMS_ENABLED ? verified.equipment["body-gem-3"] ?? "" : "";
  player.weaponGemItem1 = GEMS_ENABLED ? verified.equipment["weapon-gem-1"] ?? "" : "";
  player.weaponGemItem2 = GEMS_ENABLED ? verified.equipment["weapon-gem-2"] ?? "" : "";
  player.weaponGemItem3 = GEMS_ENABLED ? verified.equipment["weapon-gem-3"] ?? "" : "";

  if (player.inventory) {
    const normalizedInventory = normalizeRoomInventorySlots(verified.inventory ?? [], INVENTORY_SIZE);
    player.inventory.clear();
    normalizedInventory.forEach((value) => {
      player.inventory?.push(value);
    });
  }

  if (verified.equipmentItemProgression.weapon) {
    verified.equipmentItemProgression.weapon = normalizeItemProgressionState(
      canonicalWeaponItem,
      verified.equipmentItemProgression.weapon,
    ) ?? undefined;
  }
}
