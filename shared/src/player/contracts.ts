import { INVENTORY_SIZE, type BaseEquipmentSlot, type EquipmentSlot, type EquippableItemId } from "../items/catalog";
import type { ItemProgressionState } from "../items/itemProgression";
import type { QuestLog } from "../quests/core";

export type EquipmentState = Partial<Record<EquipmentSlot, EquippableItemId>>;
export type InventoryState = Array<string | null>;
export type EquipmentItemProgressionState = Partial<Record<BaseEquipmentSlot, ItemProgressionState>>;

export type CharacterPosition = {
  x: number;
  y: number;
};

export type CharacterResources = {
  gold: number;
  health: number;
  maxHealth: number;
};

export type CharacterProgression = {
  level: number;
  experience: number;
  strength: number;
  agility: number;
  intellect: number;
  quests: QuestLog;
};

export type CharacterTimestamps = {
  createdAt: string;
  updatedAt: string;
};

export type CharacterProfile = {
  equipment: EquipmentState;
  inventory: InventoryState;
  equipmentItemProgression: EquipmentItemProgressionState;
  position: CharacterPosition;
} & CharacterResources & CharacterProgression & CharacterTimestamps;

export function createEmptyInventory(): InventoryState {
  return Array.from({ length: INVENTORY_SIZE }, () => null);
}

export function createStarterEquipment(): EquipmentState {
  return {};
}

export function createStarterProfile(): CharacterProfile {
  const timestamp = new Date().toISOString();

  return {
    equipment: createStarterEquipment(),
    inventory: createEmptyInventory(),
    equipmentItemProgression: {},
    gold: 250,
    position: {
      x: 0,
      y: 0,
    },
    health: 100,
    maxHealth: 100,
    level: 1,
    experience: 0,
    strength: 1,
    agility: 1,
    intellect: 1,
    quests: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
