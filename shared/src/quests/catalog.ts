export const INTRODUCTION_QUEST_ID = "znakomstvo" as const;
export const SEALED_RELIC_QUEST_ID = "sealed_relic" as const;

export type QuestDefinition = {
  id: string;
  prerequisites: string[];
};

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [
  { id: INTRODUCTION_QUEST_ID, prerequisites: [] },
  { id: SEALED_RELIC_QUEST_ID, prerequisites: [INTRODUCTION_QUEST_ID] },
];
