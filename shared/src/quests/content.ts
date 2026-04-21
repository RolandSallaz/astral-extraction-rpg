import {
  INTRODUCTION_QUEST_ID,
  SEALED_RELIC_QUEST_ID,
} from "./catalog";

export type LocalizedText = {
  ru: string;
  en: string;
};

export type QuestStepContent = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  shortLabel: LocalizedText;
};

export type QuestNarrativeContent = {
  descriptionTemplate: LocalizedText;
};

export const QUEST_STEP_CONTENT: Record<string, readonly QuestStepContent[]> = {
  [INTRODUCTION_QUEST_ID]: [
    {
      id: "loot_chest",
      title: { ru: "Обыщи реликварий", en: "Search the Reliquary" },
      description: {
        ru: "Забери из сундука учебный посох и астральный гем.",
        en: "Take the training staff from the chest.",
      },
      shortLabel: { ru: "Сундук", en: "Chest" },
    },
    {
      id: "socket_gem",
      title: { ru: "Вставь гем в посох", en: "Socket the Gem" },
      description: {
        ru: "Открой экипировку и перетащи гем в сокет посоха.",
        en: "Open equipment and drag the gem into the staff socket.",
      },
      shortLabel: { ru: "Сокет", en: "Socket" },
    },
    {
      id: "kill_rat",
      title: { ru: "Убей крысу", en: "Kill the Rat" },
      description: {
        ru: "Проверь посох в деле и уничтожь крысу впереди.",
        en: "Test the staff and destroy the rat ahead.",
      },
      shortLabel: { ru: "Крыса", en: "Rat" },
    },
    {
      id: "find_exit",
      title: { ru: "Найди выход", en: "Find the Exit" },
      description: {
        ru: "Доберись до разлома и покинь маленькую крипту.",
        en: "Reach the rift and leave the small crypt.",
      },
      shortLabel: { ru: "Выход", en: "Exit" },
    },
  ],
  [SEALED_RELIC_QUEST_ID]: [
    {
      id: "enter_crypt_medium",
      title: { ru: "Войди в крипту", en: "Enter the Crypt" },
      description: {
        ru: "Спустись в крипту и найди комнату с запечатанным реликварием.",
        en: "Descend into the crypt and search for the sealed reliquary room.",
      },
      shortLabel: { ru: "Вход", en: "Enter" },
    },
    {
      id: "find_sealed_relic",
      title: { ru: "Забери реликвию", en: "Claim the Sealed Relic" },
      description: {
        ru: "Открой запечатанный реликварий и забери реликвию.",
        en: "Open the sealed reliquary and take the relic hidden inside.",
      },
      shortLabel: { ru: "Реликвия", en: "Relic" },
    },
    {
      id: "extract_with_relic",
      title: { ru: "Вернись живым", en: "Bring It Back Alive" },
      description: {
        ru: "Покинь рейд с реликвией в инвентаре и верни её Старому магу.",
        en: "Extract from the raid with the relic in your inventory and return it to the Old Mage.",
      },
      shortLabel: { ru: "Возврат", en: "Return" },
    },
  ],
};

export const QUEST_NARRATIVE_CONTENT: Record<string, QuestNarrativeContent> = {
  [INTRODUCTION_QUEST_ID]: {
    descriptionTemplate: {
      ru: "{playerName}, астральный шторм вырвал тебя из мира живых и швырнул в его мертвое отражение. Старый маг предупреждает: здесь камень помнит имена павших, а выход открывается только тем, кто безошибочно проходит ритуал выживания. Спустись в Crypt Small, забери посох из реликвария, пробуди в нем гем, пролей первую кровь и найди разлом. Каждый выполненный приказ соберет для тебя новую тропу домой, пока астральная тьма не успела запомнить твое имя навсегда.",
      en: "{playerName}, an astral storm tore you from the world of the living and cast you into its dead reflection. The Old Mage warns that the stone remembers the fallen, and the exit opens only to those who complete the rite of survival without error. Descend into Crypt Small, take the staff from the reliquary, awaken the gem within it, spill first blood, and find the rift before the astral darkness learns your name forever.",
    },
  },
  [SEALED_RELIC_QUEST_ID]: {
    descriptionTemplate: {
      ru: "{playerName}, Старый маг почувствовал запечатанную реликвию, спрятанную в забытом реликварии. Спустись в крипту, добудь реликвию из её комнаты и вынеси живым, пока тьма не забрала её себе снова.",
      en: "{playerName}, the Old Mage has sensed a sealed relic hidden in a forgotten reliquary. Descend into the crypt, recover the relic from its chamber, and bring it back alive before the darkness claims it again.",
    },
  },
};
