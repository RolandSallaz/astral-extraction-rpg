import type { EquipmentItemProgressionState, EquipmentState } from '@mmorpg/shared/player/contracts';
import { GEMS_ENABLED } from '@mmorpg/shared/items/catalog';
import type { QuestLog } from '@mmorpg/shared/quests/core';
import type {
  BaseProfileMessage,
  EquipmentSyncFields,
  WorldProfileMessage,
} from '@mmorpg/shared/realtime/contracts';

export type ProfileSnapshot = {
  playerName: string;
  playerRole: string;
  playerPosition: { x: number; y: number };
  playerHealth: number;
  playerMaxHealth: number;
  playerLevel: number;
  playerExperience: number;
  playerStrength: number;
  playerAgility: number;
  playerIntellect: number;
  playerGold: number;
  playerQuests: QuestLog;
  playerInventory: Array<string | null>;
  playerEquipment: EquipmentState;
  playerEquipmentItemProgression: EquipmentItemProgressionState;
};

export function createEquipmentSyncFields(equipment: EquipmentState): EquipmentSyncFields {
  return {
    bodyItem: equipment.body ?? '',
    headItem: equipment.head ?? '',
    weaponItem: equipment.weapon ?? '',
    headGemItem1: GEMS_ENABLED ? equipment['head-gem-1'] ?? '' : '',
    headGemItem2: GEMS_ENABLED ? equipment['head-gem-2'] ?? '' : '',
    headGemItem3: GEMS_ENABLED ? equipment['head-gem-3'] ?? '' : '',
    bodyGemItem1: GEMS_ENABLED ? equipment['body-gem-1'] ?? '' : '',
    bodyGemItem2: GEMS_ENABLED ? equipment['body-gem-2'] ?? '' : '',
    bodyGemItem3: GEMS_ENABLED ? equipment['body-gem-3'] ?? '' : '',
    weaponGemItem1: GEMS_ENABLED ? equipment['weapon-gem-1'] ?? '' : '',
    weaponGemItem2: GEMS_ENABLED ? equipment['weapon-gem-2'] ?? '' : '',
    weaponGemItem3: GEMS_ENABLED ? equipment['weapon-gem-3'] ?? '' : '',
  };
}

export function createBaseProfileMessage(profile: ProfileSnapshot): BaseProfileMessage {
  return {
    name: profile.playerName,
    role: profile.playerRole,
    health: profile.playerHealth,
    maxHealth: profile.playerMaxHealth,
    level: profile.playerLevel,
    experience: profile.playerExperience,
    strength: profile.playerStrength,
    agility: profile.playerAgility,
    intellect: profile.playerIntellect,
    gold: profile.playerGold,
    quests: profile.playerQuests,
    inventory: profile.playerInventory.map((itemId) => itemId ?? ''),
    equipmentItemProgression: profile.playerEquipmentItemProgression,
    weaponItemProgression: profile.playerEquipmentItemProgression.weapon ?? null,
    ...createEquipmentSyncFields(profile.playerEquipment),
  };
}

export function createWorldProfileMessage(
  profile: ProfileSnapshot,
  positionOverride?: { x: number; y: number },
): WorldProfileMessage {
  const message: WorldProfileMessage = {
    ...createBaseProfileMessage(profile),
  };

  if (positionOverride) {
    message.position = positionOverride;
  }

  return message;
}
