import { pickLocale, type Locale } from '@/lib/i18n';
import { parseInventoryItem } from '@/lib/items/equipmentItems';
import type {
  CharacterProfile,
  EquipmentState,
} from '@/lib/playerProfile';
import {
  getIntroductionQuestProgress as getIntroductionQuestProgressFromLog,
  getQuestProgress as getQuestProgressFromLog,
  getSealedRelicQuestProgress as getSealedRelicQuestProgressFromLog,
  INTRODUCTION_QUEST_ID,
  normalizeQuestLog,
  QUEST_NARRATIVE_CONTENT,
  QUEST_STEP_CONTENT,
  SEALED_RELIC_QUEST_ID,
  type IntroductionQuestProgress,
  type IntroductionQuestStepId,
  type QuestProgress,
  type SealedRelicQuestProgress,
  type SealedRelicQuestStepId
} from '@mmorpg/shared';

export {
  createDefaultIntroductionQuestProgress,
  createDefaultQuestProgress,
  createDefaultSealedRelicQuestProgress,
  getAvailableQuests,
  getQuestDefinition,
  INTRODUCTION_QUEST_ID,
  isQuestAvailable,
  isQuestCompleted,
  normalizeQuestLog, QUEST_DEFINITIONS, QUEST_NARRATIVE_CONTENT, QUEST_STEP_CONTENT,
  SEALED_RELIC_QUEST_ID
} from '@mmorpg/shared';

export type {
  IntroductionQuestProgress,
  IntroductionQuestStepId,
  QuestLog,
  QuestProgress,
  SealedRelicQuestProgress,
  SealedRelicQuestStepId
} from '@mmorpg/shared';

export const SEALED_RELIC_ITEM_ID = 'sealed_relic';
export const CRYPT_MEDIUM_TEMPLATE_CODE = 'crypt';
export const CRYPT_SMALL_TEMPLATE_CODE = 'crypt_small';
export const CRYPT_SMALL_TILE_SIZE = 32;
export const INTRODUCTION_QUEST_MAGE_TILE = { x: 17, y: 19 };
export const CRYPT_SMALL_TUTORIAL_CHEST_ID = 'raid-chest-0-13-7';
export const CRYPT_SMALL_TUTORIAL_CHEST_TILE = { x: 13, y: 7 };
export const CRYPT_SMALL_TUTORIAL_RAT_TILE = { x: 21, y: 7 };
export const CRYPT_SMALL_TUTORIAL_EXIT_TILE = { x: 27, y: 7 };

export type QuestStepDefinition = {
  id: string;
  title: string;
  description: string;
  shortLabel: string;
};

export type IntroductionQuestStepDefinition = QuestStepDefinition & {
  id: IntroductionQuestStepId;
};

export function getIntroductionQuestSteps(locale: Locale): IntroductionQuestStepDefinition[] {
  return QUEST_STEP_CONTENT[INTRODUCTION_QUEST_ID].map((step) => ({
    id: step.id as IntroductionQuestStepId,
    title: pickLocale(locale, step.title),
    description: pickLocale(locale, step.description),
    shortLabel: pickLocale(locale, step.shortLabel),
  }));
}

export type SealedRelicQuestStepDefinition = QuestStepDefinition & {
  id: SealedRelicQuestStepId;
};

export function getSealedRelicQuestSteps(locale: Locale): SealedRelicQuestStepDefinition[] {
  return QUEST_STEP_CONTENT[SEALED_RELIC_QUEST_ID].map((step) => ({
    id: step.id as SealedRelicQuestStepId,
    title: pickLocale(locale, step.title),
    description: pickLocale(locale, step.description),
    shortLabel: pickLocale(locale, step.shortLabel),
  }));
}

export function getQuestProgress(
  character: CharacterProfile | null | undefined,
  questId: string,
) {
  return getQuestProgressFromLog(character?.quests, questId) as QuestProgress;
}

export function getIntroductionQuestProgress(character: CharacterProfile | null | undefined) {
  return getIntroductionQuestProgressFromLog(character?.quests) as IntroductionQuestProgress;
}

export function getSealedRelicQuestProgress(character: CharacterProfile | null | undefined) {
  return getSealedRelicQuestProgressFromLog(character?.quests) as SealedRelicQuestProgress;
}

export function isIntroductionQuestAccepted(character: CharacterProfile | null | undefined) {
  const quest = getIntroductionQuestProgress(character);
  return quest.status === 'active' || quest.status === 'ready' || quest.status === 'completed';
}

export function isIntroductionQuestCompleted(character: CharacterProfile | null | undefined) {
  const quest = getIntroductionQuestProgress(character);
  return quest.rewardClaimedAt !== null;
}

export function buildIntroductionQuestDescription(playerName: string, locale: Locale = 'ru') {
  return pickLocale(
    locale,
    QUEST_NARRATIVE_CONTENT[INTRODUCTION_QUEST_ID].descriptionTemplate,
  ).replace('{playerName}', playerName);
}

export function buildSealedRelicQuestDescription(playerName: string, locale: Locale = 'ru') {
  return pickLocale(
    locale,
    QUEST_NARRATIVE_CONTENT[SEALED_RELIC_QUEST_ID].descriptionTemplate,
  ).replace('{playerName}', playerName);
}

export function updateQuestProgress<TQuest extends QuestProgress>(
  character: CharacterProfile,
  questId: string,
  updater: (current: TQuest) => TQuest,
) {
  const currentQuest = normalizeQuestLog(character.quests)?.[questId] as TQuest;
  const nextQuest = updater(currentQuest);

  if (JSON.stringify(currentQuest) === JSON.stringify(nextQuest)) {
    return character;
  }

  return {
    ...character,
    quests: {
      ...normalizeQuestLog(character.quests),
      [questId]: nextQuest,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function updateIntroductionQuestProgress(
  character: CharacterProfile,
  updater: (current: IntroductionQuestProgress) => IntroductionQuestProgress,
) {
  return updateQuestProgress(character, INTRODUCTION_QUEST_ID, updater);
}

export function isCryptSmallRaidTarget(options?: Record<string, string | number>) {
  return options?.templateCode === CRYPT_SMALL_TEMPLATE_CODE;
}

export function getRaidRunId(options?: Record<string, string | number>) {
  return typeof options?.raidRunId === 'string' ? options.raidRunId : null;
}

export function hasTutorialChestBeenLooted(chestSlots?: Array<string | null> | null) {
  if (!chestSlots || chestSlots.length === 0) {
    return false;
  }

  const hasStaff = chestSlots.some((value) => parseInventoryItem(value)?.itemId === 'wood_staff');
  const hasGem = chestSlots.some((value) => parseInventoryItem(value)?.itemId === 'fire_trail_gem');
  return !hasStaff && !hasGem;
}

export function hasSocketedWeaponGem(equipment: EquipmentState) {
  return Boolean(
    equipment['weapon-gem-1'] ||
    equipment['weapon-gem-2'] ||
    equipment['weapon-gem-3'],
  );
}

export function tileToWorldPosition(tile: { x: number; y: number }) {
  return {
    x: tile.x * CRYPT_SMALL_TILE_SIZE + CRYPT_SMALL_TILE_SIZE / 2,
    y: tile.y * CRYPT_SMALL_TILE_SIZE + CRYPT_SMALL_TILE_SIZE / 2,
  };
}
