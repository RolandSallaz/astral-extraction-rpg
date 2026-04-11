import {
  INTRODUCTION_QUEST_ID,
  QUEST_DEFINITIONS,
  SEALED_RELIC_QUEST_ID,
  type QuestDefinition,
} from "./catalog";

export {
  INTRODUCTION_QUEST_ID,
  QUEST_DEFINITIONS,
  SEALED_RELIC_QUEST_ID,
  type QuestDefinition,
} from "./catalog";

export type QuestStatus = "available" | "active" | "ready" | "completed";

export type QuestProgress = {
  status: QuestStatus;
  currentStepId: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  rewardClaimedAt: string | null;
};

export type IntroductionQuestStepId = "loot_chest" | "socket_gem" | "kill_rat" | "find_exit";

export type IntroductionQuestProgress = Omit<QuestProgress, "currentStepId"> & {
  currentStepId: IntroductionQuestStepId | null;
  activeRaidRunId: string | null;
  killRatExperienceBaseline: number | null;
};

export type SealedRelicQuestStepId = "enter_crypt_medium" | "find_sealed_relic" | "extract_with_relic";

export type SealedRelicQuestProgress = QuestProgress & {
  currentStepId: SealedRelicQuestStepId | null;
};

export type QuestLog = Record<string, Partial<QuestProgress> | null | undefined>;

export function isQuestCompleted(questId: string, quests?: QuestLog | null): boolean {
  return quests?.[questId]?.rewardClaimedAt != null;
}

export function getQuestDefinition(questId: string): QuestDefinition | undefined {
  return QUEST_DEFINITIONS.find((definition) => definition.id === questId);
}

export function isQuestAvailable(questId: string, quests?: QuestLog | null): boolean {
  const definition = getQuestDefinition(questId);
  if (!definition) {
    return false;
  }
  if (isQuestCompleted(questId, quests)) {
    return false;
  }

  return definition.prerequisites.every((prerequisiteId) => isQuestCompleted(prerequisiteId, quests));
}

export function getAvailableQuests(quests?: QuestLog | null): QuestDefinition[] {
  return QUEST_DEFINITIONS.filter((definition) => isQuestAvailable(definition.id, quests));
}

export function createDefaultQuestProgress(): QuestProgress {
  return {
    status: "available",
    currentStepId: null,
    acceptedAt: null,
    completedAt: null,
    rewardClaimedAt: null,
  };
}

export function createDefaultIntroductionQuestProgress(): IntroductionQuestProgress {
  return {
    ...createDefaultQuestProgress(),
    currentStepId: null,
    activeRaidRunId: null,
    killRatExperienceBaseline: null,
  };
}

export function createDefaultSealedRelicQuestProgress(): SealedRelicQuestProgress {
  return createDefaultQuestProgress() as SealedRelicQuestProgress;
}

export function normalizeQuestLog(quests?: QuestLog | null): QuestLog {
  const introduction = quests?.[INTRODUCTION_QUEST_ID];
  const sealedRelic = quests?.[SEALED_RELIC_QUEST_ID];

  return {
    [INTRODUCTION_QUEST_ID]: {
      ...createDefaultIntroductionQuestProgress(),
      ...(introduction ?? {}),
    },
    [SEALED_RELIC_QUEST_ID]: {
      ...createDefaultSealedRelicQuestProgress(),
      ...(sealedRelic ?? {}),
    },
  };
}

export function getQuestProgress(quests: QuestLog | null | undefined, questId: string) {
  return normalizeQuestLog(quests)?.[questId] as QuestProgress;
}

export function getIntroductionQuestProgress(quests?: QuestLog | null) {
  return normalizeQuestLog(quests)?.[INTRODUCTION_QUEST_ID] as IntroductionQuestProgress;
}

export function getSealedRelicQuestProgress(quests?: QuestLog | null) {
  return normalizeQuestLog(quests)?.[SEALED_RELIC_QUEST_ID] as SealedRelicQuestProgress;
}

export function hasStartedIntroductionQuest(quests?: QuestLog | null) {
  const quest = getIntroductionQuestProgress(quests);
  return quest.status === "active" || quest.status === "ready" || quest.status === "completed";
}

export function hasCompletedIntroductionQuest(quests?: QuestLog | null) {
  return getIntroductionQuestProgress(quests).rewardClaimedAt !== null;
}
