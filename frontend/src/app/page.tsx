'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { GameCanvas, type MinimapSnapshot, type ObjectiveArrowState, type RealtimeChatMessage, type TraderQuestMarker, type WorldTraderInteraction } from '@/components/GameCanvas';
import { GameChat } from '@/components/GameChat';
import { GameHud, type ContainerView } from '@/components/GameHud';
import { HudWindow } from '@/components/ui/HudWindow';
import HealthBar from '@/components/ui/8bit/health-bar';
import {
  ITEM_DEFINITIONS,
  parseInventoryItem,
  serializeInventoryItem,
  type GemItemId,
  type ItemId,
} from '@/lib/items/equipmentItems';
import {
  DEFAULT_ITEM_BALANCE_CONFIG,
  cloneItemBalanceConfig,
  getResolvedItemTooltipStats,
  getResolvedItemValue,
  type ItemBalanceConfig,
} from '@/lib/itemBalance';
import {
  createEmptyInventory,
  createStarterEquipment,
  type CharacterProfile,
  type EquipmentState,
  type InventoryState,
} from '@/lib/playerProfile';
import {
  buildIntroductionQuestDescription,
  buildSealedRelicQuestDescription,
  CRYPT_MEDIUM_TEMPLATE_CODE,
  CRYPT_SMALL_TEMPLATE_CODE,
  INTRODUCTION_QUEST_MAGE_TILE,
  CRYPT_SMALL_TUTORIAL_CHEST_ID,
  CRYPT_SMALL_TUTORIAL_CHEST_TILE,
  CRYPT_SMALL_TUTORIAL_EXIT_TILE,
  CRYPT_SMALL_TUTORIAL_RAT_TILE,
  getIntroductionQuestProgress,
  getQuestProgress,
  getRaidRunId,
  getSealedRelicQuestProgress,
  getIntroductionQuestSteps,
  getSealedRelicQuestSteps,
  hasSocketedWeaponGem,
  hasTutorialChestBeenLooted,
  SEALED_RELIC_ITEM_ID,
  SEALED_RELIC_QUEST_ID,
  isCryptSmallRaidTarget,
  isIntroductionQuestCompleted,
  tileToWorldPosition,
  updateQuestProgress,
  updateIntroductionQuestProgress,
  type IntroductionQuestProgress,
  type QuestStepDefinition,
} from '@/lib/quests';
import { loadStoredLocale, persistLocale, pickLocale, type Locale } from '@/lib/i18n';
import type { MeadowMapAsset, MeadowOverlayAsset, MeadowStampAsset, MeadowTile, MeadowTraderAsset } from '@/lib/maps/meadowMap';
import {
  createParty,
  giveItemToPlayer,
  joinParty,
  leaveParty,
  ackPendingRaidJoin,
  loadMyParty,
  loadRaidTemplates,
  loadItemBalanceConfig,
  loadSkillBalanceConfig,
  loadMobBalanceConfig,
  loadSessionPlayer,
  loginPlayer,
  logoutPlayer,
  registerPlayer,
  saveCharacter,
  saveItemBalanceConfig,
  saveSkillBalanceConfig,
  saveMobBalanceConfig,
  setPartyReady,
  startRaid,
  type PartyView,
  type RaidTemplateView,
  type StartedRaidView,
} from '@/lib/playerStorage';
import {
  DEFAULT_SKILL_EFFECT_OVERRIDES,
  type SkillEffectConfig,
  type SkillEffectId,
  type SkillEffectOverrides,
} from '@/lib/skillEffects';
import {
  DEFAULT_MOB_BALANCE_CONFIG,
  type MobBalanceConfig,
} from '@/lib/mobBalance';
import {
  DEFAULT_SKILL_BALANCE_CONFIG,
  type SkillBalanceConfig,
} from '@/lib/skillBalance';

type AuthMode = 'login' | 'register';
type AuthStatus = 'loading' | 'guest' | 'ready';

type AuthFormState = {
  nickname: string;
  password: string;
};

type SkillCooldownState = Partial<Record<'fireball' | 'fireNova' | 'fireField', number>>;
type ConsumableCooldownState = Partial<Record<'healing_potion', number>>;
type AdminTabId = 'skills' | 'balance' | 'mobs' | 'items' | 'world' | 'assets' | 'system';
type ActiveRoomTarget = {
  name: 'world' | 'raid';
  options?: Record<string, string | number>;
};
type WorldEditorMode = 'tile' | 'sprite' | 'spawn' | 'trader';
type WorldOverlayBrush = {
  texture: MeadowOverlayAsset['texture'];
  rotation: number;
  flipX: boolean;
};
type WorldSpriteBrush = {
  texturePath: MeadowStampAsset['texturePath'];
  rotation: number;
  flipX: boolean;
  scale: number;
};
type WorldTraderBrush = {
  name: string;
  bodyTexturePath: MeadowTraderAsset['bodyTexturePath'];
  headTexturePath: MeadowTraderAsset['headTexturePath'];
};
type WorldEditorDebugState = {
  textureKey: string;
  textureLoaded: boolean;
};
type TraderOffer = {
  itemId: ItemId;
  quantity?: number;
};
type TraderTabId = 'shop' | 'quests';
type TraderQuestStatus = NonNullable<TraderQuestMarker>['state'];
type TraderQuestDefinition = {
  id: string;
  title: string;
  description: (playerName: string, locale?: Locale) => string;
  steps: QuestStepDefinition[];
  requiredTurnInItemId?: ItemId;
};
type QuestLogEntry = {
  id: string;
  title: string;
  status: 'active' | 'ready';
  steps: QuestStepDefinition[];
  requiredTurnInItemId?: ItemId;
  progress: ReturnType<typeof getIntroductionQuestProgress> | ReturnType<typeof getSealedRelicQuestProgress>;
};
type QuestObjectiveTarget = {
  roomName: 'world' | 'raid';
  worldX: number;
  worldY: number;
  label: string;
} | null;

function getPageText(locale: Locale) {
  return {
    loading: pickLocale(locale, { ru: 'Загрузка...', en: 'Loading...' }),
    register: pickLocale(locale, { ru: 'Регистрация', en: 'Register' }),
    login: pickLocale(locale, { ru: 'Вход', en: 'Login' }),
    createAccount: pickLocale(locale, { ru: 'Создать аккаунт', en: 'Create Account' }),
    enterWorld: pickLocale(locale, { ru: 'Войти в мир', en: 'Enter World' }),
    nickname: pickLocale(locale, { ru: 'Ник', en: 'Nickname' }),
    password: pickLocale(locale, { ru: 'Пароль', en: 'Password' }),
    authBlurb: pickLocale(locale, {
      ru: 'Регистрация и вход теперь идут через backend API. После логина игра загружает профиль игрока из базы данных и сохраняет туда экипировку, инвентарь и позицию персонажа.',
      en: 'Registration and login now go through the backend API. After login, the game loads the player profile from the database and saves equipment, inventory, and character position there.',
    }),
    nicknameHint: pickLocale(locale, {
      ru: 'Ник используется и как логин, и как стартовое имя персонажа.',
      en: 'Nickname is used both as the login and as the starting character name.',
    }),
    session: pickLocale(locale, { ru: 'Сессия', en: 'Session' }),
    logout: pickLocale(locale, { ru: 'Выйти', en: 'Logout' }),
    questTracker: pickLocale(locale, { ru: 'Трекер квеста', en: 'Quest Tracker' }),
    currentStep: pickLocale(locale, { ru: 'Текущий шаг', en: 'Current Step' }),
    openInventoryAndEquipment: pickLocale(locale, { ru: 'Открой инвентарь и экипировку', en: 'Open inventory and equipment' }),
    socketHint: pickLocale(locale, { ru: 'Перетащи гем прямо на посох, чтобы открыть ему астральный след.', en: 'Drag the gem directly onto the staff to awaken its astral trace.' }),
    partyAndRaid: pickLocale(locale, { ru: 'Пати и рейд', en: 'Party & Raid' }),
    activeRoom: pickLocale(locale, { ru: 'Активная комната', en: 'Active room' }),
    lobby: pickLocale(locale, { ru: 'Лобби', en: 'Lobby' }),
    refresh: pickLocale(locale, { ru: 'Обновить', en: 'Refresh' }),
    party: pickLocale(locale, { ru: 'Пати', en: 'Party' }),
    notInParty: pickLocale(locale, { ru: 'Вы не состоите в пати.', en: 'You are not in a party.' }),
    create: pickLocale(locale, { ru: 'Создать', en: 'Create' }),
    leader: pickLocale(locale, { ru: 'Лидер', en: 'Leader' }),
    ready: pickLocale(locale, { ru: 'Готов', en: 'Ready' }),
    notReady: pickLocale(locale, { ru: 'Не готов', en: 'Not ready' }),
    unready: pickLocale(locale, { ru: 'Снять готовность', en: 'Unready' }),
    leave: pickLocale(locale, { ru: 'Выйти', en: 'Leave' }),
    joinByCode: pickLocale(locale, { ru: 'Войти по коду', en: 'Join By Code' }),
    join: pickLocale(locale, { ru: 'Войти', en: 'Join' }),
    raid: pickLocale(locale, { ru: 'Рейд', en: 'Raid' }),
    template: pickLocale(locale, { ru: 'Шаблон', en: 'Template' }),
    players: pickLocale(locale, { ru: 'Игроки', en: 'Players' }),
    layout: pickLocale(locale, { ru: 'Карта', en: 'Layout' }),
    noRaidTemplates: pickLocale(locale, { ru: 'Нет доступных шаблонов рейда.', en: 'No raid templates loaded.' }),
    talkToOldMage: pickLocale(locale, { ru: 'Поговори со Старым магом', en: 'Talk to the Old Mage' }),
    startRaidAsLeader: pickLocale(locale, { ru: 'Стартовать рейд как лидер', en: 'Start Raid As Leader' }),
    leaderMustStartRaid: pickLocale(locale, { ru: 'Рейд должен стартовать лидер', en: 'Leader Must Start Raid' }),
    startSoloRaid: pickLocale(locale, { ru: 'Стартовать соло рейд', en: 'Start Solo Raid' }),
    questLog: pickLocale(locale, { ru: 'Журнал квестов', en: 'Quest Log' }),
    acceptedQuests: pickLocale(locale, { ru: 'Принятые квесты', en: 'Accepted quests' }),
    noAcceptedQuests: pickLocale(locale, { ru: 'Сейчас нет принятых квестов.', en: 'No accepted quests right now.' }),
    readyToTurnIn: pickLocale(locale, { ru: 'Готов к сдаче', en: 'Ready To Turn In' }),
    inProgress: pickLocale(locale, { ru: 'В процессе', en: 'In Progress' }),
    requiredItem: pickLocale(locale, { ru: 'Требуемый предмет', en: 'Required Item' }),
    inInventory: pickLocale(locale, { ru: 'В инвентаре', en: 'In inventory' }),
    notCollectedYet: pickLocale(locale, { ru: 'Ещё не найден', en: 'Not collected yet' }),
    missing: pickLocale(locale, { ru: 'Не хватает', en: 'Missing' }),
    quest: pickLocale(locale, { ru: 'Квест', en: 'Quest' }),
    steps: pickLocale(locale, { ru: 'Шаги', en: 'Steps' }),
    quests: pickLocale(locale, { ru: 'Квесты', en: 'Quests' }),
    shop: pickLocale(locale, { ru: 'Магазин', en: 'Shop' }),
    complete: pickLocale(locale, { ru: 'Сдать', en: 'Complete' }),
    completed: pickLocale(locale, { ru: 'Сдан', en: 'Completed' }),
    accept: pickLocale(locale, { ru: 'Принять', en: 'Accept' }),
    noQuestsAvailable: pickLocale(locale, { ru: 'Сейчас нет доступных квестов.', en: 'No quests available right now.' }),
    dialogue: pickLocale(locale, { ru: 'Диалог', en: 'Dialogue' }),
    coinPurse: pickLocale(locale, { ru: 'Кошелёк', en: 'Coin Purse' }),
    mode: pickLocale(locale, { ru: 'Режим', en: 'Mode' }),
    buySell: pickLocale(locale, { ru: 'Покупка / Продажа', en: 'Buy / Sell' }),
    vendorStock: pickLocale(locale, { ru: 'Товар', en: 'Vendor Stock' }),
    yourStash: pickLocale(locale, { ru: 'Ваш инвентарь', en: 'Your Stash' }),
    selectedSale: pickLocale(locale, { ru: 'Выбранная продажа', en: 'Selected Sale' }),
    selectedItem: pickLocale(locale, { ru: 'Выбранный предмет', en: 'Selected Item' }),
    payout: pickLocale(locale, { ru: 'Выплата', en: 'Payout' }),
    cost: pickLocale(locale, { ru: 'Цена', en: 'Cost' }),
    sellToTrader: pickLocale(locale, { ru: 'Продать торговцу', en: 'Sell to trader' }),
    sell: pickLocale(locale, { ru: 'Продать', en: 'Sell' }),
    buy: pickLocale(locale, { ru: 'Купить', en: 'Buy' }),
    noItemsSelected: pickLocale(locale, { ru: 'Предмет не выбран.', en: 'No items selected.' }),
    items: pickLocale(locale, { ru: 'предм.', en: 'items' }),
    instantDelivery: pickLocale(locale, { ru: 'мгновенная доставка', en: 'instant delivery' }),
    defeated: pickLocale(locale, { ru: 'Поражение', en: 'Defeated' }),
    youDied: pickLocale(locale, { ru: 'Вы погибли', en: 'You Died' }),
    deathMessage: pickLocale(locale, {
      ru: 'Весь лут выпал в мешочек на месте смерти. Нажмите Respawn, чтобы вернуться в мир.',
      en: 'All loot dropped in a bag at the place of death. Press Respawn to return to the world.',
    }),
    respawn: pickLocale(locale, { ru: 'Возродиться', en: 'Respawn' }),
    questReadyMessage: pickLocale(locale, {
      ru: 'Квест завершён. Ты пережил астральную тропу.',
      en: 'Quest complete. You survived the astral path.',
    }),
    questActiveMessage: pickLocale(locale, {
      ru: 'Квест уже активен. Следуй шагам и дойди до выхода.',
      en: 'Quest is already active. Follow the steps and reach the exit.',
    }),
    questAvailableMessage: pickLocale(locale, {
      ru: 'Старый маг готов провести тебя через ритуал.',
      en: 'The Old Mage is ready to guide you through the rite.',
    }),
  };
}

const INITIAL_FORM: AuthFormState = {
  nickname: '',
  password: '',
};

const MEADOW_CHEST_ID = 'meadow-chest-10-22';
const INITIAL_CHAT_MESSAGES: RealtimeChatMessage[] = [];
type ActiveSkillTargeting = 'fireball' | 'fireField' | null;
const ADMIN_EFFECTS_STORAGE_KEY = 'mmorpg.admin.skill-effects.v1';
const ADMIN_TOOLS_VISIBLE_STORAGE_KEY = 'mmorpg.admin-tools.visible.v1';
const LOBBY_TOOLS_VISIBLE_STORAGE_KEY = 'mmorpg.lobby-tools.visible.v1';
const LOBBY_TOOLS_POSITION_STORAGE_KEY = 'mmorpg.lobby-tools.position.v1';
const ADMIN_TOOLS_POSITION_STORAGE_KEY = 'mmorpg.admin-tools.position.v1';
const ACTIVE_ROOM_TARGET_STORAGE_KEY = 'mmorpg.active-room-target.v1';
const ADMIN_GEM_COLORS_STORAGE_KEY = 'mmorpg.admin.gem-colors.v1';
const MINIMAP_ZOOM_STORAGE_KEY = 'mmorpg.minimap.zoom.v1';
const RAID_DEADLINE_MS = 15 * 60 * 1000;
const ADMIN_ITEM_DEFINITIONS = Object.values(ITEM_DEFINITIONS);
type AdminGemColorOverrides = Partial<Record<GemItemId, string>>;
const TRADER_WINDOW_POSITION_STORAGE_KEY = 'mmorpg.ui.trader.position.v1';
const PARTY_POLL_INTERVAL_MS = 2000;
function getTraderQuestDefinitions(locale: Locale): Partial<Record<string, TraderQuestDefinition[]>> {
  return {
    'old mage': [
      {
        id: 'znakomstvo',
        title: pickLocale(locale, { ru: 'Знакомство', en: 'Introduction' }),
        description: buildIntroductionQuestDescription,
        steps: getIntroductionQuestSteps(locale),
      },
      {
        id: SEALED_RELIC_QUEST_ID,
        title: pickLocale(locale, { ru: 'Запечатанная реликвия', en: 'The Sealed Relic' }),
        description: buildSealedRelicQuestDescription,
        steps: getSealedRelicQuestSteps(locale),
        requiredTurnInItemId: SEALED_RELIC_ITEM_ID,
      },
    ],
  };
}
const TRADER_QUEST_MARKERS: Record<TraderQuestStatus, NonNullable<TraderQuestMarker>> = {
  available: {
    symbol: '!',
    color: '#ffe699',
    state: 'available',
  },
  active: {
    symbol: '?',
    color: '#b7b7b7',
    state: 'active',
  },
  ready: {
    symbol: '?',
    color: '#ffe699',
    state: 'ready',
  },
};

function getTraderOffers(trader: WorldTraderInteraction): TraderOffer[] {
  const normalizedName = trader.name.trim().toLowerCase();

  if (normalizedName.includes('old mage')) {
    return [
      { itemId: 'default_staff' },
      { itemId: 'magic_hat' },
      { itemId: 'robe_tunic' },
      { itemId: 'healing_potion', quantity: 1 },
      { itemId: 'fire_trail_gem' },
      { itemId: 'fire_return_gem' },
      { itemId: 'fire_range_gem' },
      { itemId: 'cast_speed_gem' },
      { itemId: 'critical_gem' },
      { itemId: 'guard_gem' },
      { itemId: 'focus_gem' },
      { itemId: 'vitality_gem' },
    ];
  }

  return [
    { itemId: 'healing_potion', quantity: 1 },
    { itemId: 'magic_hat' },
  ];
}

function getTraderGreeting(trader: WorldTraderInteraction, locale: Locale) {
  const normalizedName = trader.name.trim().toLowerCase();

  if (normalizedName.includes('old mage')) {
    return pickLocale(locale, {
      ru: 'Старый маг следит за астральной пылью вокруг тебя и держит ладонь на ящике с учебными реликвиями.',
      en: 'The Old Mage watches the astral dust swirling around you and keeps a hand on the chest of training relics.',
    });
  }

  return pickLocale(locale, {
    ru: 'Посмотри, что у меня есть.',
    en: 'Browse the wares.',
  });
}

function getQuestStatusForCharacter(questId: string, character: CharacterProfile | null): TraderQuestStatus | null {
  if (!character) {
    return null;
  }

  const quest = getQuestProgress(character, questId);
  if (!quest) {
    return null;
  }

  if (quest.rewardClaimedAt !== null) {
    return null;
  }

  if (quest.status === 'ready' || (quest.status === 'completed' && quest.rewardClaimedAt === null)) {
    return 'ready';
  }

  if (quest.status === 'active') {
    return 'active';
  }

  if (quest.status === 'available') {
    if (questId === SEALED_RELIC_QUEST_ID && !isIntroductionQuestCompleted(character)) {
      return null;
    }
    return 'available';
  }

  return null;
}

function getTraderQuestStatus(trader: WorldTraderInteraction, character: CharacterProfile | null, locale: Locale): TraderQuestStatus | null {
  const definitions = getTraderQuestDefinitions(locale)[trader.name.trim().toLowerCase()];
  if (!definitions) {
    return null;
  }

  const statuses = definitions
    .map((definition) => getQuestStatusForCharacter(definition.id, character))
    .filter((status): status is TraderQuestStatus => Boolean(status));

  if (statuses.includes('ready')) {
    return 'ready';
  }

  if (statuses.includes('available')) {
    return 'available';
  }

  if (statuses.includes('active')) {
    return 'active';
  }

  return null;
}

function getTraderQuestMarker(trader: WorldTraderInteraction, character: CharacterProfile | null, locale: Locale): TraderQuestMarker {
  const status = getTraderQuestStatus(trader, character, locale);
  return status ? TRADER_QUEST_MARKERS[status] : null;
}

function getAcceptedQuestLogEntries(character: CharacterProfile | null, locale: Locale): QuestLogEntry[] {
  if (!character) {
    return [];
  }

  return (getTraderQuestDefinitions(locale)['old mage'] ?? [])
    .map((definition) => {
      const progress =
        definition.id === SEALED_RELIC_QUEST_ID
          ? getSealedRelicQuestProgress(character)
          : getIntroductionQuestProgress(character);
      const status = progress.status === 'ready' ? 'ready' : progress.status === 'active' ? 'active' : null;

      if (!status) {
        return null;
      }

      return {
        id: definition.id,
        title: definition.title,
        status,
        steps: definition.steps,
        requiredTurnInItemId: definition.requiredTurnInItemId,
        progress,
      } satisfies QuestLogEntry;
    })
    .filter((entry) => entry !== null);
}

function QuestRequiredItemCard({
  itemId,
  itemBalanceConfig,
  hasItem,
  labels,
}: {
  itemId: ItemId;
  itemBalanceConfig: ItemBalanceConfig;
  hasItem: boolean;
  labels: { requiredItem: string; inInventory: string; notCollectedYet: string; ready: string; missing: string };
}) {
  const item = ITEM_DEFINITIONS[itemId];
  const tooltipStats = getResolvedItemTooltipStats(itemId, itemBalanceConfig);

  return (
    <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">{labels.requiredItem}</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="group relative flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d9efbd]/20 bg-[#102108]/60 p-1">
            {item.type === 'gem' || item.type === 'quest' ? (
              <span
                className="pixelated h-full w-full"
                style={{
                  backgroundColor: item.tintColor ?? '#ffffff',
                  WebkitMaskImage: `url(${item.texturePath})`,
                  maskImage: `url(${item.texturePath})`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                }}
              />
            ) : (
              <img
                src={item.texturePath}
                alt={item.name}
                className="pixelated h-full w-full object-contain"
                style={{
                  transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                }}
              />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#f4ffe8]">{item.name}</div>
            <div className="text-xs text-[#cfe1ba]">{hasItem ? labels.inInventory : labels.notCollectedYet}</div>
          </div>

          <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-xl border border-[#d9efbd]/18 bg-[#13240b]/95 px-3 py-3 text-xs text-[#d8ebc7] shadow-[0_12px_30px_rgba(0,0,0,0.3)] group-hover:block">
            <div className="font-semibold text-[#f4ffe8]">{item.name}</div>
            <div className="mt-2 space-y-1">
              {tooltipStats.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            hasItem
              ? 'bg-[#d7f0b6] text-[#18310d]'
              : 'bg-[#3a2d0f]/55 text-[#ffe699]'
          }`}
        >
          {hasItem ? labels.ready : labels.missing}
        </div>
      </div>
    </div>
  );
}

function addItemToInventory(
  inventory: InventoryState,
  itemId: ItemId,
  quantity = 1,
): InventoryState | null {
  const definition = ITEM_DEFINITIONS[itemId];
  const nextInventory = [...inventory];
  let remaining = Math.max(1, quantity);

  if (definition.stackable) {
    for (let index = 0; index < nextInventory.length && remaining > 0; index += 1) {
      const parsed = parseInventoryItem(nextInventory[index]);
      if (!parsed || parsed.itemId !== itemId) {
        continue;
      }

      const maxStack = definition.maxStack ?? parsed.quantity;
      if (parsed.quantity >= maxStack) {
        continue;
      }

      const transferAmount = Math.min(remaining, maxStack - parsed.quantity);
      nextInventory[index] = serializeInventoryItem(itemId, parsed.quantity + transferAmount);
      remaining -= transferAmount;
    }
  }

  while (remaining > 0) {
    const emptyIndex = nextInventory.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      return null;
    }

    if (definition.stackable) {
      const maxStack = definition.maxStack ?? remaining;
      const stackAmount = Math.min(remaining, maxStack);
      nextInventory[emptyIndex] = serializeInventoryItem(itemId, stackAmount);
      remaining -= stackAmount;
    } else {
      nextInventory[emptyIndex] = serializeInventoryItem(itemId);
      remaining -= 1;
    }
  }

  return nextInventory;
}

function hasInventoryItem(inventory: InventoryState, itemId: ItemId) {
  return inventory.some((entry) => parseInventoryItem(entry)?.itemId === itemId);
}

function removeOneInventoryItem(inventory: InventoryState, itemId: ItemId): InventoryState | null {
  const nextInventory = [...inventory];
  const index = nextInventory.findIndex((entry) => parseInventoryItem(entry)?.itemId === itemId);
  if (index === -1) {
    return null;
  }

  const parsed = parseInventoryItem(nextInventory[index]);
  if (!parsed) {
    return null;
  }

  nextInventory[index] = parsed.quantity > 1
    ? serializeInventoryItem(itemId, parsed.quantity - 1)
    : null;
  return nextInventory;
}

function loadAdminToolsVisible() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(ADMIN_TOOLS_VISIBLE_STORAGE_KEY) !== 'false';
}

function loadLobbyToolsVisible() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(LOBBY_TOOLS_VISIBLE_STORAGE_KEY) !== 'false';
}

function loadAdminGemColorOverrides(): AdminGemColorOverrides {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_GEM_COLORS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as AdminGemColorOverrides;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function loadStoredActiveRoomTarget(): ActiveRoomTarget | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ACTIVE_ROOM_TARGET_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as ActiveRoomTarget;
    if (parsed?.name !== 'world' && parsed?.name !== 'raid') {
      return null;
    }

    return {
      name: parsed.name,
      options: parsed.options,
    };
  } catch {
    return null;
  }
}

function sanitizeSkillEffectConfig(config: SkillEffectConfig): SkillEffectConfig {
  return {
    texturePath: config.texturePath,
    frameWidth: Math.max(1, Math.floor(config.frameWidth)),
    frameHeight: Math.max(1, Math.floor(config.frameHeight)),
    startFrame: Math.max(0, Math.floor(config.startFrame)),
    startRowFrames: Math.max(0, Math.floor(config.startRowFrames)),
    frameCount: Math.max(1, Math.floor(config.frameCount)),
    fps: Math.max(1, Math.floor(config.fps)),
    displaySize: Math.max(1, Math.floor(config.displaySize)),
  };
}

function loadStoredSkillEffectOverrides() {
  if (typeof window === 'undefined') {
    return DEFAULT_SKILL_EFFECT_OVERRIDES;
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_EFFECTS_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SKILL_EFFECT_OVERRIDES;
    }

    const parsed = JSON.parse(rawValue) as Partial<Record<SkillEffectId, Partial<SkillEffectConfig>>>;

    return {
      fireball: sanitizeSkillEffectConfig({
        ...DEFAULT_SKILL_EFFECT_OVERRIDES.fireball,
        ...parsed.fireball,
      }),
      fireNova: sanitizeSkillEffectConfig({
        ...DEFAULT_SKILL_EFFECT_OVERRIDES.fireNova,
        ...parsed.fireNova,
      }),
      fireField: sanitizeSkillEffectConfig({
        ...DEFAULT_SKILL_EFFECT_OVERRIDES.fireField,
        ...parsed.fireField,
      }),
    } satisfies SkillEffectOverrides;
  } catch {
    return DEFAULT_SKILL_EFFECT_OVERRIDES;
  }
}

function createResetCharacter(current: CharacterProfile): CharacterProfile {
  return {
    ...current,
    equipment: createStarterEquipment(),
    inventory: createEmptyInventory(),
    position: { x: 0, y: 0 },
    health: 0,
    maxHealth: 100,
    level: 1,
    experience: 0,
    updatedAt: new Date().toISOString(),
  };
}

function isCharacterDead(character: CharacterProfile) {
  return character.health <= 0;
}

function normalizePlayerRole(role: string | null | undefined) {
  return (role ?? 'user').toLowerCase();
}

function getMinimapTileColor(tile: string, visibility: 'visible' | 'explored' | 'hidden') {
  if (visibility === 'hidden') {
    return '#020202';
  }

  const isVisible = visibility === 'visible';

  switch (tile) {
    case 'ground':
      return isVisible ? '#9b7b4d' : '#4f3f28';
    case 'water':
      return isVisible ? '#4b86bf' : '#1f3852';
    case 'blocked':
    case 'wall':
    case 'wallEdge':
      return isVisible ? '#2b2826' : '#141312';
    case 'roomFloor':
      return isVisible ? '#7b7365' : '#3c3832';
    case 'roomCracked':
      return isVisible ? '#655d52' : '#312d27';
    case 'corridorFloor':
      return isVisible ? '#6a6258' : '#35302b';
    case 'corridorCracked':
      return isVisible ? '#595248' : '#2c2823';
    case 'spawnFloor':
      return isVisible ? '#caa357' : '#65512b';
    case 'exitFloor':
      return isVisible ? '#9380dd' : '#493f6f';
    default:
      return isVisible ? '#5fa24a' : '#2d4f25';
  }
}

function formatRemainingRaidTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatGoldValue(value: number) {
  return `${Math.max(0, Math.floor(value))}g`;
}

function getTraderOfferPrice(
  offer: TraderOffer,
  itemBalanceConfig: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
) {
  return getResolvedItemValue(offer.itemId, itemBalanceConfig, offer.quantity ?? 1);
}

function normalizeCharacterProfile(character: CharacterProfile): CharacterProfile {
  return {
    ...character,
    gold: typeof character.gold === 'number' ? Math.max(0, Math.floor(character.gold)) : 250,
    quests: character.quests ?? {},
  };
}

function filterVisibleRaidTemplates(
  templates: RaidTemplateView[],
  introductionQuest: IntroductionQuestProgress | null | undefined,
) {
  if (introductionQuest?.rewardClaimedAt) {
    const nonTutorialTemplates = templates.filter((template) => template.code !== CRYPT_SMALL_TEMPLATE_CODE);
    return nonTutorialTemplates.length > 0 ? nonTutorialTemplates : templates;
  }

  const cryptSmallTemplates = templates.filter((template) => template.code === CRYPT_SMALL_TEMPLATE_CODE);
  return cryptSmallTemplates.length > 0 ? cryptSmallTemplates : templates;
}

function getQuestObjectiveTarget(
  activeRoomTarget: ActiveRoomTarget,
  introductionQuest: IntroductionQuestProgress,
): QuestObjectiveTarget {
  if (activeRoomTarget.name === 'world' && introductionQuest.status === 'available') {
    const position = tileToWorldPosition(INTRODUCTION_QUEST_MAGE_TILE);
    return {
      roomName: 'world',
      worldX: position.x,
      worldY: position.y,
      label: 'Старый маг',
    };
  }

  const currentStepId = introductionQuest.currentStepId;
  if (
    activeRoomTarget.name !== 'raid' ||
    !isCryptSmallRaidTarget(activeRoomTarget.options) ||
    introductionQuest.status !== 'active' ||
    !currentStepId
  ) {
    return null;
  }

  switch (currentStepId) {
    case 'loot_chest': {
      const position = tileToWorldPosition(CRYPT_SMALL_TUTORIAL_CHEST_TILE);
      return {
        roomName: 'raid',
        worldX: position.x,
        worldY: position.y,
        label: 'Сундук',
      };
    }
    case 'kill_rat': {
      const position = tileToWorldPosition(CRYPT_SMALL_TUTORIAL_RAT_TILE);
      return {
        roomName: 'raid',
        worldX: position.x,
        worldY: position.y,
        label: 'Крыса',
      };
    }
    case 'find_exit': {
      const position = tileToWorldPosition(CRYPT_SMALL_TUTORIAL_EXIT_TILE);
      return {
        roomName: 'raid',
        worldX: position.x,
        worldY: position.y,
        label: 'Выход',
      };
    }
    default:
      return null;
  }
}

function loadStoredMinimapZoom() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const rawValue = window.localStorage.getItem(MINIMAP_ZOOM_STORAGE_KEY);
  if (!rawValue) {
    return 1;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(4, parsed));
}

function MinimapPanel({
  minimap,
  raidDeadlineAt,
}: {
  minimap: MinimapSnapshot | null;
  raidDeadlineAt: number | null;
}) {
  const MINIMAP_VIEW_SIZE = 240;
  const width = minimap?.width ?? 12;
  const height = minimap?.height ?? 12;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(loadStoredMinimapZoom);
  const [timerNow, setTimerNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(MINIMAP_ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    if (!raidDeadlineAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [raidDeadlineAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const canvasWidth = MINIMAP_VIEW_SIZE;
    const canvasHeight = MINIMAP_VIEW_SIZE;
    const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    canvas.width = canvasWidth * pixelRatio;
    canvas.height = canvasHeight * pixelRatio;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const explored = new Set(minimap?.explored ?? []);
    const visible = new Set(minimap?.visible ?? []);
    const clampedZoom = Math.max(1, Math.min(4, zoom));
    const viewTileWidth = Math.max(6, Math.min(width, width / clampedZoom));
    const viewTileHeight = Math.max(6, Math.min(height, height / clampedZoom));
    const playerTileX = minimap?.playerTile.x ?? Math.floor(width / 2);
    const playerTileY = minimap?.playerTile.y ?? Math.floor(height / 2);
    const viewLeft = Math.max(
      0,
      Math.min(width - viewTileWidth, playerTileX - viewTileWidth / 2),
    );
    const viewTop = Math.max(
      0,
      Math.min(height - viewTileHeight, playerTileY - viewTileHeight / 2),
    );
    const tileRenderSize = Math.min(canvasWidth / viewTileWidth, canvasHeight / viewTileHeight);
    const offsetX = (canvasWidth - viewTileWidth * tileRenderSize) / 2;
    const offsetY = (canvasHeight - viewTileHeight * tileRenderSize) / 2;

    context.fillStyle = '#040803';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let index = 0; index < width * height; index += 1) {
      const tileX = index % width;
      const tileY = Math.floor(index / width);
      if (
        tileX < viewLeft ||
        tileY < viewTop ||
        tileX >= viewLeft + viewTileWidth ||
        tileY >= viewTop + viewTileHeight
      ) {
        continue;
      }
      const tile = minimap?.tiles[index] ?? 'unknown';
      const visibility = visible.has(index) ? 'visible' : explored.has(index) ? 'explored' : 'hidden';
      context.fillStyle = getMinimapTileColor(tile, visibility);
      context.fillRect(
        offsetX + (tileX - viewLeft) * tileRenderSize,
        offsetY + (tileY - viewTop) * tileRenderSize,
        tileRenderSize,
        tileRenderSize,
      );
    }

    if (minimap) {
      context.fillStyle = '#f4ffe8';
      context.shadowColor = 'rgba(244,255,232,0.75)';
      context.shadowBlur = Math.max(2, tileRenderSize);
      context.fillRect(
        offsetX + (minimap.playerTile.x - viewLeft) * tileRenderSize + tileRenderSize * 0.22,
        offsetY + (minimap.playerTile.y - viewTop) * tileRenderSize + tileRenderSize * 0.22,
        tileRenderSize * 0.56,
        tileRenderSize * 0.56,
      );
      context.shadowBlur = 0;
    }
  }, [height, minimap, width, zoom]);

  const remainingRaidMs = raidDeadlineAt ? Math.max(0, raidDeadlineAt - timerNow) : 0;

  return (
    <section className="absolute left-5 top-5 z-10 rounded-2xl border border-[#d9efbd]/40 bg-[#17320d]/68 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#bfd8a4]">
          {minimap?.roomName === 'raid' ? 'Raid Minimap' : 'World Minimap'}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-[#dceec9]">
            {minimap ? `${minimap.playerTile.x + 1}:${minimap.playerTile.y + 1}` : '--:--'}
          </div>
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#d9efbd]/22 bg-[#203b11]/70 text-xs font-bold text-[#f4ffe8] transition hover:bg-[#294816]/72"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setZoom((current) => Math.min(4, Number((current + 0.25).toFixed(2))))}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#d9efbd]/22 bg-[#203b11]/70 text-xs font-bold text-[#f4ffe8] transition hover:bg-[#294816]/72"
            >
              +
            </button>
          </div>
        </div>
      </div>
      {minimap?.roomName === 'raid' && raidDeadlineAt ? (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#bfd8a4]">
            Raid Deadline
          </div>
          <div className="font-mono text-sm font-semibold text-[#ffe3b5]">
            {formatRemainingRaidTime(remainingRaidMs)}
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-[#d9efbd]/20 bg-[#0d1608]/80 p-1">
        <canvas ref={canvasRef} className="block" />
      </div>
    </section>
  );
}

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [locale, setLocale] = useState<Locale>(() => loadStoredLocale());
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authForm, setAuthForm] = useState<AuthFormState>(INITIAL_FORM);
  const [authError, setAuthError] = useState('');
  const [username, setUsername] = useState('');
  const [playerRole, setPlayerRole] = useState('user');
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [minimap, setMinimap] = useState<MinimapSnapshot | null>(null);
  const [containers, setContainers] = useState<Record<string, ContainerView>>({});
  const [activeContainerId, setActiveContainerId] = useState<string | null>(null);
  const [nearbyChestId, setNearbyChestId] = useState<string | null>(null);
  const [nearbyTraderId, setNearbyTraderId] = useState<string | null>(null);
  const [activeTrader, setActiveTrader] = useState<WorldTraderInteraction | null>(null);
  const [activeTraderTab, setActiveTraderTab] = useState<TraderTabId>('shop');
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [collapsedQuestLogIds, setCollapsedQuestLogIds] = useState<string[]>([]);
  const [selectedTraderOfferId, setSelectedTraderOfferId] = useState<ItemId | null>(null);
  const [selectedTraderSellIndex, setSelectedTraderSellIndex] = useState<number | null>(null);
  const [selectedTraderPanel, setSelectedTraderPanel] = useState<'buy' | 'sell'>('buy');
  const [traderStatus, setTraderStatus] = useState('');
  const [activeSkillTargeting, setActiveSkillTargeting] = useState<ActiveSkillTargeting>(null);
  const [skillCooldowns, setSkillCooldowns] = useState<SkillCooldownState>({});
  const [consumableCooldowns, setConsumableCooldowns] = useState<ConsumableCooldownState>({});
  const [isDead, setIsDead] = useState(false);
  const [respawnRequestNonce, setRespawnRequestNonce] = useState(0);
  const [pendingRaidWorldRespawn, setPendingRaidWorldRespawn] = useState(false);
  const [fireNovaCastNonce, setFireNovaCastNonce] = useState(0);
  const [useConsumableRequest, setUseConsumableRequest] = useState<{
    source: 'inventory' | 'container';
    slotIndex: number;
    containerId?: string;
    nonce: number;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<RealtimeChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [party, setParty] = useState<PartyView | null>(null);
  const [partyJoinCode, setPartyJoinCode] = useState('');
  const [raidTemplates, setRaidTemplates] = useState<RaidTemplateView[]>([]);
  const [selectedRaidTemplateCode, setSelectedRaidTemplateCode] = useState('');
  const [lastStartedRaid, setLastStartedRaid] = useState<StartedRaidView | null>(null);
  const [activeRoomTarget, setActiveRoomTarget] = useState<ActiveRoomTarget>(
    () => loadStoredActiveRoomTarget() ?? { name: 'world' },
  );
  const [lobbyActionError, setLobbyActionError] = useState('');
  const [lobbyActionMessage, setLobbyActionMessage] = useState('');
  const [lobbyBusy, setLobbyBusy] = useState(false);
  const [lobbyToolsVisible, setLobbyToolsVisible] = useState(true);
  const [adminImageOptions, setAdminImageOptions] = useState<string[]>([]);
  const [adminImageSearch, setAdminImageSearch] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTabId>('skills');
  const [adminToolsVisible, setAdminToolsVisible] = useState(true);
  const [worldMapDraft, setWorldMapDraft] = useState<MeadowMapAsset | null>(null);
  const [selectedWorldTile, setSelectedWorldTile] = useState<MeadowTile>('grassGround');
  const [worldEditorMode, setWorldEditorMode] = useState<WorldEditorMode>('tile');
  const [selectedWorldOverlay, setSelectedWorldOverlay] = useState<WorldOverlayBrush>({
    texture: 'ground-grass-edge-8x8',
    rotation: 0,
    flipX: false,
  });
  const [selectedWorldSprite, setSelectedWorldSprite] = useState<WorldSpriteBrush>({
    texturePath: '',
    rotation: 0,
    flipX: false,
    scale: 1,
  });
  const text = getPageText(locale);
  const introductionQuestSteps = getIntroductionQuestSteps(locale);
  const sealedRelicQuestSteps = getSealedRelicQuestSteps(locale);
  const [selectedWorldTrader, setSelectedWorldTrader] = useState<WorldTraderBrush>({
    name: 'Trader',
    bodyTexturePath: '',
    headTexturePath: '',
  });
  const [selectedWorldSpriteFolder, setSelectedWorldSpriteFolder] = useState('');
  const [worldMapStatus, setWorldMapStatus] = useState('');
  const [worldHoverTile, setWorldHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [worldEditorDebug, setWorldEditorDebug] = useState<WorldEditorDebugState>({
    textureKey: '',
    textureLoaded: false,
  });
  const [skillEffectOverrides, setSkillEffectOverrides] = useState<SkillEffectOverrides>(
    DEFAULT_SKILL_EFFECT_OVERRIDES,
  );
  const [skillBalanceConfig, setSkillBalanceConfig] = useState<SkillBalanceConfig>(
    DEFAULT_SKILL_BALANCE_CONFIG,
  );
  const [skillBalanceDraft, setSkillBalanceDraft] = useState<SkillBalanceConfig>(
    DEFAULT_SKILL_BALANCE_CONFIG,
  );
  const [mobBalanceConfig, setMobBalanceConfig] = useState<MobBalanceConfig>(
    DEFAULT_MOB_BALANCE_CONFIG,
  );
  const [mobBalanceDraft, setMobBalanceDraft] = useState<MobBalanceConfig>(
    DEFAULT_MOB_BALANCE_CONFIG,
  );
  const [itemBalanceConfig, setItemBalanceConfig] = useState<ItemBalanceConfig>(
    DEFAULT_ITEM_BALANCE_CONFIG,
  );
  const [itemBalanceDraft, setItemBalanceDraft] = useState<ItemBalanceConfig>(
    DEFAULT_ITEM_BALANCE_CONFIG,
  );
  const [adminItemBusyId, setAdminItemBusyId] = useState<string | null>(null);
  const [adminItemStatus, setAdminItemStatus] = useState('');
  const [selectedAdminItemId, setSelectedAdminItemId] = useState<ItemId>(
    ADMIN_ITEM_DEFINITIONS[0]?.id ?? 'magic_hat',
  );
  const [adminGemColorOverrides, setAdminGemColorOverrides] = useState<AdminGemColorOverrides>(
    loadAdminGemColorOverrides,
  );
  const skipFirstSaveRef = useRef(true);
  const skillBalanceLoadedRef = useRef(false);
  const skillBalancePersistedRef = useRef(JSON.stringify(DEFAULT_SKILL_BALANCE_CONFIG));
  const mobBalanceLoadedRef = useRef(false);
  const mobBalancePersistedRef = useRef(JSON.stringify(DEFAULT_MOB_BALANCE_CONFIG));
  const itemBalanceLoadedRef = useRef(false);
  const itemBalancePersistedRef = useRef(JSON.stringify(DEFAULT_ITEM_BALANCE_CONFIG));
  const chatSenderRef = useRef<((text: string) => void) | null>(null);
  const objectiveArrowRef = useRef<HTMLDivElement>(null);
  const objectiveArrowLabelRef = useRef<HTMLDivElement>(null);
  const tutorialUiArrowRef = useRef<HTMLDivElement>(null);
  const tutorialUiArrowLabelRef = useRef<HTMLDivElement>(null);
  const traderQuestsTabButtonRef = useRef<HTMLButtonElement | null>(null);
  const traderAcceptQuestButtonRef = useRef<HTMLButtonElement | null>(null);
  const lobbyToolsToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const startRaidButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const handleObjectiveArrowChange = useCallback((state: ObjectiveArrowState) => {
    const arrowEl = objectiveArrowRef.current;
    const labelEl = objectiveArrowLabelRef.current;
    if (!arrowEl || !labelEl) return;

    if (!state || !state.visible) {
      arrowEl.style.display = 'none';
      labelEl.style.display = 'none';
      return;
    }

    arrowEl.style.display = '';
    arrowEl.style.transform = `translate(-50%, -50%) translate(${state.screenX}px, ${state.screenY}px) rotate(${state.rotation}rad)`;
    labelEl.style.display = '';
    labelEl.style.transform = `translate(-50%, -50%) translate(${state.screenX}px, ${state.screenY - (state.isOnScreen ? 28 : 24)}px)`;
    labelEl.textContent = state.label;
  }, []);
  const handleTutorialUiArrowChange = useCallback((state: ObjectiveArrowState) => {
    const arrowEl = tutorialUiArrowRef.current;
    const labelEl = tutorialUiArrowLabelRef.current;
    if (!arrowEl || !labelEl) return;

    if (!state || !state.visible) {
      arrowEl.style.display = 'none';
      labelEl.style.display = 'none';
      return;
    }

    arrowEl.style.display = '';
    arrowEl.style.transform = `translate(-50%, -50%) translate(${state.screenX}px, ${state.screenY}px) rotate(${state.rotation}rad)`;
    labelEl.style.display = '';
    labelEl.textContent = state.label;

    const safePaddingX = Math.max(56, Math.min(92, window.innerWidth * 0.09));
    const safePaddingY = Math.max(56, Math.min(92, window.innerHeight * 0.12));
    const labelHalfWidth = Math.ceil(labelEl.offsetWidth / 2);
    const labelHeight = Math.ceil(labelEl.offsetHeight);
    const labelX = Math.max(
      safePaddingX + labelHalfWidth,
      Math.min(window.innerWidth - safePaddingX - labelHalfWidth, state.screenX),
    );
    const labelY = Math.max(
      safePaddingY + labelHeight,
      Math.min(window.innerHeight - safePaddingY, state.screenY - 28),
    );
    labelEl.style.transform = `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`;
  }, []);
  const activeRoomHydratedRef = useRef(false);
  const raidDeadlineAt =
    activeRoomTarget.name === 'raid' && typeof activeRoomTarget.options?.deadlineAt === 'number'
      ? activeRoomTarget.options.deadlineAt
      : lastStartedRaid?.startedAt
        ? new Date(lastStartedRaid.startedAt).getTime() + RAID_DEADLINE_MS
        : null;

  const activatePendingRaid = (pendingRaid: NonNullable<PartyView['pendingRaid']>) => {
    const deadlineAt = pendingRaid.startedAt
      ? new Date(pendingRaid.startedAt).getTime() + RAID_DEADLINE_MS
      : Date.now() + RAID_DEADLINE_MS;
    setActiveRoomTarget({
      name: 'raid',
      options: {
        ...pendingRaid.realtimeRoom.options,
        deadlineAt,
      },
    });
  };

  const refreshLobbyState = async (questOverride?: IntroductionQuestProgress | null) => {
    const [nextParty, nextTemplates] = await Promise.all([
      loadMyParty(),
      loadRaidTemplates(),
    ]);
    const visibleTemplates = filterVisibleRaidTemplates(
      nextTemplates,
      questOverride ?? (character ? getIntroductionQuestProgress(character) : null),
    );

    setParty(nextParty);
    setRaidTemplates(visibleTemplates);
    setSelectedRaidTemplateCode((current) => {
      if (current && visibleTemplates.some((template) => template.code === current)) {
        return current;
      }

      return visibleTemplates[0]?.code ?? '';
    });
  };

  useEffect(() => {
    void (async () => {
      const session = await loadSessionPlayer();
      if (!session) {
        setAuthStatus('guest');
        return;
      }

      const nextCharacter = normalizeCharacterProfile(session.character);
      setUsername(session.username);
      setPlayerRole(normalizePlayerRole(session.role));
      setCharacter(nextCharacter);
      setIsDead(isCharacterDead(nextCharacter));
      setAuthStatus('ready');
    })();
  }, []);

  useEffect(() => {
    setSkillEffectOverrides(loadStoredSkillEffectOverrides());
    setAdminToolsVisible(loadAdminToolsVisible());
    setLobbyToolsVisible(loadLobbyToolsVisible());
  }, []);

  useEffect(() => {
    if (!activeContainerId) {
      return;
    }

    if (!(activeContainerId in containers)) {
      setActiveContainerId(null);
    }
  }, [activeContainerId, containers]);

  useEffect(() => {
    if (!activeContainerId) {
      return;
    }

    if (nearbyChestId !== activeContainerId) {
      setActiveContainerId(null);
    }
  }, [activeContainerId, nearbyChestId]);

  useEffect(() => {
    if (!activeTrader) {
      return;
    }

    if (nearbyTraderId !== activeTrader.id) {
      setActiveTrader(null);
      setActiveTraderTab('shop');
      setSelectedTraderOfferId(null);
      setSelectedTraderSellIndex(null);
      setSelectedTraderPanel('buy');
      setTraderStatus('');
    }
  }, [activeTrader, nearbyTraderId]);

  useEffect(() => {
    if (!activeTrader) {
      setSelectedTraderOfferId(null);
      return;
    }

    const offers = getTraderOffers(activeTrader);
    const hasSelectedOffer = selectedTraderOfferId
      ? offers.some((offer) => offer.itemId === selectedTraderOfferId)
      : false;

    if (!hasSelectedOffer) {
      setSelectedTraderOfferId(offers[0]?.itemId ?? null);
    }
  }, [activeTrader, selectedTraderOfferId]);

  useEffect(() => {
    if (!character) {
      setSelectedTraderSellIndex(null);
      return;
    }

    if (selectedTraderSellIndex === null) {
      return;
    }

    if (!character.inventory[selectedTraderSellIndex]) {
      const nextSellIndex = character.inventory.findIndex((entry) => entry !== null);
      setSelectedTraderSellIndex(nextSellIndex === -1 ? null : nextSellIndex);
      if (nextSellIndex === -1 && selectedTraderPanel === 'sell') {
        setSelectedTraderPanel('buy');
      }
    }
  }, [character, selectedTraderPanel, selectedTraderSellIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      ADMIN_EFFECTS_STORAGE_KEY,
      JSON.stringify(skillEffectOverrides),
    );
  }, [skillEffectOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      ADMIN_GEM_COLORS_STORAGE_KEY,
      JSON.stringify(adminGemColorOverrides),
    );
  }, [adminGemColorOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      ADMIN_TOOLS_VISIBLE_STORAGE_KEY,
      String(adminToolsVisible),
    );
  }, [adminToolsVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      LOBBY_TOOLS_VISIBLE_STORAGE_KEY,
      String(lobbyToolsVisible),
    );
  }, [lobbyToolsVisible]);

  useEffect(() => {
    if (authStatus !== 'ready' || playerRole !== 'admin') {
      return;
    }

    void fetch('/api/admin/public-images')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load public images.');
        }

        return response.json() as Promise<{ images: string[] }>;
      })
      .then((payload) => {
        setAdminImageOptions(payload.images);
      })
      .catch((error) => {
        console.error('Failed to load admin image list', error);
      });

    void fetch('/api/admin/maps/world')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load world map asset.');
        }

        return response.json() as Promise<MeadowMapAsset>;
      })
      .then((asset) => {
        setWorldMapDraft(asset);
      })
      .catch((error) => {
        console.error('Failed to load world map asset', error);
      });
  }, [authStatus, playerRole]);

  useEffect(() => {
    if (!adminImageOptions.length) {
      return;
    }

    const nextWorldSpriteFolders = Array.from(
      new Set(
        adminImageOptions.map((imagePath) => {
          const lastSlashIndex = imagePath.lastIndexOf('/');
          return lastSlashIndex > 0 ? imagePath.slice(0, lastSlashIndex) : '/';
        }),
      ),
    ).sort((left, right) => left.localeCompare(right));

    const nextFolder = nextWorldSpriteFolders.includes(selectedWorldSpriteFolder)
      ? selectedWorldSpriteFolder
      : nextWorldSpriteFolders[0] ?? '';

    if (nextFolder && nextFolder !== selectedWorldSpriteFolder) {
      setSelectedWorldSpriteFolder(nextFolder);
      return;
    }

    const nextWorldSpriteOptions = adminImageOptions.filter((imagePath) =>
      nextFolder ? imagePath.startsWith(`${nextFolder}/`) : true,
    );

    if (!nextWorldSpriteOptions.length) {
      return;
    }

    if (!selectedWorldSprite.texturePath || !nextWorldSpriteOptions.includes(selectedWorldSprite.texturePath)) {
      setSelectedWorldSprite((current) => ({
        ...current,
        texturePath: nextWorldSpriteOptions[0],
      }));
    }
  }, [adminImageOptions, selectedWorldSprite.texturePath, selectedWorldSpriteFolder]);

  useEffect(() => {
    if (!adminImageOptions.length) {
      return;
    }

    const traderHeadOptions = adminImageOptions
      .filter((imagePath) => /head/i.test(imagePath))
      .sort((left, right) => left.localeCompare(right));
    const traderBodyOptions = adminImageOptions
      .filter((imagePath) => /(body|tunic|robe|blacksmith)/i.test(imagePath))
      .sort((left, right) => left.localeCompare(right));

    setSelectedWorldTrader((current) => ({
      ...current,
      headTexturePath:
        current.headTexturePath && traderHeadOptions.includes(current.headTexturePath)
          ? current.headTexturePath
          : (traderHeadOptions[0] ?? current.headTexturePath),
      bodyTexturePath:
        current.bodyTexturePath && traderBodyOptions.includes(current.bodyTexturePath)
          ? current.bodyTexturePath
          : (traderBodyOptions[0] ?? current.bodyTexturePath),
    }));
  }, [adminImageOptions]);

  useEffect(() => {
    if (authStatus !== 'ready') {
      return;
    }

    void refreshLobbyState().catch((error) => {
      console.error('Failed to load world state', error);
    });

    void loadSkillBalanceConfig()
      .then((config) => {
        skillBalanceLoadedRef.current = true;
        skillBalancePersistedRef.current = JSON.stringify(config);
        setSkillBalanceConfig(config);
        setSkillBalanceDraft(config);
      })
      .catch((error) => {
        console.error('Failed to load skill balance config', error);
      });

    void loadMobBalanceConfig()
      .then((config) => {
        mobBalanceLoadedRef.current = true;
        mobBalancePersistedRef.current = JSON.stringify(config);
        setMobBalanceConfig(config);
        setMobBalanceDraft(config);
      })
      .catch((error) => {
        console.error('Failed to load mob balance config', error);
      });

    void loadItemBalanceConfig()
      .then((config) => {
        itemBalanceLoadedRef.current = true;
        itemBalancePersistedRef.current = JSON.stringify(config);
        setItemBalanceConfig(config);
        setItemBalanceDraft(config);
      })
      .catch((error) => {
        console.error('Failed to load item balance config', error);
      });
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== 'ready') {
      return;
    }

    let cancelled = false;

    const syncPartyState = async () => {
      const nextParty = await loadMyParty();
      if (cancelled) {
        return;
      }

      setParty(nextParty);
      if (
        nextParty?.pendingRaid &&
        activeRoomTarget.name !== 'raid' &&
        !pendingRaidWorldRespawn
      ) {
        activatePendingRaid(nextParty.pendingRaid);
        setLobbyActionMessage('Party entered raid.');
        setLobbyActionError('');
      }
    };

    void syncPartyState().catch((error) => {
      console.error('Failed to sync party state', error);
    });

    const intervalId = window.setInterval(() => {
      void syncPartyState().catch((error) => {
        console.error('Failed to sync party state', error);
      });
    }, PARTY_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authStatus, activeRoomTarget.name, pendingRaidWorldRespawn]);

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }

    if (authStatus !== 'ready') {
      setParty(null);
      setRaidTemplates([]);
      setSelectedRaidTemplateCode('');
      setLastStartedRaid(null);
      setActiveRoomTarget({ name: 'world' });
      setLobbyActionError('');
      setLobbyActionMessage('');
      setPartyJoinCode('');
      return;
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== 'ready') {
      return;
    }

    if (!activeRoomHydratedRef.current) {
      const storedTarget = loadStoredActiveRoomTarget();
      if (storedTarget) {
        setActiveRoomTarget(storedTarget);
      }
      activeRoomHydratedRef.current = true;
    }
  }, [authStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus !== 'ready') {
      window.localStorage.removeItem(ACTIVE_ROOM_TARGET_STORAGE_KEY);
      activeRoomHydratedRef.current = false;
      return;
    }

    if (!activeRoomHydratedRef.current) {
      return;
    }

    window.localStorage.setItem(
      ACTIVE_ROOM_TARGET_STORAGE_KEY,
      JSON.stringify(activeRoomTarget),
    );
  }, [activeRoomTarget, authStatus]);

  useEffect(() => {
    if (
      authStatus !== 'ready' ||
      playerRole !== 'admin' ||
      !skillBalanceLoadedRef.current
    ) {
      return;
    }

    const serialized = JSON.stringify(skillBalanceConfig);
    if (serialized === skillBalancePersistedRef.current) {
      return;
    }

    skillBalancePersistedRef.current = serialized;
    void saveSkillBalanceConfig(skillBalanceConfig).catch((error) => {
      console.error('Failed to save skill balance config', error);
    });
  }, [authStatus, playerRole, skillBalanceConfig]);

  useEffect(() => {
    if (
      authStatus !== 'ready' ||
      playerRole !== 'admin' ||
      !mobBalanceLoadedRef.current
    ) {
      return;
    }

    const serialized = JSON.stringify(mobBalanceConfig);
    if (serialized === mobBalancePersistedRef.current) {
      return;
    }

    mobBalancePersistedRef.current = serialized;
    void saveMobBalanceConfig(mobBalanceConfig).catch((error) => {
      console.error('Failed to save mob balance config', error);
    });
  }, [authStatus, playerRole, mobBalanceConfig]);

  useEffect(() => {
    if (
      authStatus !== 'ready' ||
      playerRole !== 'admin' ||
      !itemBalanceLoadedRef.current
    ) {
      return;
    }

    const serialized = JSON.stringify(itemBalanceConfig);
    if (serialized === itemBalancePersistedRef.current) {
      return;
    }

    itemBalancePersistedRef.current = serialized;
    void saveItemBalanceConfig(itemBalanceConfig).catch((error) => {
      console.error('Failed to save item balance config', error);
    });
  }, [authStatus, playerRole, itemBalanceConfig]);

  useEffect(() => {
    if (authStatus !== 'ready' || !character) {
      return;
    }

    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }

    void saveCharacter(character).catch((error) => {
        console.error('Failed to save character', error);
      });
  }, [authStatus, character]);

  const preventContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const preventPrimaryMouseDefault = (event: MouseEvent<HTMLElement>) => {
    if (event.button === 0) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
      setChatInputFocused(false);
      if (activeSkillTargeting) {
        return;
      }
      event.preventDefault();
    }
  };

  const handleFieldChange =
    (field: keyof AuthFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setAuthForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handleAuthSubmit = async () => {
    try {
      const result =
        authMode === 'register'
          ? await registerPlayer({
              nickname: authForm.nickname,
              password: authForm.password,
            })
          : await loginPlayer({
              nickname: authForm.nickname,
              password: authForm.password,
            });

      const nextCharacter = normalizeCharacterProfile(result.character);
      setUsername(result.username);
      setPlayerRole(normalizePlayerRole(result.role));
      setCharacter(nextCharacter);
      setIsDead(isCharacterDead(nextCharacter));
      setAuthError('');
      setAuthStatus('ready');
      setAuthForm(INITIAL_FORM);
      skipFirstSaveRef.current = true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Auth failed.');
    }
  };

  const runLobbyAction = async (action: () => Promise<void>) => {
    setLobbyBusy(true);
    setLobbyActionError('');
    setLobbyActionMessage('');

    try {
      await action();
    } catch (error) {
      setLobbyActionError(error instanceof Error ? error.message : 'Lobby action failed.');
    } finally {
      setLobbyBusy(false);
    }
  };

  const handleLogout = () => {
    if (character) {
      void saveCharacter(character).catch((error) => {
        console.error('Failed to save character before logout', error);
      });
    }

    logoutPlayer();
    setUsername('');
    setPlayerRole('user');
    setCharacter(null);
    setAuthStatus('guest');
    setChatMessages(INITIAL_CHAT_MESSAGES);
    setActiveSkillTargeting(null);
    setSkillCooldowns({});
    setParty(null);
    setRaidTemplates([]);
    setSelectedRaidTemplateCode('');
    setLastStartedRaid(null);
    setActiveRoomTarget({ name: 'world' });
    setLobbyActionError('');
    setLobbyActionMessage('');
    setPartyJoinCode('');
    setIsDead(false);
    setFireNovaCastNonce(0);
    chatSenderRef.current = null;
    skipFirstSaveRef.current = true;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTIVE_ROOM_TARGET_STORAGE_KEY);
    }
  };

  const handleCreateParty = () => {
    if (isPartyLocked) {
      setLobbyActionError(partyLockMessage);
      setLobbyActionMessage('');
      return;
    }

    void runLobbyAction(async () => {
      const nextParty = await createParty();
      setParty(nextParty);
      setLobbyActionMessage(`Party ${nextParty.code} created.`);
    });
  };

  const handleJoinParty = () => {
    if (isPartyLocked) {
      setLobbyActionError(partyLockMessage);
      setLobbyActionMessage('');
      return;
    }

    const code = partyJoinCode.trim().toUpperCase();
    if (!code) {
      setLobbyActionError('Enter a party code.');
      setLobbyActionMessage('');
      return;
    }

    void runLobbyAction(async () => {
      const nextParty = await joinParty(code);
      setParty(nextParty);
      setPartyJoinCode('');
      setLobbyActionMessage(`Joined party ${nextParty.code}.`);
    });
  };

  const handleLeaveParty = () => {
    void runLobbyAction(async () => {
      const nextParty = await leaveParty();
      setParty(nextParty);
      setLobbyActionMessage(nextParty ? 'You left the party.' : 'Party closed.');
    });
  };

  const handleToggleReady = () => {
    if (!party) {
      return;
    }

    const currentMember = party.members.find((member) => member.nickname === username);
    const nextReady = !(currentMember?.isReady ?? false);

    void runLobbyAction(async () => {
      const nextParty = await setPartyReady(nextReady);
      setParty(nextParty);
      setLobbyActionMessage(nextReady ? 'Ready enabled.' : 'Ready removed.');
    });
  };

  const handleStartRaid = () => {
    if (!selectedRaidTemplateCode) {
      setLobbyActionError('Select a raid template.');
      setLobbyActionMessage('');
      return;
    }

    if (
      selectedRaidTemplateCode === CRYPT_SMALL_TEMPLATE_CODE &&
      introductionQuest.status !== 'active'
    ) {
      setLobbyActionError(
        hasStartedIntroductionQuest
          ? 'The first crypt is already closed. Return to the Old Mage or continue in regular raids.'
          : resolvedCryptSmallLockMessage,
      );
      setLobbyActionMessage('');
      return;
    }

    void runLobbyAction(async () => {
      const startedRaid = await startRaid(selectedRaidTemplateCode, party?.id);
      setLastStartedRaid(startedRaid);
      const deadlineAt = startedRaid.startedAt
        ? new Date(startedRaid.startedAt).getTime() + RAID_DEADLINE_MS
        : Date.now() + RAID_DEADLINE_MS;
      setActiveRoomTarget({
        name: 'raid',
        options: {
          ...startedRaid.realtimeRoom.options,
          deadlineAt,
        },
      });
      setLobbyActionMessage(
        startedRaid.joinedExisting
          ? `Joined recent raid ${startedRaid.template.name}. Room: ${startedRaid.realtimeRoom.roomName}.`
          : `Raid ${startedRaid.template.name} created. Room: ${startedRaid.realtimeRoom.roomName}.`,
      );
    });
  };

  const handleRoomConnected = (payload: {
    roomName: 'world' | 'raid';
    options?: Record<string, string | number>;
  }) => {
    if (payload.roomName !== 'raid') {
      return;
    }

    const raidRunId = typeof payload.options?.raidRunId === 'string'
      ? payload.options.raidRunId
      : undefined;
    void ackPendingRaidJoin(raidRunId)
      .then((nextParty) => {
        setParty(nextParty);
      })
      .catch((error) => {
        console.error('Failed to acknowledge pending raid join', error);
      });
  };

  const handleReturnToLobby = () => {
    setActiveRoomTarget({ name: 'world' });
    setLobbyActionMessage('Returned to world.');
    setLobbyActionError('');
  };

  const handleRespawnRequest = () => {
    setActiveSkillTargeting(null);
    setActiveContainerId(null);
    setPendingRaidWorldRespawn(false);
    setActiveRoomTarget({
      name: 'world',
      options: {
        respawnJoinNonce: Date.now(),
      },
    });
    setRespawnRequestNonce((current) => current + 1);
  };

  const handleRaidExit = (payload?: {
    raidRunId?: string;
    exitId?: string;
    reason?: string;
    health?: number;
    maxHealth?: number;
    level?: number;
    experience?: number;
    equipment?: EquipmentState;
    inventory?: InventoryState;
  }) => {
    const shouldRespawnInWorld = payload?.reason === 'defeated' || !payload?.exitId;
    const extractedInventory = payload?.inventory ? payload.inventory : character?.inventory ?? [];
    const finishedTutorialRaid =
      activeRoomTarget.name === 'raid' &&
      isCryptSmallRaidTarget(activeRoomTarget.options) &&
      introductionQuest.status === 'active' &&
      introductionQuest.currentStepId === 'find_exit' &&
      payload?.reason === 'extracted' &&
      Boolean(payload?.exitId);
    const finishedSealedRelicRaid =
      activeRoomTarget.name === 'raid' &&
      activeRoomTarget.options?.templateCode === CRYPT_MEDIUM_TEMPLATE_CODE &&
      sealedRelicQuest.status === 'active' &&
      payload?.reason === 'extracted' &&
      Boolean(payload?.exitId) &&
      hasInventoryItem(extractedInventory, SEALED_RELIC_ITEM_ID);
    setCharacter((current) =>
      current
        ? (() => {
            const nextCharacterBase = {
              ...current,
              health: typeof payload?.health === 'number' ? payload.health : current.health,
              maxHealth: typeof payload?.maxHealth === 'number' ? payload.maxHealth : current.maxHealth,
              level: typeof payload?.level === 'number' ? payload.level : current.level,
              experience: typeof payload?.experience === 'number' ? payload.experience : current.experience,
              equipment: payload?.equipment ? payload.equipment : current.equipment,
              inventory: payload?.inventory ? payload.inventory : current.inventory,
            };
            const withIntroductionQuest = updateIntroductionQuestProgress(
              nextCharacterBase,
              (quest) => {
                if (quest.status !== 'active' || !isCryptSmallRaidTarget(activeRoomTarget.options)) {
                  return quest;
                }

                if (finishedTutorialRaid) {
                  return {
                    ...quest,
                    status: 'ready',
                    currentStepId: 'find_exit',
                    completedAt: null,
                    rewardClaimedAt: null,
                    activeRaidRunId: null,
                    killRatExperienceBaseline: null,
                  };
                }

                return {
                  ...quest,
                  activeRaidRunId: null,
                  killRatExperienceBaseline: quest.currentStepId === 'kill_rat' ? null : quest.killRatExperienceBaseline,
                };
              },
            );

            return updateQuestProgress(withIntroductionQuest, SEALED_RELIC_QUEST_ID, (quest) => {
              if (quest.status !== 'active' || activeRoomTarget.options?.templateCode !== CRYPT_MEDIUM_TEMPLATE_CODE) {
                return quest;
              }

              if (finishedSealedRelicRaid) {
                return {
                  ...quest,
                  status: 'ready',
                  currentStepId: 'extract_with_relic',
                  completedAt: null,
                  rewardClaimedAt: null,
                };
              }

              return quest;
            });
          })()
        : current,
    );
    setIsDead(shouldRespawnInWorld);
    setPendingRaidWorldRespawn(shouldRespawnInWorld);
    setActiveRoomTarget({ name: 'world' });
    setLobbyActionMessage(
      finishedTutorialRaid
        ? 'Крипта пройдена. Старый маг заметит, что астральный путь для тебя начал раскрываться.'
        : finishedSealedRelicRaid
        ? 'You escaped with the Sealed Relic. Return it to the Old Mage.'
        : payload?.reason === 'defeated'
        ? 'You were killed in the raid and dropped your loot.'
        : payload?.exitId
        ? 'Escaped the raid with your loot.'
        : 'Raid expired. You died and dropped your loot.',
    );
    setLobbyActionError('');
  };

  useEffect(() => {
    if (!pendingRaidWorldRespawn || authStatus !== 'ready' || activeRoomTarget.name !== 'world') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRespawnRequestNonce((current) => current + 1);
      setPendingRaidWorldRespawn(false);
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [activeRoomTarget.name, authStatus, pendingRaidWorldRespawn]);

  const handleEquipmentChange = (equipment: EquipmentState) => {
    setCharacter((current) =>
      current
        ? {
            ...current,
            equipment,
          }
        : null,
    );
  };

  const handleInventoryChange = (inventory: InventoryState) => {
    setCharacter((current) =>
      current
        ? {
            ...current,
            inventory,
          }
        : null,
    );
  };

  const handleInventoryUse = (request: { type: 'inventory'; slotIndex: number } | { type: 'container'; containerId: string; slotIndex: number }) => {
    setUseConsumableRequest((current) => ({
      source: request.type,
      slotIndex: request.slotIndex,
      containerId: request.type === 'container' ? request.containerId : undefined,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  };

  const handleChestInteract = (chestId: string) => {
    setActiveTrader(null);
    setSelectedTraderSellIndex(null);
    setSelectedTraderPanel('buy');
    setTraderStatus('');
    setActiveContainerId((current) =>
      current === chestId ? null : chestId,
    );
  };

  const handleTraderInteract = (trader: WorldTraderInteraction) => {
    const firstSellIndex = character?.inventory.findIndex((entry) => entry !== null) ?? -1;
    setActiveContainerId(null);
    setActiveSkillTargeting(null);
    setActiveTraderTab('shop');
    setSelectedTraderOfferId(getTraderOffers(trader)[0]?.itemId ?? null);
    setSelectedTraderSellIndex(firstSellIndex === -1 ? null : firstSellIndex);
    setSelectedTraderPanel('buy');
    setTraderStatus('');
    setActiveTrader(trader);
  };

  const handleAcceptIntroductionQuest = () => {
    if (!character) {
      return;
    }

    setCharacter((current) => {
      if (!current) {
        return current;
      }

      return updateIntroductionQuestProgress(current, (quest) => ({
        ...quest,
        status: 'active',
        currentStepId: 'loot_chest',
        acceptedAt: new Date().toISOString(),
        completedAt: null,
        rewardClaimedAt: null,
        activeRaidRunId: null,
        killRatExperienceBaseline: null,
      }));
    });
    setSelectedRaidTemplateCode(CRYPT_SMALL_TEMPLATE_CODE);
    setLobbyToolsVisible(true);
    setTraderStatus('Старый маг указал путь. Открой окно Party & Raid и войди в Crypt Small.');
  };

  const handleCompleteIntroductionQuest = () => {
    const completedAt = new Date().toISOString();
    setCharacter((current) =>
      current
        ? (() => {
            const quest = getIntroductionQuestProgress(current);
            const canTurnIn =
              quest.status === 'ready' ||
              (quest.status === 'completed' && quest.rewardClaimedAt === null);
            if (!canTurnIn) {
              return current;
            }

            return updateIntroductionQuestProgress(
              {
                ...current,
                gold: current.gold + 100,
              },
              (nextQuest) => ({
                ...nextQuest,
                status: 'completed',
                currentStepId: null,
                completedAt,
                rewardClaimedAt: completedAt,
                activeRaidRunId: null,
                killRatExperienceBaseline: null,
              }),
            );
          })()
        : current,
    );
    setTraderStatus('Quest completed. You received 100 gold. Parties and standard raids are now unlocked.');
    void refreshLobbyState({
      ...(character ? getIntroductionQuestProgress(character) : {
        status: 'available',
        currentStepId: null,
        acceptedAt: null,
        completedAt: null,
        activeRaidRunId: null,
        killRatExperienceBaseline: null,
      }),
      status: 'completed',
      currentStepId: null,
      completedAt,
      rewardClaimedAt: completedAt,
      activeRaidRunId: null,
      killRatExperienceBaseline: null,
    }).catch((error) => {
      console.error('Failed to refresh lobby after quest completion', error);
    });
  };

  const handleAcceptSealedRelicQuest = () => {
    if (!character) {
      return;
    }

    const acceptedAt = new Date().toISOString();
    setCharacter((current) => {
      if (!current) {
        return current;
      }

      const startsReady = hasInventoryItem(current.inventory, SEALED_RELIC_ITEM_ID);
      return updateQuestProgress(current, SEALED_RELIC_QUEST_ID, (quest) => ({
        ...quest,
        status: startsReady ? 'ready' : 'active',
        currentStepId: startsReady ? 'extract_with_relic' : 'enter_crypt_medium',
        acceptedAt,
        completedAt: null,
        rewardClaimedAt: null,
      }));
    });
    setSelectedRaidTemplateCode(CRYPT_MEDIUM_TEMPLATE_CODE);
    setLobbyToolsVisible(true);
    setTraderStatus(
      hasSealedRelicInInventory
        ? 'You already carry the relic. Hand it over to the Old Mage.'
        : 'The Old Mage marked a sealed reliquary inside the crypt. Recover the relic and extract alive.',
    );
  };

  const handleCompleteSealedRelicQuest = () => {
    const completedAt = new Date().toISOString();
    let missingRelic = false;

    setCharacter((current) => {
      if (!current) {
        return current;
      }

      const quest = getSealedRelicQuestProgress(current);
      const canTurnIn =
        quest.status === 'ready' ||
        (quest.status === 'completed' && quest.rewardClaimedAt === null);
      if (!canTurnIn) {
        return current;
      }

      const nextInventory = removeOneInventoryItem(current.inventory, SEALED_RELIC_ITEM_ID);
      if (!nextInventory) {
        missingRelic = true;
        return current;
      }

      return updateQuestProgress(
        {
          ...current,
          gold: current.gold + 150,
          inventory: nextInventory,
        },
        SEALED_RELIC_QUEST_ID,
        (nextQuest) => ({
          ...nextQuest,
          status: 'completed',
          currentStepId: null,
          completedAt,
          rewardClaimedAt: completedAt,
        }),
      );
    });

    setTraderStatus(
      missingRelic
        ? 'The relic is not in your inventory.'
        : 'Quest completed. You delivered the Sealed Relic and received 150 gold.',
    );
  };

  const handleAcceptTraderQuest = (questId: string) => {
    if (questId === SEALED_RELIC_QUEST_ID) {
      handleAcceptSealedRelicQuest();
      return;
    }

    handleAcceptIntroductionQuest();
  };

  const handleCompleteTraderQuest = (questId: string) => {
    if (questId === SEALED_RELIC_QUEST_ID) {
      handleCompleteSealedRelicQuest();
      return;
    }

    handleCompleteIntroductionQuest();
  };

  const handleTakeTraderItem = (itemId: ItemId, quantity = 1) => {
    if (!character) {
      return;
    }

    const price = getResolvedItemValue(itemId, itemBalanceConfig, quantity);
    if (character.gold < price) {
      setTraderStatus(`Not enough gold. Need ${formatGoldValue(price)}.`);
      return;
    }

    const nextInventory = addItemToInventory(character.inventory, itemId, quantity);
    if (!nextInventory) {
      setTraderStatus('Inventory is full.');
      return;
    }

    setCharacter({
      ...character,
      gold: character.gold - price,
      inventory: nextInventory,
      updatedAt: new Date().toISOString(),
    });
    setTraderStatus(`Bought ${ITEM_DEFINITIONS[itemId].name} for ${formatGoldValue(price)}.`);
  };

  const handleSellTraderItem = (slotIndex: number) => {
    if (!character) {
      return;
    }

    const itemValue = character.inventory[slotIndex];
    const parsed = parseInventoryItem(itemValue);
    if (!parsed) {
      setTraderStatus('Nothing to sell in that slot.');
      return;
    }

    const payout = Math.max(1, Math.floor(getResolvedItemValue(parsed.itemId, itemBalanceConfig, parsed.quantity) * 0.5));
    const nextInventory = [...character.inventory];
    nextInventory[slotIndex] = null;

    setCharacter({
      ...character,
      gold: character.gold + payout,
      inventory: nextInventory,
      updatedAt: new Date().toISOString(),
    });
    setTraderStatus(`Sold ${ITEM_DEFINITIONS[parsed.itemId].name} for ${formatGoldValue(payout)}.`);
  };

  const handleSkillTrigger = (skillId: 'fireball' | 'fireNova' | 'fireField') => {
    const readyAt = skillCooldowns[skillId] ?? 0;
    if (readyAt > Date.now()) {
      return;
    }

    if (skillId === 'fireNova') {
      setFireNovaCastNonce((current) => current + 1);
      setActiveSkillTargeting(null);
      return;
    }

    setActiveSkillTargeting((current) => (current === skillId ? null : skillId));
  };

  const handleSkillEffectChange = (
    skillId: SkillEffectId,
    field: keyof SkillEffectConfig,
    value: string,
  ) => {
    setSkillEffectOverrides((current) => ({
      ...current,
      [skillId]: sanitizeSkillEffectConfig({
        ...current[skillId],
        [field]:
          field === 'texturePath'
            ? value
            : Number.parseInt(value, 10) || DEFAULT_SKILL_EFFECT_OVERRIDES[skillId][field],
      }),
    }));
  };

  const filteredAdminImageOptions = adminImageOptions.filter((path) =>
    path.toLowerCase().includes(adminImageSearch.trim().toLowerCase()),
  );
  const worldSpriteFolders = Array.from(
    new Set(
      adminImageOptions.map((imagePath) => {
        const lastSlashIndex = imagePath.lastIndexOf('/');
        return lastSlashIndex > 0 ? imagePath.slice(0, lastSlashIndex) : '/';
      }),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const activeWorldSpriteFolder =
    selectedWorldSpriteFolder && worldSpriteFolders.includes(selectedWorldSpriteFolder)
      ? selectedWorldSpriteFolder
      : '';
  const worldSpriteOptions = adminImageOptions.filter((imagePath) =>
    activeWorldSpriteFolder ? imagePath.startsWith(`${activeWorldSpriteFolder}/`) : false,
  );
  const worldTraderHeadOptions = (
    adminImageOptions.filter((imagePath) => /head/i.test(imagePath)).sort((left, right) => left.localeCompare(right))
  );
  const worldTraderBodyOptions = (
    adminImageOptions.filter((imagePath) => /(body|tunic|robe|blacksmith)/i.test(imagePath)).sort((left, right) => left.localeCompare(right))
  );
  const selectedAdminItem = ITEM_DEFINITIONS[selectedAdminItemId];
  const selectedAdminItemBalance = itemBalanceDraft[selectedAdminItemId] ?? DEFAULT_ITEM_BALANCE_CONFIG[selectedAdminItemId];

  const handleSkillBalanceChange = (
    skillId: keyof SkillBalanceConfig,
    field: keyof SkillBalanceConfig[typeof skillId],
    value: string,
  ) => {
    setSkillBalanceDraft((current) => ({
      ...current,
      [skillId]: {
        ...current[skillId],
        [field]: Math.max(0, Number.parseInt(value, 10) || 0),
      },
    }));
  };

  const handleMobBalanceChange = (
    mobId: keyof MobBalanceConfig,
    field: keyof MobBalanceConfig[typeof mobId],
    value: string,
  ) => {
    const nextValue = Math.max(0, Math.floor(Number.parseFloat(value) || 0));
    setMobBalanceDraft((current) => ({
      ...current,
      [mobId]: {
        ...current[mobId],
        [field]: field === 'maxHealth' ? Math.max(1, nextValue) : nextValue,
      },
    }));
  };

  const handleItemBalanceValueChange = (itemId: ItemId, value: string) => {
    const nextValue = Math.max(0, Math.floor(Number.parseFloat(value) || 0));
    setItemBalanceDraft((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        value: nextValue,
      },
    }));
  };

  const handleItemBalanceFireResistanceChange = (itemId: ItemId, value: string) => {
    const nextValue = Math.max(0, Math.min(100, Math.floor(Number.parseFloat(value) || 0)));
    setItemBalanceDraft((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        fireResistancePercent: nextValue,
      },
    }));
  };

  const handleItemBalanceTooltipChange = (itemId: ItemId, value: string) => {
    const tooltipStats = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    setItemBalanceDraft((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        tooltipStats,
      },
    }));
  };

  const applySerializedCharacter = (nextCharacter: CharacterProfile) => {
    setCharacter(normalizeCharacterProfile(nextCharacter));
  };

  const handleGiveItemToSelf = async (itemCode: string) => {
    if (!username) {
      return;
    }

    setAdminItemBusyId(itemCode);
    setAdminItemStatus('');

    try {
      const player = await giveItemToPlayer({
        nickname: username,
        itemCode,
      });
      applySerializedCharacter(player.character);
      setAdminItemStatus(`Added ${itemCode} to ${player.nickname}.`);
    } catch (error) {
      setAdminItemStatus(error instanceof Error ? error.message : 'Failed to add item.');
    } finally {
      setAdminItemBusyId(null);
    }
  };

  const handleWorldTilePaint = (tileX: number, tileY: number) => {
    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      const nextTiles = current.tiles.map((row) => [...row]);
      nextTiles[tileY][tileX] = selectedWorldTile;

      return {
        ...current,
        tiles: nextTiles,
      };
    });
  };

  const handleWorldOverlayPaint = (tileX: number, tileY: number) => {
    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      const nextOverlays = current.overlays.filter(
        (overlay) =>
          !(
            overlay.x === tileX &&
            overlay.y === tileY &&
            overlay.texture === selectedWorldOverlay.texture &&
            overlay.rotation === selectedWorldOverlay.rotation &&
            overlay.flipX === selectedWorldOverlay.flipX
          ),
      );

      nextOverlays.push({
        x: tileX,
        y: tileY,
        texture: selectedWorldOverlay.texture,
        rotation: selectedWorldOverlay.rotation,
        flipX: selectedWorldOverlay.flipX,
      });

      return {
        ...current,
        overlays: nextOverlays,
      };
    });
  };

  const handleWorldOverlayErase = (tileX: number, tileY: number) => {
    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        overlays: current.overlays.filter((overlay) => !(overlay.x === tileX && overlay.y === tileY)),
      };
    });
  };

  const handleWorldSpritePaint = (tileX: number, tileY: number) => {
    if (!selectedWorldSprite.texturePath) {
      return;
    }

    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      const nextStamps = current.stamps.filter((stamp) => !(stamp.x === tileX && stamp.y === tileY));
      nextStamps.push({
        x: tileX,
        y: tileY,
        texturePath: selectedWorldSprite.texturePath,
        rotation: selectedWorldSprite.rotation,
        flipX: selectedWorldSprite.flipX,
        scale: selectedWorldSprite.scale,
      });

      return {
        ...current,
        stamps: nextStamps,
      };
    });
  };

  const handleWorldSpriteErase = (tileX: number, tileY: number) => {
    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        stamps: current.stamps.filter((stamp) => !(stamp.x === tileX && stamp.y === tileY)),
      };
    });
  };

  const handleWorldTraderPaint = (tileX: number, tileY: number) => {
    if (!selectedWorldTrader.bodyTexturePath || !selectedWorldTrader.headTexturePath) {
      return;
    }

    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      const existingTrader = current.traders.find((trader) => trader.x === tileX && trader.y === tileY);
      const nextTraders = current.traders.filter((trader) => !(trader.x === tileX && trader.y === tileY));
      nextTraders.push({
        id: existingTrader?.id ?? `trader-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        x: tileX,
        y: tileY,
        name: selectedWorldTrader.name.trim() || 'Trader',
        bodyTexturePath: selectedWorldTrader.bodyTexturePath,
        headTexturePath: selectedWorldTrader.headTexturePath,
      });

      return {
        ...current,
        traders: nextTraders,
      };
    });
  };

  const handleWorldTraderErase = (tileX: number, tileY: number) => {
    setWorldMapDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        traders: current.traders.filter((trader) => !(trader.x === tileX && trader.y === tileY)),
      };
    });
  };

  const handleWorldPaint = (tileX: number, tileY: number, eraseOverlay = false) => {
    if (worldEditorMode === 'tile') {
      handleWorldTilePaint(tileX, tileY);
      return;
    }

    if (worldEditorMode === 'spawn') {
      setWorldMapDraft((current) =>
        current
          ? {
              ...current,
              spawn: { x: tileX, y: tileY },
            }
          : current,
      );
      return;
    }

    if (worldEditorMode === 'trader') {
      if (eraseOverlay) {
        handleWorldTraderErase(tileX, tileY);
        return;
      }

      handleWorldTraderPaint(tileX, tileY);
      return;
    }

    if (eraseOverlay) {
      handleWorldSpriteErase(tileX, tileY);
      return;
    }

    handleWorldSpritePaint(tileX, tileY);
  };

  const handleReloadWorldMap = async () => {
    const response = await fetch('/api/admin/maps/world');
    if (!response.ok) {
      throw new Error('Failed to reload world map.');
    }

    const asset = await response.json() as MeadowMapAsset;
    setWorldMapDraft(asset);
    setWorldMapStatus('World map reloaded.');
  };

  const handleSaveWorldMap = async () => {
    if (!worldMapDraft) {
      return;
    }

    const response = await fetch('/api/admin/maps/world', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(worldMapDraft),
    });

    if (!response.ok) {
      throw new Error('Failed to save world map.');
    }

    const savedAsset = await response.json() as MeadowMapAsset;
    setWorldMapDraft(savedAsset);
    setWorldMapStatus('World map saved. Refresh the scene to see changes.');
  };

  useEffect(() => {
    if (playerRole !== 'admin' || activeAdminTab !== 'world' || worldEditorMode !== 'sprite') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.code === 'KeyR') {
        event.preventDefault();
        setSelectedWorldSprite((current) => ({
          ...current,
          rotation: (current.rotation + 90) % 360,
        }));
        return;
      }

      if (event.code === 'KeyF') {
        event.preventDefault();
        setSelectedWorldSprite((current) => ({
          ...current,
          flipX: !current.flipX,
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAdminTab, playerRole, worldEditorMode]);

  const activeContainer: ContainerView | null =
    activeContainerId ? containers[activeContainerId] ?? null : null;
  const currentPartyMember = party?.members.find((member) => member.nickname === username) ?? null;
  const isPartyLeader = currentPartyMember?.isLeader ?? false;
  const selectedRaidTemplate =
    raidTemplates.find((template) => template.code === selectedRaidTemplateCode) ?? null;
  const introductionQuest = getIntroductionQuestProgress(character);
  const sealedRelicQuest = getSealedRelicQuestProgress(character);
  const activeQuestStep =
    getIntroductionQuestSteps(locale).find((step) => step.id === introductionQuest.currentStepId) ?? null;
  const currentRaidRunId = getRaidRunId(activeRoomTarget.options);
  const isCryptSmallRaidActive =
    activeRoomTarget.name === 'raid' && isCryptSmallRaidTarget(activeRoomTarget.options);
  const isCryptMediumRaidActive =
    activeRoomTarget.name === 'raid' && activeRoomTarget.options?.templateCode === CRYPT_MEDIUM_TEMPLATE_CODE;
  const tutorialChestSlots = containers[CRYPT_SMALL_TUTORIAL_CHEST_ID]?.slots ?? null;
  const hasStartedIntroductionQuest = introductionQuest.status !== 'available';
  const hasFinishedIntroductionQuest = introductionQuest.rewardClaimedAt !== null;
  const hasSealedRelicInInventory = character ? hasInventoryItem(character.inventory, SEALED_RELIC_ITEM_ID) : false;
  const acceptedQuestLogEntries = getAcceptedQuestLogEntries(character, locale);
  const isOldMageDialogueOpen = Boolean(
    activeTrader && activeTrader.name.trim().toLowerCase().includes('old mage'),
  );
  const shouldGuideIntroductionTraderUi =
    introductionQuest.status === 'available' && isOldMageDialogueOpen;
  const shouldGuideIntroductionLobbyUi =
    introductionQuest.status === 'active' &&
    introductionQuest.currentStepId === 'loot_chest' &&
    activeRoomTarget.name === 'world';
  const shouldGuideIntroductionChestStaffUi =
    introductionQuest.status === 'active' &&
    introductionQuest.currentStepId === 'loot_chest' &&
    isCryptSmallRaidActive &&
    activeContainer?.id === CRYPT_SMALL_TUTORIAL_CHEST_ID &&
    activeContainer.slots.some((itemValue) => parseInventoryItem(itemValue)?.itemId === 'default_staff');
  const isPartyLocked = !hasFinishedIntroductionQuest;
  const isCryptSmallRaidLocked =
    selectedRaidTemplateCode === CRYPT_SMALL_TEMPLATE_CODE && introductionQuest.status !== 'active';
  const partyLockMessage =
    introductionQuest.status === 'available'
      ? 'Сначала подойди к Старому магу и возьми квест «Знакомство».'
      : 'Пати откроются после завершения обучения в Crypt Small.';
  const cryptSmallLockMessage = 'Старый маг должен сначала открыть тебе путь в Crypt Small.';
  const resolvedCryptSmallLockMessage =
    introductionQuest.status === 'available'
      ? cryptSmallLockMessage
      : 'Повторный вход в первую крипту запрещён.';
  const shouldGuideIntroductionUi =
    shouldGuideIntroductionTraderUi ||
    shouldGuideIntroductionLobbyUi ||
    shouldGuideIntroductionChestStaffUi;
  const questObjectiveTarget = shouldGuideIntroductionUi
    ? null
    : getQuestObjectiveTarget(activeRoomTarget, introductionQuest);
  const showSocketingHint =
    introductionQuest.status === 'active' && introductionQuest.currentStepId === 'socket_gem';

  useEffect(() => {
    if (!shouldGuideIntroductionTraderUi) {
      handleTutorialUiArrowChange(null);
      return;
    }

    let animationFrameId = 0;

    const updateTutorialUiArrow = () => {
      const targetElement =
        activeTraderTab !== 'quests'
          ? traderQuestsTabButtonRef.current
          : traderAcceptQuestButtonRef.current;

      if (!targetElement) {
        handleTutorialUiArrowChange(null);
        animationFrameId = window.requestAnimationFrame(updateTutorialUiArrow);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const safePaddingX = Math.max(56, Math.min(92, window.innerWidth * 0.09));
      const safePaddingY = Math.max(56, Math.min(92, window.innerHeight * 0.12));
      const safeLeft = safePaddingX + 24;
      const safeRight = window.innerWidth - safePaddingX - 24;
      const safeTop = safePaddingY + 24;
      const safeBottom = window.innerHeight - safePaddingY - 24;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const canPlaceAbove = rect.top - 34 >= safeTop;

      handleTutorialUiArrowChange({
        visible: true,
        screenX: Math.max(safeLeft, Math.min(safeRight, centerX)),
        screenY: Math.max(
          safeTop,
          Math.min(safeBottom, canPlaceAbove ? rect.top - 26 : rect.bottom + 26),
        ),
        rotation: canPlaceAbove ? Math.PI / 2 : -Math.PI / 2,
        label: activeTraderTab !== 'quests' ? pickLocale(locale, { ru: 'Открой Квесты', en: 'Open Quests' }) : pickLocale(locale, { ru: 'Нажми Принять', en: 'Press Accept' }),
        isOnScreen: true,
      });

      animationFrameId = window.requestAnimationFrame(updateTutorialUiArrow);
    };

    animationFrameId = window.requestAnimationFrame(updateTutorialUiArrow);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      handleTutorialUiArrowChange(null);
    };
  }, [activeTraderTab, handleTutorialUiArrowChange, shouldGuideIntroductionTraderUi]);

  useEffect(() => {
    if (shouldGuideIntroductionTraderUi || !shouldGuideIntroductionLobbyUi) {
      if (!shouldGuideIntroductionTraderUi) {
        handleTutorialUiArrowChange(null);
      }
      return;
    }

    let animationFrameId = 0;

    const updateLobbyUiArrow = () => {
      const targetElement = lobbyToolsVisible
        ? startRaidButtonRef.current
        : lobbyToolsToggleButtonRef.current;

      if (!targetElement) {
        handleTutorialUiArrowChange(null);
        animationFrameId = window.requestAnimationFrame(updateLobbyUiArrow);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const safePaddingX = Math.max(56, Math.min(92, window.innerWidth * 0.09));
      const safePaddingY = Math.max(56, Math.min(92, window.innerHeight * 0.12));
      const safeLeft = safePaddingX + 24;
      const safeRight = window.innerWidth - safePaddingX - 24;
      const safeTop = safePaddingY + 24;
      const safeBottom = window.innerHeight - safePaddingY - 24;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const canPlaceAbove = rect.top - 34 >= safeTop;

      handleTutorialUiArrowChange({
        visible: true,
        screenX: Math.max(safeLeft, Math.min(safeRight, centerX)),
        screenY: Math.max(
          safeTop,
          Math.min(safeBottom, canPlaceAbove ? rect.top - 26 : rect.bottom + 26),
        ),
        rotation: canPlaceAbove ? Math.PI / 2 : -Math.PI / 2,
        label: lobbyToolsVisible ? 'Нажми Start Raid' : 'Открой Party & Raid',
        isOnScreen: true,
      });

      animationFrameId = window.requestAnimationFrame(updateLobbyUiArrow);
    };

    animationFrameId = window.requestAnimationFrame(updateLobbyUiArrow);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      handleTutorialUiArrowChange(null);
    };
  }, [
    handleTutorialUiArrowChange,
    lobbyToolsVisible,
    shouldGuideIntroductionLobbyUi,
    shouldGuideIntroductionTraderUi,
  ]);

  useEffect(() => {
    if (
      shouldGuideIntroductionTraderUi ||
      shouldGuideIntroductionLobbyUi ||
      !shouldGuideIntroductionChestStaffUi
    ) {
      if (!shouldGuideIntroductionTraderUi && !shouldGuideIntroductionLobbyUi) {
        handleTutorialUiArrowChange(null);
      }
      return;
    }

    let animationFrameId = 0;

    const updateChestStaffUiArrow = () => {
      const targetElement = document.querySelector<HTMLElement>(
        `[data-container-id="${CRYPT_SMALL_TUTORIAL_CHEST_ID}"][data-item-id="default_staff"]`,
      );

      if (!targetElement) {
        handleTutorialUiArrowChange(null);
        animationFrameId = window.requestAnimationFrame(updateChestStaffUiArrow);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const safePaddingX = Math.max(56, Math.min(92, window.innerWidth * 0.09));
      const safePaddingY = Math.max(56, Math.min(92, window.innerHeight * 0.12));
      const safeLeft = safePaddingX + 24;
      const safeRight = window.innerWidth - safePaddingX - 24;
      const safeTop = safePaddingY + 24;
      const safeBottom = window.innerHeight - safePaddingY - 24;
      const centerX = rect.left + rect.width / 2;
      const canPlaceAbove = rect.top - 34 >= safeTop;

      handleTutorialUiArrowChange({
        visible: true,
        screenX: Math.max(safeLeft, Math.min(safeRight, centerX)),
        screenY: Math.max(
          safeTop,
          Math.min(safeBottom, canPlaceAbove ? rect.top - 26 : rect.bottom + 26),
        ),
        rotation: canPlaceAbove ? Math.PI / 2 : -Math.PI / 2,
        label: 'Забери посох',
        isOnScreen: true,
      });

      animationFrameId = window.requestAnimationFrame(updateChestStaffUiArrow);
    };

    animationFrameId = window.requestAnimationFrame(updateChestStaffUiArrow);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      handleTutorialUiArrowChange(null);
    };
  }, [
    handleTutorialUiArrowChange,
    shouldGuideIntroductionChestStaffUi,
    shouldGuideIntroductionLobbyUi,
    shouldGuideIntroductionTraderUi,
  ]);

  useEffect(() => {
    if (!character || introductionQuest.status !== 'active' || !isCryptSmallRaidActive || !currentRaidRunId) {
      return;
    }

    setCharacter((current) => {
      if (!current) {
        return current;
      }

      return updateIntroductionQuestProgress(current, (quest) => {
        if (quest.activeRaidRunId === currentRaidRunId) {
          if (quest.currentStepId !== 'kill_rat' || quest.killRatExperienceBaseline !== null) {
            return quest;
          }
        }

        return {
          ...quest,
          activeRaidRunId: currentRaidRunId,
          killRatExperienceBaseline:
            quest.currentStepId === 'kill_rat'
              ? quest.killRatExperienceBaseline ?? current.experience
              : quest.killRatExperienceBaseline,
        };
      });
    });
  }, [character, currentRaidRunId, introductionQuest.status, isCryptSmallRaidActive]);

  useEffect(() => {
    if (!character || introductionQuest.status !== 'active') {
      return;
    }

    setCharacter((current) => {
      if (!current) {
        return current;
      }

      return updateIntroductionQuestProgress(current, (quest) => {
        if (!isCryptSmallRaidActive || !currentRaidRunId) {
          return quest;
        }

        if (quest.currentStepId === 'loot_chest' && hasTutorialChestBeenLooted(tutorialChestSlots)) {
          return {
            ...quest,
            currentStepId: 'socket_gem',
            activeRaidRunId: currentRaidRunId,
          };
        }

        if (
          quest.currentStepId === 'socket_gem' &&
          current.equipment.weapon === 'default_staff' &&
          hasSocketedWeaponGem(current.equipment)
        ) {
          return {
            ...quest,
            currentStepId: 'kill_rat',
            activeRaidRunId: currentRaidRunId,
            killRatExperienceBaseline: current.experience,
          };
        }

        if (
          quest.currentStepId === 'kill_rat' &&
          current.experience > (quest.killRatExperienceBaseline ?? current.experience)
        ) {
          return {
            ...quest,
            currentStepId: 'find_exit',
            activeRaidRunId: currentRaidRunId,
          };
        }

        return quest;
      });
    });
  }, [
    character,
    currentRaidRunId,
    introductionQuest.status,
    isCryptSmallRaidActive,
    tutorialChestSlots,
  ]);

  useEffect(() => {
    if (!character || sealedRelicQuest.status !== 'active') {
      return;
    }

    setCharacter((current) => {
      if (!current) {
        return current;
      }

      return updateQuestProgress(current, SEALED_RELIC_QUEST_ID, (quest) => {
        if (quest.status !== 'active') {
          return quest;
        }

        if (
          quest.currentStepId === 'enter_crypt_medium' &&
          isCryptMediumRaidActive
        ) {
          return {
            ...quest,
            currentStepId: 'find_sealed_relic',
          };
        }

        if (
          isCryptMediumRaidActive &&
          hasInventoryItem(current.inventory, SEALED_RELIC_ITEM_ID) &&
          quest.currentStepId !== 'extract_with_relic'
        ) {
          return {
            ...quest,
            currentStepId: 'extract_with_relic',
          };
        }

        return quest;
      });
    });
  }, [character, hasSealedRelicInInventory, isCryptMediumRaidActive, sealedRelicQuest.status]);

  if (authStatus === 'loading') {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#4d8d2b] text-[#f3ffe7]">
        <div className="rounded-3xl border border-[#d9efbd]/30 bg-[#17320d]/70 px-8 py-6 font-serif text-xl">
          Loading...
        </div>
      </main>
    );
  }

  if (authStatus !== 'ready' || !character) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#4d8d2b] text-[#f3ffe7]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#b7e388_0%,transparent_40%),linear-gradient(180deg,#77c44e_0%,#4d8d2b_100%)] opacity-95" />

        <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
          <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-[#d9efbd]/28 bg-[#17320d]/66 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.38em] text-[#c6dfab]">
                MMORPG Prototype
              </p>
              <h1 className="mt-4 font-serif text-5xl font-bold leading-[1.05] text-[#f6ffea]">
                API auth before entering the world
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#deefcb]">
                Регистрация и вход теперь идут через backend API. После логина
                игра загружает профиль игрока из базы данных и сохраняет туда
                экипировку, инвентарь и позицию персонажа.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#d9efbd]/16 bg-[#203b11]/55 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#bfd8a4]">
                    Auth
                  </div>
                  <div className="mt-3 font-serif text-2xl text-[#f6ffea]">
                    API
                  </div>
                </div>
                <div className="rounded-2xl border border-[#d9efbd]/16 bg-[#203b11]/55 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#bfd8a4]">
                    Profile
                  </div>
                  <div className="mt-3 font-serif text-2xl text-[#f6ffea]">
                    DB
                  </div>
                </div>
                <div className="rounded-2xl border border-[#d9efbd]/16 bg-[#203b11]/55 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#bfd8a4]">
                    {text.session}
                  </div>
                  <div className="mt-3 font-serif text-2xl text-[#f6ffea]">
                    Token
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d9efbd]/30 bg-[#17320d]/82 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md">
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
                  className="rounded-xl border border-[#d9efbd]/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#244713]/70"
                >
                  {locale === 'ru' ? 'EN' : 'RU'}
                </button>
              </div>
              <div className="flex gap-2 rounded-2xl border border-[#d9efbd]/14 bg-[#112008]/55 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold tracking-[0.16em] uppercase transition ${
                    authMode === 'register'
                      ? 'bg-[#d7f0b6] text-[#18310d]'
                      : 'text-[#d8ebc3]'
                  }`}
                >
                  {text.register}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold tracking-[0.16em] uppercase transition ${
                    authMode === 'login'
                      ? 'bg-[#d7f0b6] text-[#18310d]'
                      : 'text-[#d8ebc3]'
                  }`}
                >
                  {text.login}
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-[#bfd8a4]">
                    {text.nickname}
                  </span>
                  <input
                    value={authForm.nickname}
                    onChange={handleFieldChange('nickname')}
                    className="w-full rounded-2xl border border-[#d9efbd]/20 bg-[#102008]/75 px-4 py-3 text-base text-[#f4ffe8] outline-none transition focus:border-[#d7f0b6]/50"
                    placeholder="wanderer"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-[#bfd8a4]">
                    {text.password}
                  </span>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={handleFieldChange('password')}
                    className="w-full rounded-2xl border border-[#d9efbd]/20 bg-[#102008]/75 px-4 py-3 text-base text-[#f4ffe8] outline-none transition focus:border-[#d7f0b6]/50"
                    placeholder="secret"
                  />
                </label>

                <div className="rounded-2xl border border-[#d9efbd]/14 bg-[#112008]/45 px-4 py-3 text-sm leading-6 text-[#dceec9]">
                  {text.nicknameHint}
                </div>
              </div>

              {authError ? (
                <div className="mt-4 rounded-2xl border border-[#f4b298]/30 bg-[#4a1f16]/50 px-4 py-3 text-sm text-[#ffd4c6]">
                  {authError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleAuthSubmit}
                className="mt-6 w-full rounded-2xl bg-[#d7f0b6] px-5 py-4 font-semibold uppercase tracking-[0.22em] text-[#18310d] transition hover:bg-[#e7f8cf]"
              >
                {authMode === 'register' ? text.createAccount : text.enterWorld}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#4d8d2b] text-[#f3ffe7]"
      onContextMenu={preventContextMenu}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#a7d97c_0%,transparent_38%),linear-gradient(180deg,#7bc652_0%,#4d8d2b_100%)] opacity-90" />

      <MinimapPanel minimap={minimap} raidDeadlineAt={raidDeadlineAt} />
      <section className="hidden pointer-events-none absolute left-5 top-5 z-10 max-w-sm rounded-2xl border border-[#d9efbd]/40 bg-[#17320d]/55 p-4 backdrop-blur-sm">
        <h1 className="font-serif text-3xl font-bold tracking-wide">
          {username}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#e2f4d0]">
          Профиль загружен через API для @{username}. Экипировка и инвентарь
          сохраняются в базе данных.
        </p>
      </section>

      <section className="pointer-events-auto absolute right-5 top-5 z-20 flex items-center gap-3 rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/70 px-4 py-3 backdrop-blur-sm">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#bfd8a4]">
            Session
          </div>
          <div className="text-sm font-semibold text-[#f4ffe8]">@{username}</div>
          <div className="text-xs text-[#dceec9]">
            Lv. {character.level} · XP {character.experience}/{character.level * 100}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#bfd8a4]">
            STR {character.strength} · AGI {character.agility} · INT {character.intellect}
          </div>
          <div className="mt-3 w-40">
            <HealthBar
              variant="retro"
              value={Math.max(0, Math.min(100, (character.health / Math.max(1, character.maxHealth)) * 100))}
              className="h-3 w-full"
            />
            <div className="mt-1 text-[10px] text-[#dceec9]">
              HP {character.health}/{character.maxHealth}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = locale === 'ru' ? 'en' : 'ru';
              setLocale(next);
            }}
            className="rounded-xl border border-[#d9efbd]/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#244713]/70"
          >
            {locale === 'ru' ? 'EN' : 'RU'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-[#d9efbd]/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#244713]/70"
          >
            {text.logout}
          </button>
        </div>
      </section>

      {introductionQuest.status === 'active' ? (
        <section className="pointer-events-none absolute left-5 top-[330px] z-20 max-w-sm rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/76 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.questTracker}</div>
          <div className="mt-2 font-serif text-2xl text-[#f4ffe8]">{pickLocale(locale, { ru: 'Знакомство', en: 'Introduction' })}</div>
          <div className="mt-2 text-sm font-semibold text-[#ffe699]">
            {activeQuestStep?.title ?? pickLocale(locale, { ru: 'Следуй указаниям старого мага', en: 'Follow the Old Mage\'s instructions' })}
          </div>
          <div className="mt-2 text-sm leading-6 text-[#d8ebc7]">
            {activeQuestStep?.description ?? pickLocale(locale, { ru: 'Астральная тропа уже зовёт тебя дальше.', en: 'The astral path beckons you onward.' })}
          </div>
          <div className="mt-4 space-y-2">
            {getIntroductionQuestSteps(locale).map((step, index) => {
              const introSteps = getIntroductionQuestSteps(locale);
              const currentStepIndex = introductionQuest.currentStepId
                ? introSteps.findIndex((candidate) => candidate.id === introductionQuest.currentStepId)
                : -1;
              const isCompleted = currentStepIndex !== -1 && index < currentStepIndex;
              const isCurrent = introductionQuest.currentStepId === step.id;

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    isCurrent
                      ? 'border-[#ffe699]/35 bg-[#3a2d0f]/45 text-[#fff4cf]'
                      : isCompleted
                        ? 'border-[#7db56a]/20 bg-[#17320d]/38 text-[#cbe6b6]'
                        : 'border-[#d9efbd]/12 bg-[#13240b]/30 text-[#8fb07b]'
                  }`}
                >
                  {isCompleted ? '✓ ' : isCurrent ? '→ ' : '• '}
                  {step.title}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {showSocketingHint ? (
        <section className="pointer-events-none absolute bottom-28 left-6 z-20 flex items-center gap-3 rounded-2xl border border-[#ffe699]/35 bg-[#2b1f09]/78 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <div className="text-3xl leading-none text-[#ffe699] animate-bounce">↓</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4b97a]">{text.currentStep}</div>
            <div className="mt-1 text-sm font-semibold text-[#fff4cf]">{text.openInventoryAndEquipment}</div>
            <div className="text-sm text-[#e7d7ab]">{text.socketHint}</div>
          </div>
        </section>
      ) : null}

      {lobbyToolsVisible ? (
        <HudWindow
          title="Party & Raid"
          subtitle={`Active room: ${activeRoomTarget.name}`}
          storageKey={LOBBY_TOOLS_POSITION_STORAGE_KEY}
          defaultPosition={{ left: 980, top: 120 }}
          onClose={() => setLobbyToolsVisible(false)}
          headerActions={
            <>
              {activeRoomTarget.name === 'raid' ? (
                <button
                  type="button"
                  onClick={handleReturnToLobby}
                  className="rounded-xl border border-[#d9efbd]/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#244713]/70"
                >
                  Lobby
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void runLobbyAction(async () => {
                    await refreshLobbyState();
                    setLobbyActionMessage('Lobby state refreshed.');
                  });
                }}
                disabled={lobbyBusy}
                className="rounded-xl border border-[#d9efbd]/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#244713]/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>
            </>
          }
          className="z-20 w-[360px] border-[#d9efbd]/30 bg-[#17320d]/78 text-[#f3ffe7]"
        >
          <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">
                Party
              </div>
              <div className="mt-1 text-sm text-[#e9f7da]">
                {party ? `Code ${party.code}` : 'You are not in a party.'}
              </div>
            </div>
            {!party ? (
              <button
                type="button"
                onClick={handleCreateParty}
                disabled={lobbyBusy || isPartyLocked}
                className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create
              </button>
            ) : null}
          </div>

          {party ? (
            <div className="mt-3 space-y-2">
              {party.members.map((member) => (
                <div
                  key={member.playerId}
                  className="flex items-center justify-between rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-2 text-sm"
                >
                  <div className="text-[#f4ffe8]">
                    {member.nickname}
                    {member.isLeader ? ' · Leader' : ''}
                  </div>
                  <div className={member.isReady ? 'text-[#d7f0b6]' : 'text-[#c7d9b2]'}>
                    {member.isReady ? 'Ready' : 'Not ready'}
                  </div>
                </div>
              ))}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleToggleReady}
                  disabled={lobbyBusy}
                  className="rounded-xl border border-[#d9efbd]/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#244713]/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {currentPartyMember?.isReady ? 'Unready' : 'Ready'}
                </button>
                <button
                  type="button"
                  onClick={handleLeaveParty}
                  disabled={lobbyBusy}
                  className="rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7ebc1] transition hover:bg-[#294816]/72 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Leave
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">
                  Join By Code
                </span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={partyJoinCode}
                    onChange={(event) => setPartyJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none placeholder:text-[#a9c38d]"
                  />
                  <button
                    type="button"
                    onClick={handleJoinParty}
                    disabled={lobbyBusy || isPartyLocked}
                    className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Join
                  </button>
                </div>
              </label>
            </div>
          )}

          {isPartyLocked ? (
            <div className="mt-3 rounded-xl border border-[#ffe699]/24 bg-[#3a2d0f]/35 px-3 py-2 text-sm text-[#fff0c2]">
              {partyLockMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.raid}</div>
          <label className="mt-3 block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">
              {text.template}
            </span>
            <select
              value={selectedRaidTemplateCode}
              onChange={(event) => setSelectedRaidTemplateCode(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
            >
              {raidTemplates.map((template) => (
                <option key={template.id} value={template.code}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          {selectedRaidTemplate ? (
            <div className="mt-3 space-y-1 text-sm text-[#d8ebc7]">
              <div>{selectedRaidTemplate.description}</div>
              <div>
                {text.players}: {selectedRaidTemplate.minPlayers}-{selectedRaidTemplate.maxPlayers}
              </div>
              <div>
                {text.layout}: {selectedRaidTemplate.width}x{selectedRaidTemplate.height} · {selectedRaidTemplate.biome}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-[#d8ebc7]">{text.noRaidTemplates}</div>
          )}

          {isCryptSmallRaidLocked ? (
            <div className="mt-3 rounded-xl border border-[#ffe699]/24 bg-[#3a2d0f]/35 px-3 py-2 text-sm text-[#fff0c2]">
              {resolvedCryptSmallLockMessage}
            </div>
          ) : null}

          <button
            type="button"
            ref={startRaidButtonRef}
            onClick={handleStartRaid}
            disabled={lobbyBusy || !selectedRaidTemplateCode || (!!party && !isPartyLeader) || isCryptSmallRaidLocked}
            className="mt-3 w-full rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCryptSmallRaidLocked
              ? text.talkToOldMage
              : party
                ? isPartyLeader
                  ? text.startRaidAsLeader
                  : text.leaderMustStartRaid
                : text.startSoloRaid}
          </button>

          {lastStartedRaid ? (
            <div className="mt-3 rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 p-3 text-sm text-[#d8ebc7]">
              <div className="font-semibold text-[#f4ffe8]">{lastStartedRaid.template.name}</div>
              <div className="mt-1">Run ID: {lastStartedRaid.id}</div>
              <div>Seed: {lastStartedRaid.seed}</div>
              <div>
                Room: {lastStartedRaid.realtimeRoom.roomName} · players {lastStartedRaid.playerCount}
              </div>
            </div>
          ) : null}
        </div>

        {lobbyActionError ? (
          <div className="mt-3 rounded-xl border border-[#f0c7b6]/30 bg-[#4d2515]/60 px-3 py-2 text-sm text-[#ffe1d6]">
            {lobbyActionError}
          </div>
        ) : null}

        {lobbyActionMessage ? (
          <div className="mt-3 rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-2 text-sm text-[#d8ebc7]">
            {lobbyActionMessage}
          </div>
        ) : null}
        </HudWindow>
      ) : null}

      <div
        className={`relative z-0 h-screen w-full ${activeSkillTargeting ? 'cursor-none' : ''}`}
        onMouseDownCapture={
          playerRole === 'admin' && activeAdminTab === 'world'
            ? undefined
            : preventPrimaryMouseDefault
        }
      >
        <GameCanvas
          activeRoomName={activeRoomTarget.name}
          activeRoomOptions={activeRoomTarget.options}
          worldMapAssetOverride={playerRole === 'admin' ? worldMapDraft : null}
          worldEditorEnabled={playerRole === 'admin' && activeAdminTab === 'world'}
          worldEditorMode={worldEditorMode}
          selectedWorldTile={selectedWorldTile}
          selectedWorldOverlay={selectedWorldOverlay}
          selectedWorldSprite={selectedWorldSprite}
          selectedWorldTrader={selectedWorldTrader}
          onWorldEditPaint={handleWorldPaint}
          onWorldEditHoverChange={setWorldHoverTile}
          onWorldEditDebugChange={setWorldEditorDebug}
          playerEquipment={character.equipment}
          playerInventory={character.inventory}
          playerName={username}
          playerPosition={character.position}
          playerHealth={character.health}
          playerMaxHealth={character.maxHealth}
          playerLevel={character.level}
          playerExperience={character.experience}
          playerStrength={character.strength}
          playerAgility={character.agility}
          playerIntellect={character.intellect}
          playerRole={playerRole}
          activeSkillTargeting={activeSkillTargeting}
          onChestInteract={handleChestInteract}
          onNearbyChestChange={setNearbyChestId}
          onTraderInteract={handleTraderInteract}
          onNearbyTraderChange={setNearbyTraderId}
          onRoomConnected={handleRoomConnected}
          getTraderQuestMarker={(trader) => getTraderQuestMarker(trader, character, locale)}
          objectiveTarget={questObjectiveTarget}
          onObjectiveArrowChange={handleObjectiveArrowChange}
          onMinimapChange={setMinimap}
          onSkillTargetCancel={() => setActiveSkillTargeting(null)}
          onFireballCast={({ x, y }) => {
            void x;
            void y;
          }}
          onSkillCooldownsChange={(nextCooldowns) => {
            setSkillCooldowns(nextCooldowns);
          }}
          onPlayerVitalsChange={({ health, maxHealth }) => {
            setCharacter((current) => {
              if (!current || (current.health === health && current.maxHealth === maxHealth)) {
                return current;
              }

              const nextIsDead = health <= 0;
              setIsDead(nextIsDead);

              return {
                ...current,
                health,
                maxHealth,
              };
            });
          }}
          onPlayerProgressChange={({ level, experience }) => {
            setCharacter((current) => {
              if (!current || (current.level === level && current.experience === experience)) {
                return current;
              }

              return {
                ...current,
                level,
                experience,
              };
            });
          }}
          onPlayerPositionChange={({ x, y }) => {
            setCharacter((current) => {
              if (
                !current ||
                (current.position.x === x && current.position.y === y)
              ) {
                return current;
              }

              return {
                ...current,
                position: { x, y },
              };
            });
          }}
          onPlayerDeath={({ health, maxHealth, level, experience }) => {
            setActiveSkillTargeting(null);
            setActiveContainerId(null);
            setIsDead(true);
            setCharacter((current) =>
              current
                ? {
                    ...createResetCharacter(current),
                    health,
                    maxHealth,
                    level,
                    experience,
                  }
                : current,
            );
          }}
          onPlayerRespawn={({ x, y, health, maxHealth }) => {
            setIsDead(false);
            setCharacter((current) =>
              current
                ? {
                    ...current,
                    position: { x, y },
                    health,
                    maxHealth,
                  }
                : current,
            );
          }}
          onPlayerInventoryChange={(inventory) => {
            setCharacter((current) =>
              current
                ? {
                    ...current,
                    inventory,
                  }
                : current,
            );
          }}
          onConsumableCooldownChange={({ itemId, cooldownEndsAt }) => {
            if (itemId !== 'healing_potion') {
              return;
            }

            setConsumableCooldowns((current) => ({
              ...current,
              healing_potion: cooldownEndsAt,
            }));
          }}
          onRaidExit={handleRaidExit}
          respawnRequestNonce={respawnRequestNonce}
          fireNovaCastNonce={fireNovaCastNonce}
          useConsumableRequest={useConsumableRequest}
          skillEffectOverrides={skillEffectOverrides}
          skillBalanceConfig={skillBalanceConfig}
          mobBalanceConfig={mobBalanceConfig}
          onSkillBalanceConfigChange={(config) => {
            skillBalanceLoadedRef.current = true;
            skillBalancePersistedRef.current = JSON.stringify(config);
            setSkillBalanceConfig(config);
            setSkillBalanceDraft(config);
          }}
          onMobBalanceConfigChange={(config) => {
            mobBalanceLoadedRef.current = true;
            mobBalancePersistedRef.current = JSON.stringify(config);
            setMobBalanceConfig(config);
            setMobBalanceDraft(config);
          }}
          containerStates={Object.fromEntries(
            Object.entries(containers).map(([id, container]) => [id, container.slots]),
          )}
          onContainersStateChange={(nextContainers) => {
            setContainers(
              Object.fromEntries(nextContainers.map((container) => [container.id, container])),
            );
          }}
          onChatHistory={(messages) => {
            setChatMessages(messages);
          }}
          onChatMessage={(message) => {
            setChatMessages((current) => {
              const pendingIndex = current.findIndex(
                (entry) =>
                  String(entry.id).startsWith('local-') &&
                  entry.author === message.author &&
                  entry.text === message.text,
              );

              if (pendingIndex === -1) {
                return [...current, message];
              }

              const nextMessages = [...current];
              nextMessages[pendingIndex] = message;
              return nextMessages;
            });
          }}
          onChatSenderReady={(sender) => {
            chatSenderRef.current = sender;
          }}
          keyboardInputEnabled={!chatInputFocused && !isDead}
          locale={locale}
        />
      </div>

      <GameHud
        equipment={character.equipment}
        inventory={character.inventory ?? createEmptyInventory()}
        container={activeContainer}
        itemTintOverrides={adminGemColorOverrides}
        itemBalanceConfig={itemBalanceConfig}
        playerGold={character.gold}
        playerStrength={character.strength}
        playerAgility={character.agility}
        playerIntellect={character.intellect}
        activeSkillTargeting={activeSkillTargeting}
        skillCooldowns={skillCooldowns}
        consumableCooldowns={consumableCooldowns}
        onSkillTrigger={handleSkillTrigger}
        onEquipmentChange={handleEquipmentChange}
        onInventoryChange={handleInventoryChange}
        onInventoryUse={handleInventoryUse}
        onContainerChange={(slots) => {
          if (!activeContainerId) {
            return;
          }

          setContainers((current) => ({
            ...current,
            [activeContainerId]: {
              ...current[activeContainerId],
              slots,
            },
          }));
        }}
        onCloseContainer={() => setActiveContainerId(null)}
        isQuestLogOpen={questLogOpen}
        onToggleQuestLog={() => setQuestLogOpen((current) => !current)}
      />

      {questLogOpen ? (
        <HudWindow
          title={text.questLog}
          subtitle={text.acceptedQuests}
          storageKey="mmorpg.ui.quest-log.position.v1"
          defaultPosition={{ left: 680, top: 140 }}
          onClose={() => setQuestLogOpen(false)}
          className="z-30 w-[520px] max-w-[92vw] border-[#d9efbd]/35 bg-[#17320d]/82"
          bodyClassName="mt-4 max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1"
        >
          {acceptedQuestLogEntries.length > 0 ? (
            <div className="space-y-4">
              {acceptedQuestLogEntries.map((quest) => {
                const currentStepIndex = quest.progress.currentStepId
                  ? quest.steps.findIndex((step) => step.id === quest.progress.currentStepId)
                  : -1;
                const isCollapsed = collapsedQuestLogIds.includes(quest.id);

                return (
                  <div
                    key={quest.id}
                    className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedQuestLogIds((current) =>
                          current.includes(quest.id)
                            ? current.filter((id) => id !== quest.id)
                            : [...current, quest.id],
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-xl text-left transition hover:bg-[#203b11]/25"
                    >
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">
                          {quest.status === 'ready' ? text.readyToTurnIn : text.inProgress}
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#f4ffe8]">{quest.title}</div>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9efbd]/16 bg-[#203b11]/45 text-sm text-[#d8ebc7]">
                        {isCollapsed ? '+' : '-'}
                      </div>
                    </button>

                    {quest.requiredTurnInItemId ? (
                      <div className="mt-4">
                        <QuestRequiredItemCard
                          itemId={quest.requiredTurnInItemId}
                          itemBalanceConfig={itemBalanceConfig}
                          hasItem={hasInventoryItem(character.inventory, quest.requiredTurnInItemId)}
                          labels={text}
                        />
                      </div>
                    ) : null}

                    {!isCollapsed ? (
                      <div className="mt-4 space-y-3">
                        {quest.steps.map((step, index) => {
                          const isCompleted =
                            quest.status === 'ready' ||
                            quest.progress.rewardClaimedAt !== null ||
                            (currentStepIndex !== -1 && index < currentStepIndex);
                          const isCurrent =
                            quest.status === 'active' &&
                            quest.progress.currentStepId === step.id;

                          return (
                            <div
                              key={step.id}
                              className={`rounded-lg border px-3 py-3 ${
                                isCurrent
                                  ? 'border-[#ffe699]/35 bg-[#3a2d0f]/45'
                                  : isCompleted
                                    ? 'border-[#7db56a]/24 bg-[#17320d]/40'
                                    : 'border-[#d9efbd]/12 bg-[#13240b]/35'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                    isCompleted
                                      ? 'bg-[#7db56a] text-[#102008]'
                                      : isCurrent
                                        ? 'bg-[#ffe699] text-[#2f2307]'
                                        : 'bg-[#203b11] text-[#d8ebc7]'
                                  }`}
                                >
                                  {isCompleted ? '✓' : index + 1}
                                </div>
                                <div>
                                  <div className="font-semibold text-[#f4ffe8]">{step.title}</div>
                                  <div className="text-xs text-[#cfe1ba]">{step.description}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-5 text-sm leading-6 text-[#d8ebc7]">
              No accepted quests right now.
            </div>
          )}
        </HudWindow>
      ) : null}

      {activeTrader ? (
        <HudWindow
          title={activeTrader.name}
          subtitle="Shop"
          storageKey={TRADER_WINDOW_POSITION_STORAGE_KEY}
          defaultPosition={{ left: 320, top: 120 }}
          onClose={() => {
            setActiveTrader(null);
            setActiveTraderTab('shop');
            setSelectedTraderOfferId(null);
            setSelectedTraderSellIndex(null);
            setSelectedTraderPanel('buy');
            setTraderStatus('');
          }}
          className="z-30 w-[680px] max-w-[92vw] border-[#d9efbd]/35 bg-[#17320d]/82"
          bodyClassName="mt-4 max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1"
        >
          {(() => {
            const traderOffers = getTraderOffers(activeTrader);
            const sellableEntries = character.inventory
              .map((itemValue, index) => ({ itemValue, index }))
              .filter((entry): entry is { itemValue: string; index: number } => {
                if (!entry.itemValue) {
                  return false;
                }

                const parsed = parseInventoryItem(entry.itemValue);
                return Boolean(parsed && ITEM_DEFINITIONS[parsed.itemId].type !== 'quest');
              });
            const selectedOffer =
              traderOffers.find((offer) => offer.itemId === selectedTraderOfferId) ??
              traderOffers[0] ??
              null;
            const selectedItem = selectedOffer ? ITEM_DEFINITIONS[selectedOffer.itemId] : null;
            const selectedSellEntry =
              selectedTraderSellIndex !== null && character.inventory[selectedTraderSellIndex]
                ? (() => {
                    const itemValue = character.inventory[selectedTraderSellIndex] as string;
                    const parsed = parseInventoryItem(itemValue);
                    return parsed && ITEM_DEFINITIONS[parsed.itemId].type !== 'quest'
                      ? {
                          index: selectedTraderSellIndex,
                          itemValue,
                        }
                      : null;
                  })()
                : sellableEntries[0] ?? null;
            const selectedSellParsed = selectedSellEntry ? parseInventoryItem(selectedSellEntry.itemValue) : null;
            const selectedSellItem = selectedSellParsed ? ITEM_DEFINITIONS[selectedSellParsed.itemId] : null;
            const traderQuestDefinitions = getTraderQuestDefinitions(locale)[activeTrader.name.trim().toLowerCase()] ?? [];
            const introductionQuestProgress = getIntroductionQuestProgress(character);
            const visibleTraderQuests = traderQuestDefinitions
              .map((definition) => ({
                definition,
                status: getQuestStatusForCharacter(definition.id, character),
                progress:
                  definition.id === SEALED_RELIC_QUEST_ID
                    ? getSealedRelicQuestProgress(character)
                    : getIntroductionQuestProgress(character),
              }))
              .filter((entry) => Boolean(entry.status)) as Array<{
                definition: TraderQuestDefinition;
                status: TraderQuestStatus;
                progress: ReturnType<typeof getIntroductionQuestProgress> | ReturnType<typeof getSealedRelicQuestProgress>;
              }>;
            const selectedTraderQuest = visibleTraderQuests[0] ?? null;
            const selectedTraderQuestProgress = selectedTraderQuest?.progress ?? introductionQuestProgress;

            return (
              <>
          <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 shrink-0 rounded-xl border border-[#d9efbd]/18 bg-[#102108]/60">
                <img
                  src="/sprites/characters/body-torso-8x8.png"
                  alt="Trader body base"
                  className="pixelated absolute inset-0 h-full w-full object-contain"
                />
                <img
                  src={activeTrader.bodyTexturePath}
                  alt={`${activeTrader.name} body`}
                  className="pixelated absolute inset-0 h-full w-full object-contain"
                />
                <img
                  src="/sprites/characters/body-head-8x8.png"
                  alt="Trader head base"
                  className="pixelated absolute inset-0 h-full w-full object-contain"
                />
                <img
                  src={activeTrader.headTexturePath}
                  alt={`${activeTrader.name} head`}
                  className="pixelated absolute inset-0 h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.dialogue}</div>
                <div className="mt-2 text-sm leading-6 text-[#d8ebc7]">
                  {getTraderGreeting(activeTrader, locale)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {([
              ['shop', text.shop],
              ['quests', text.quests],
            ] as [TraderTabId, string][]).map(([tabId, label]) => (
              <button
                key={tabId}
                ref={tabId === 'quests' ? traderQuestsTabButtonRef : undefined}
                type="button"
                onClick={() => setActiveTraderTab(tabId)}
                className={`rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  activeTraderTab === tabId
                    ? 'border-[#d9efbd]/45 bg-[#d7f0b6] text-[#18310d]'
                    : 'border-[#d9efbd]/22 bg-[#203b11]/55 text-[#d7ebc1] hover:bg-[#294816]/72'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTraderTab === 'shop' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.coinPurse}</div>
                  <div className="mt-1 font-serif text-2xl font-bold text-[#ffe29c]">{formatGoldValue(character.gold)}</div>
                </div>
                <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-3 py-2 text-right">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">{text.mode}</div>
                  <div className="mt-1 text-sm font-semibold text-[#f4ffe8]">{text.buySell}</div>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.vendorStock}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">{traderOffers.length} {text.items}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {traderOffers.map((offer, index) => {
                      const item = ITEM_DEFINITIONS[offer.itemId];
                      const selected = selectedTraderPanel === 'buy' && selectedOffer?.itemId === offer.itemId;
                      return (
                        <button
                          key={`${activeTrader.id}-${offer.itemId}-${index}`}
                          type="button"
                          onClick={() => {
                            setSelectedTraderOfferId(offer.itemId);
                            setSelectedTraderPanel('buy');
                          }}
                          className={`rounded-xl border p-2 text-left transition ${
                            selected
                              ? 'border-[#d9efbd]/40 bg-[#31511b]/85'
                              : 'border-[#d9efbd]/16 bg-[#203b11]/45 hover:bg-[#294816]/72'
                          }`}
                        >
                          <div className="flex h-12 w-full items-center justify-center rounded-lg border border-[#d9efbd]/20 bg-[#102108]/60 p-1">
                            {item.type === 'gem' ? (
                              <span
                                className="pixelated h-full w-full"
                                style={{
                                  backgroundColor: adminGemColorOverrides[item.id as GemItemId] ?? item.tintColor ?? '#ffffff',
                                  WebkitMaskImage: `url(${item.texturePath})`,
                                  maskImage: `url(${item.texturePath})`,
                                  WebkitMaskRepeat: 'no-repeat',
                                  maskRepeat: 'no-repeat',
                                  WebkitMaskPosition: 'center',
                                  maskPosition: 'center',
                                  WebkitMaskSize: 'contain',
                                  maskSize: 'contain',
                                  transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                                }}
                              />
                            ) : (
                              <img
                                src={item.texturePath}
                                alt={item.name}
                                className="pixelated h-full w-full object-contain"
                                style={{
                                  transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                                }}
                              />
                            )}
                          </div>
                          <div className="mt-2 truncate text-xs font-semibold text-[#f4ffe8]">
                            {item.name}
                            {offer.quantity && offer.quantity > 1 ? ` x${offer.quantity}` : ''}
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#ffe29c]">
                            {formatGoldValue(getTraderOfferPrice(offer, itemBalanceConfig))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.yourStash}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">{sellableEntries.length} {text.items}</div>
                  </div>
                  {sellableEntries.length > 0 ? (
                    <div className="grid grid-cols-4 gap-3">
                      {sellableEntries.map(({ itemValue, index }) => {
                        const parsed = parseInventoryItem(itemValue);
                        if (!parsed) {
                          return null;
                        }
                        const item = ITEM_DEFINITIONS[parsed.itemId];
                        const payout = Math.max(1, Math.floor(getResolvedItemValue(parsed.itemId, itemBalanceConfig, parsed.quantity) * 0.5));
                        const selected = selectedTraderPanel === 'sell' && selectedSellEntry?.index === index;
                        return (
                          <button
                            key={`sell-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedTraderSellIndex(index);
                              setSelectedTraderPanel('sell');
                            }}
                            className={`rounded-xl border p-2 text-left transition ${
                              selected
                                ? 'border-[#d9efbd]/40 bg-[#31511b]/85'
                                : 'border-[#d9efbd]/16 bg-[#203b11]/45 hover:bg-[#294816]/72'
                            }`}
                          >
                            <div className="flex h-12 w-full items-center justify-center rounded-lg border border-[#d9efbd]/20 bg-[#102108]/60 p-1">
                              {item.type === 'gem' ? (
                                <span
                                  className="pixelated h-full w-full"
                                  style={{
                                    backgroundColor: adminGemColorOverrides[item.id as GemItemId] ?? item.tintColor ?? '#ffffff',
                                    WebkitMaskImage: `url(${item.texturePath})`,
                                    maskImage: `url(${item.texturePath})`,
                                    WebkitMaskRepeat: 'no-repeat',
                                    maskRepeat: 'no-repeat',
                                    WebkitMaskPosition: 'center',
                                    maskPosition: 'center',
                                    WebkitMaskSize: 'contain',
                                    maskSize: 'contain',
                                    transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                                  }}
                                />
                              ) : (
                                <img
                                  src={item.texturePath}
                                  alt={item.name}
                                  className="pixelated h-full w-full object-contain"
                                  style={{
                                    transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                                  }}
                                />
                              )}
                            </div>
                            <div className="mt-2 truncate text-xs font-semibold text-[#f4ffe8]">
                              {item.name}
                              {parsed.quantity > 1 ? ` x${parsed.quantity}` : ''}
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#ffd7a8]">
                              Sell {formatGoldValue(payout)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-5 text-sm leading-6 text-[#d8ebc7]">
                      Inventory is empty.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
                {selectedTraderPanel === 'sell' && selectedSellItem && selectedSellParsed && selectedSellEntry ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#d9efbd]/20 bg-[#102108]/60 p-2">
                        {selectedSellItem.type === 'gem' ? (
                          <span
                            className="pixelated h-full w-full"
                            style={{
                              backgroundColor: adminGemColorOverrides[selectedSellItem.id as GemItemId] ?? selectedSellItem.tintColor ?? '#ffffff',
                              WebkitMaskImage: `url(${selectedSellItem.texturePath})`,
                              maskImage: `url(${selectedSellItem.texturePath})`,
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              maskPosition: 'center',
                              WebkitMaskSize: 'contain',
                              maskSize: 'contain',
                              transform: `rotate(${selectedSellItem.iconRotationDeg ?? 0}deg) scale(${selectedSellItem.iconScale ?? 1})`,
                            }}
                          />
                        ) : (
                          <img
                            src={selectedSellItem.texturePath}
                            alt={selectedSellItem.name}
                            className="pixelated h-full w-full object-contain"
                            style={{
                              transform: `rotate(${selectedSellItem.iconRotationDeg ?? 0}deg) scale(${selectedSellItem.iconScale ?? 1})`,
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.selectedSale}</div>
                        <div className="mt-2 text-xl font-semibold text-[#f4ffe8]">
                          {selectedSellItem.name}
                          {selectedSellParsed.quantity > 1 ? ` x${selectedSellParsed.quantity}` : ''}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#d8ebc7]">
                          {getResolvedItemTooltipStats(selectedSellParsed.itemId, itemBalanceConfig).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-3 text-sm text-[#d8ebc7]">
                      {text.payout}: {formatGoldValue(Math.max(1, Math.floor(getResolvedItemValue(selectedSellParsed.itemId, itemBalanceConfig, selectedSellParsed.quantity) * 0.5)))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9fbc7e]">
                        {text.sellToTrader}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSellTraderItem(selectedSellEntry.index)}
                        className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
                      >
                        {text.sell}
                      </button>
                    </div>
                  </div>
                ) : selectedItem && selectedOffer ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#d9efbd]/20 bg-[#102108]/60 p-2">
                        {selectedItem.type === 'gem' ? (
                          <span
                            className="pixelated h-full w-full"
                            style={{
                              backgroundColor: adminGemColorOverrides[selectedItem.id as GemItemId] ?? selectedItem.tintColor ?? '#ffffff',
                              WebkitMaskImage: `url(${selectedItem.texturePath})`,
                              maskImage: `url(${selectedItem.texturePath})`,
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              maskPosition: 'center',
                              WebkitMaskSize: 'contain',
                              maskSize: 'contain',
                              transform: `rotate(${selectedItem.iconRotationDeg ?? 0}deg) scale(${selectedItem.iconScale ?? 1})`,
                            }}
                          />
                        ) : (
                          <img
                            src={selectedItem.texturePath}
                            alt={selectedItem.name}
                            className="pixelated h-full w-full object-contain"
                            style={{
                              transform: `rotate(${selectedItem.iconRotationDeg ?? 0}deg) scale(${selectedItem.iconScale ?? 1})`,
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.selectedItem}</div>
                        <div className="mt-2 text-xl font-semibold text-[#f4ffe8]">
                          {selectedItem.name}
                          {selectedOffer.quantity && selectedOffer.quantity > 1 ? ` x${selectedOffer.quantity}` : ''}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#d8ebc7]">
                          {getResolvedItemTooltipStats(selectedOffer.itemId, itemBalanceConfig).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-3 text-sm text-[#d8ebc7]">
                      {text.cost}: {formatGoldValue(getTraderOfferPrice(selectedOffer, itemBalanceConfig))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9fbc7e]">
                        {selectedItem.type} / {text.instantDelivery}
                      </div>
                      <button
                        type="button"
                        disabled={character.gold < getTraderOfferPrice(selectedOffer, itemBalanceConfig)}
                        onClick={() => handleTakeTraderItem(selectedOffer.itemId, selectedOffer.quantity ?? 1)}
                        className={`rounded-xl border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                          character.gold >= getTraderOfferPrice(selectedOffer, itemBalanceConfig)
                            ? 'border-[#d9efbd]/30 bg-[#d7f0b6] text-[#18310d] hover:bg-[#e7f8cf]'
                            : 'cursor-not-allowed border-[#d9efbd]/14 bg-[#203b11]/35 text-[#88a26e]'
                        }`}
                      >
                        {text.buy}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-5 text-sm leading-6 text-[#d8ebc7]">
                    {text.noItemsSelected}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
              <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{text.quests}</div>
              {selectedTraderQuest ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-4 text-sm leading-6 text-[#d8ebc7]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">{text.quest}</div>
                    <div className="mt-2 text-xl font-semibold text-[#f4ffe8]">{selectedTraderQuest.definition.title}</div>
                    <div className="mt-3">{selectedTraderQuest.definition.description(username, locale)}</div>
                  </div>

                  {selectedTraderQuest.definition.requiredTurnInItemId ? (
                    <QuestRequiredItemCard
                      itemId={selectedTraderQuest.definition.requiredTurnInItemId}
                      itemBalanceConfig={itemBalanceConfig}
                      hasItem={hasInventoryItem(character.inventory, selectedTraderQuest.definition.requiredTurnInItemId)}
                      labels={text}
                    />
                  ) : null}

                  <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">{text.steps}</div>
                    <div className="mt-3 space-y-3">
                      {selectedTraderQuest.definition.steps.map((step, index) => {
                        const currentStepIndex = selectedTraderQuestProgress.currentStepId
                          ? selectedTraderQuest.definition.steps.findIndex((candidate) => candidate.id === selectedTraderQuestProgress.currentStepId)
                          : -1;
                        const isCompleted =
                          selectedTraderQuestProgress.rewardClaimedAt !== null ||
                          (currentStepIndex !== -1 && index < currentStepIndex);
                        const isCurrent =
                          selectedTraderQuestProgress.status === 'active' &&
                          selectedTraderQuestProgress.currentStepId === step.id;

                        return (
                          <div
                            key={step.id}
                            className={`rounded-lg border px-3 py-3 ${
                              isCurrent
                                ? 'border-[#ffe699]/35 bg-[#3a2d0f]/45'
                                : isCompleted
                                  ? 'border-[#7db56a]/24 bg-[#17320d]/40'
                                  : 'border-[#d9efbd]/12 bg-[#13240b]/35'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                  isCompleted
                                    ? 'bg-[#7db56a] text-[#102008]'
                                    : isCurrent
                                      ? 'bg-[#ffe699] text-[#2f2307]'
                                      : 'bg-[#203b11] text-[#d8ebc7]'
                                }`}
                              >
                                {isCompleted ? '✓' : index + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-[#f4ffe8]">{step.title}</div>
                                <div className="text-xs text-[#cfe1ba]">{step.description}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-3">
                    <div className="text-sm text-[#d8ebc7]">
                      {selectedTraderQuest.status === 'ready'
                        ? text.questReadyMessage
                        : selectedTraderQuest.status === 'active'
                          ? text.questActiveMessage
                          : text.questAvailableMessage}
                    </div>
                    <button
                      ref={selectedTraderQuest.status === 'available' ? traderAcceptQuestButtonRef : undefined}
                      type="button"
                      disabled={
                        selectedTraderQuest.status === 'active' ||
                        (selectedTraderQuest.status === 'ready' && selectedTraderQuestProgress.rewardClaimedAt !== null)
                      }
                      onClick={
                        selectedTraderQuest.status === 'ready' && selectedTraderQuestProgress.rewardClaimedAt === null
                          ? () => handleCompleteTraderQuest(selectedTraderQuest.definition.id)
                          : () => handleAcceptTraderQuest(selectedTraderQuest.definition.id)
                      }
                      className={`rounded-xl border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        selectedTraderQuest.status === 'available' ||
                        (selectedTraderQuest.status === 'ready' && selectedTraderQuestProgress.rewardClaimedAt === null)
                          ? 'border-[#d9efbd]/30 bg-[#d7f0b6] text-[#18310d] hover:bg-[#e7f8cf]'
                          : 'cursor-not-allowed border-[#d9efbd]/14 bg-[#203b11]/35 text-[#88a26e]'
                      }`}
                    >
                      {selectedTraderQuest.status === 'ready'
                        ? selectedTraderQuestProgress.rewardClaimedAt !== null
                          ? text.completed
                          : text.complete
                        : selectedTraderQuest.status === 'active'
                          ? text.inProgress
                          : text.accept}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#d9efbd]/16 bg-[#203b11]/45 px-4 py-5 text-sm leading-6 text-[#d8ebc7]">
                  {text.noQuestsAvailable}
                </div>
              )}
            </div>
          )}

          {traderStatus ? (
            <div className="rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-2 text-sm text-[#d8ebc7]">
              {traderStatus}
            </div>
          ) : null}
              </>
            );
          })()}
        </HudWindow>
      ) : null}

      <div
        ref={objectiveArrowRef}
        className="pointer-events-none fixed left-0 top-0 z-20"
        style={{ display: 'none' }}
      >
        <svg
          width="40"
          height="34"
          viewBox="0 0 28 24"
          className="animate-[objective-bounce_1s_ease-in-out_infinite]"
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}
        >
          <polygon points="28,12 0,0 6,12 0,24" fill="#ffe28a" stroke="#4a1b0c" strokeWidth="2" />
        </svg>
      </div>
      <div
        ref={objectiveArrowLabelRef}
        className="pointer-events-none fixed left-0 top-0 z-20 whitespace-nowrap font-bold text-[#fff4cf]"
        style={{
          display: 'none',
          fontFamily: 'Georgia, serif',
          fontSize: '15px',
          textShadow: '-2px 0 #2a160a, 2px 0 #2a160a, 0 -2px #2a160a, 0 2px #2a160a, -1px -1px #2a160a, 1px -1px #2a160a, -1px 1px #2a160a, 1px 1px #2a160a',
        }}
      />
      <div
        ref={tutorialUiArrowRef}
        className="pointer-events-none fixed left-0 top-0 z-[60]"
        style={{ display: 'none' }}
      >
        <svg
          width="40"
          height="34"
          viewBox="0 0 28 24"
          className="animate-[objective-bounce_1s_ease-in-out_infinite]"
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}
        >
          <polygon points="28,12 0,0 6,12 0,24" fill="#ffe28a" stroke="#4a1b0c" strokeWidth="2" />
        </svg>
      </div>
      <div
        ref={tutorialUiArrowLabelRef}
        className="pointer-events-none fixed left-0 top-0 z-[60] whitespace-nowrap font-bold text-[#fff4cf]"
        style={{
          display: 'none',
          fontFamily: 'Georgia, serif',
          fontSize: '15px',
          textShadow: '-2px 0 #2a160a, 2px 0 #2a160a, 0 -2px #2a160a, 0 2px #2a160a, -1px -1px #2a160a, 1px -1px #2a160a, -1px 1px #2a160a, 1px 1px #2a160a',
        }}
      />

      <div className="pointer-events-auto absolute bottom-5 right-5 z-30 flex flex-col gap-2">
        <button
          type="button"
          ref={lobbyToolsToggleButtonRef}
          onClick={() => setLobbyToolsVisible((current) => !current)}
          className="rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/78 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#f4ffe8] shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-[#244713]/78"
        >
          {lobbyToolsVisible ? 'Hide World' : 'Show World'}
        </button>
      </div>

      {playerRole === 'admin' ? (
        <>
          <div className="pointer-events-auto absolute bottom-20 right-5 z-30 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setAdminToolsVisible((current) => !current)}
              className="rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/78 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#f4ffe8] shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-[#244713]/78"
            >
              {adminToolsVisible ? 'Hide Admin' : 'Show Admin'}
            </button>
          </div>

          {adminToolsVisible ? (
            <HudWindow
              title="Admin Tools"
              storageKey={ADMIN_TOOLS_POSITION_STORAGE_KEY}
              defaultPosition={{ left: 20, top: 20 }}
              onClose={() => setAdminToolsVisible(false)}
              headerActions={
                <button
                  type="button"
                  onClick={() => setSkillEffectOverrides(DEFAULT_SKILL_EFFECT_OVERRIDES)}
                  className="cursor-pointer rounded-xl border border-[#d9efbd]/30 bg-[#244713]/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4ffe8] transition hover:bg-[#2f5a19]/75"
                >
                  Reset
                </button>
              }
              className="z-30 w-[420px] border-[#d9efbd]/30 bg-[#17320d]/90 text-[#f3ffe7]"
            >

          <div className="mt-4 grid grid-cols-4 gap-2">
            {[ 
              ['skills', 'Skills'],
              ['balance', 'Balance'],
              ['mobs', 'Mobs'],
              ['items', 'Items'],
              ['world', 'World'],
              ['assets', 'Assets'],
              ['system', 'System'],
            ].map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveAdminTab(tabId as AdminTabId)}
                className={`rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  activeAdminTab === tabId
                    ? 'border-[#d9efbd]/45 bg-[#d7f0b6] text-[#18310d]'
                    : 'border-[#d9efbd]/22 bg-[#203b11]/55 text-[#d7ebc1] hover:bg-[#294816]/72'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Search Images</span>
              <input
                type="text"
                value={adminImageSearch}
                onChange={(event) => setAdminImageSearch(event.target.value)}
                placeholder="/items/equipment/effects/fire"
                className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none placeholder:text-[#a9c38d]"
              />
            </label>
            <div className="mt-2 text-xs text-[#bfd8a4]">
              Matches: {filteredAdminImageOptions.length}
            </div>
          </div>

          <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
            {activeAdminTab === 'skills' ? (
              <div className="space-y-4">
                {(Object.keys(skillEffectOverrides) as SkillEffectId[]).map((skillId) => {
                  const config = skillEffectOverrides[skillId];
                  const visibleOptions = filteredAdminImageOptions.includes(config.texturePath)
                    ? filteredAdminImageOptions
                    : [config.texturePath, ...filteredAdminImageOptions];

                  return (
                    <div
                      key={skillId}
                      className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{skillId}</div>
                          <div className="mt-1 text-sm text-[#e9f7da]">{config.texturePath}</div>
                        </div>
                        <img
                          src={config.texturePath}
                          alt={skillId}
                          className="pixelated h-12 w-12 rounded-lg border border-[#d9efbd]/20 bg-[#203b11]/65 object-contain p-1"
                        />
                      </div>

                      <label className="mt-3 block text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">
                        Image From Public
                      </label>
                      <select
                        value={config.texturePath}
                        onChange={(event) => handleSkillEffectChange(skillId, 'texturePath', event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      >
                        {visibleOptions.map((path) => (
                          <option key={path} value={path}>
                            {path}
                          </option>
                        ))}
                      </select>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {[
                          ['frameWidth', 'Frame W'],
                          ['frameHeight', 'Frame H'],
                          ['startFrame', 'Start Frame'],
                          ['startRowFrames', 'Top Offset'],
                          ['frameCount', 'Frames'],
                          ['fps', 'FPS'],
                          ['displaySize', 'Display Px'],
                        ].map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">{label}</span>
                            <input
                              type="number"
                              min={1}
                              value={config[field as keyof SkillEffectConfig] as number}
                              onChange={(event) =>
                                handleSkillEffectChange(
                                  skillId,
                                  field as keyof SkillEffectConfig,
                                  event.target.value,
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeAdminTab === 'balance' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSkillBalanceConfig(skillBalanceDraft)}
                    className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkillBalanceDraft(skillBalanceConfig)}
                    className="rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7ebc1] transition hover:bg-[#294816]/72"
                  >
                    Revert
                  </button>
                </div>

                {(Object.keys(skillBalanceDraft) as Array<keyof SkillBalanceConfig>).map((skillId) => {
                  const config = skillBalanceDraft[skillId];

                  return (
                    <div
                      key={skillId}
                      className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3"
                    >
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{skillId}</div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {([
                          ['damage', 'Damage'],
                          ['burnDamage', 'Burn Dmg'],
                          ['burnTicks', 'Burn Ticks'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">{label}</span>
                            <input
                              type="number"
                              min={0}
                              value={config[field]}
                              onChange={(event) => handleSkillBalanceChange(skillId, field, event.target.value)}
                              className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeAdminTab === 'mobs' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMobBalanceConfig(mobBalanceDraft)}
                    className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobBalanceDraft(mobBalanceConfig)}
                    className="rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7ebc1] transition hover:bg-[#294816]/72"
                  >
                    Revert
                  </button>
                </div>

                {(Object.keys(mobBalanceDraft) as Array<keyof MobBalanceConfig>).map((mobId) => {
                  const config = mobBalanceDraft[mobId];

                  return (
                    <div
                      key={mobId}
                      className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3"
                    >
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">{mobId}</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {([
                          ['maxHealth', 'Max HP'],
                          ['moveSpeed', 'Move Speed'],
                          ['aggroRange', 'Aggro Range'],
                          ['leashRange', 'Leash Range'],
                          ['attackRange', 'Attack Range'],
                          ['attackDamage', 'Attack Damage'],
                          ['attackCooldownMs', 'Atk CD Ms'],
                          ['experienceReward', 'XP Reward'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">{label}</span>
                            <input
                              type="number"
                              min={0}
                              value={config[field]}
                              onChange={(event) => handleMobBalanceChange(mobId, field, event.target.value)}
                              className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeAdminTab === 'items' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3 text-sm text-[#d8ebc7]">
                  Click an item to add one copy directly to your inventory. Stackable items will stack automatically. You can also edit tooltip stat lines, fire resistance and price here.
                </div>

                {adminItemStatus ? (
                  <div className="rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-2 text-sm text-[#d8ebc7]">
                    {adminItemStatus}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Item Editor</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setItemBalanceDraft(cloneItemBalanceConfig(itemBalanceConfig));
                          setAdminItemStatus('Reverted item balance draft.');
                        }}
                        className="rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7ebc1] transition hover:bg-[#294816]/72"
                      >
                        Revert
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItemBalanceConfig(cloneItemBalanceConfig(itemBalanceDraft));
                          setAdminItemStatus(`Saved balance for ${selectedAdminItem.name}.`);
                        }}
                        className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                    <div className="flex h-28 items-center justify-center rounded-2xl border border-[#d9efbd]/18 bg-[#102108]/60 p-3">
                      {selectedAdminItem.type === 'gem' ? (
                        <span
                          className="pixelated h-16 w-16"
                          style={{
                            backgroundColor: adminGemColorOverrides[selectedAdminItem.id as GemItemId] ?? selectedAdminItem.tintColor ?? '#ffffff',
                            WebkitMaskImage: `url(${selectedAdminItem.texturePath})`,
                            maskImage: `url(${selectedAdminItem.texturePath})`,
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'center',
                            maskPosition: 'center',
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain',
                            transform: `rotate(${selectedAdminItem.iconRotationDeg ?? 0}deg) scale(${selectedAdminItem.iconScale ?? 1})`,
                          }}
                        />
                      ) : (
                        <img
                          src={selectedAdminItem.texturePath}
                          alt={selectedAdminItem.name}
                          className="pixelated h-16 w-16 object-contain"
                          style={{
                            transform: `rotate(${selectedAdminItem.iconRotationDeg ?? 0}deg) scale(${selectedAdminItem.iconScale ?? 1})`,
                          }}
                        />
                      )}
                    </div>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Item</span>
                        <select
                          value={selectedAdminItemId}
                          onChange={(event) => setSelectedAdminItemId(event.target.value as ItemId)}
                          className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                        >
                          {ADMIN_ITEM_DEFINITIONS.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Price</span>
                          <input
                            type="number"
                            min={0}
                            value={selectedAdminItemBalance.value}
                            onChange={(event) => handleItemBalanceValueChange(selectedAdminItemId, event.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Fire Resist %</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedAdminItemBalance.fireResistancePercent}
                            onChange={(event) => handleItemBalanceFireResistanceChange(selectedAdminItemId, event.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Tooltip Stats</span>
                    <textarea
                      rows={5}
                      value={selectedAdminItemBalance.tooltipStats.join('\n')}
                      onChange={(event) => handleItemBalanceTooltipChange(selectedAdminItemId, event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-3 text-sm leading-6 text-[#f3ffe7] outline-none"
                    />
                  </label>
                </div>

                {ADMIN_ITEM_DEFINITIONS.some((item) => item.type === 'gem') ? (
                  <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Gem Colors</div>
                    <div className="grid grid-cols-2 gap-3">
                      {ADMIN_ITEM_DEFINITIONS.filter((item) => item.type === 'gem').map((item) => (
                        <label key={item.id} className="block">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[#bfd8a4]">{item.name}</span>
                          <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-2">
                            <span
                              className="pixelated h-10 w-10 shrink-0"
                              style={{
                                backgroundColor: adminGemColorOverrides[item.id as GemItemId] ?? item.tintColor ?? '#ffffff',
                                WebkitMaskImage: `url(${item.texturePath})`,
                                maskImage: `url(${item.texturePath})`,
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskPosition: 'center',
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                              }}
                            />
                            <input
                              type="color"
                              value={adminGemColorOverrides[item.id as GemItemId] ?? item.tintColor ?? '#ffffff'}
                              onChange={(event) => {
                                const nextColor = event.target.value;
                                setAdminGemColorOverrides((current) => ({
                                  ...current,
                                  [item.id as GemItemId]: nextColor,
                                }));
                              }}
                              className="block h-10 w-full cursor-pointer rounded-lg border border-[#d9efbd]/22 bg-[#203b11]/70 p-1"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  {ADMIN_ITEM_DEFINITIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        void handleGiveItemToSelf(item.id);
                      }}
                      disabled={adminItemBusyId !== null}
                      className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3 text-left transition hover:bg-[linear-gradient(180deg,rgba(52,84,31,0.82),rgba(27,46,16,0.88))] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#d9efbd]/20 bg-[#203b11]/65 p-1">
                          {item.type === 'gem' ? (
                            <span
                              className="pixelated h-full w-full"
                              style={{
                                backgroundColor: adminGemColorOverrides[item.id as GemItemId] ?? item.tintColor ?? '#ffffff',
                                WebkitMaskImage: `url(${item.texturePath})`,
                                maskImage: `url(${item.texturePath})`,
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskPosition: 'center',
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                              }}
                            />
                          ) : (
                            <img
                              src={item.texturePath}
                              alt={item.name}
                              className="pixelated h-full w-full object-contain"
                              style={{
                                transform: `rotate(${item.iconRotationDeg ?? 0}deg) scale(${item.iconScale ?? 1})`,
                              }}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#f4ffe8]">{item.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#bfd8a4]">
                            {item.type}
                            {item.stackable ? ` · Stack ${item.maxStack ?? 1}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs leading-5 text-[#d8ebc7]">
                        {getResolvedItemTooltipStats(item.id, itemBalanceDraft).join(' · ')}
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#ffe29c]">
                        Value: {formatGoldValue(getResolvedItemValue(item.id, itemBalanceDraft))}
                      </div>
                      <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#9fbc7e]">
                        {adminItemBusyId === item.id ? 'Adding...' : `Give ${item.id}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeAdminTab === 'world' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {([
                    ['tile', 'Tiles'],
                    ['sprite', 'Sprites'],
                    ['trader', 'Traders'],
                    ['spawn', 'Spawn'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorldEditorMode(mode)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        worldEditorMode === mode
                          ? 'border-[#d9efbd]/45 bg-[#d7f0b6] text-[#18310d]'
                          : 'border-[#d9efbd]/22 bg-[#203b11]/55 text-[#d7ebc1] hover:bg-[#294816]/72'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {worldEditorMode === 'tile' ? (
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['grassGround', 'Grass'],
                      ['ground', 'Ground'],
                      ['water', 'Water'],
                    ] as const).map(([tile, label]) => (
                      <button
                        key={tile}
                        type="button"
                        onClick={() => setSelectedWorldTile(tile)}
                        className={`rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                          selectedWorldTile === tile
                            ? 'border-[#d9efbd]/45 bg-[#d7f0b6] text-[#18310d]'
                            : 'border-[#d9efbd]/22 bg-[#203b11]/55 text-[#d7ebc1] hover:bg-[#294816]/72'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : worldEditorMode === 'sprite' ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Folder</span>
                      <select
                        value={selectedWorldSpriteFolder}
                        onChange={(event) => setSelectedWorldSpriteFolder(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      >
                        {worldSpriteFolders.map((folder) => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Sprite</span>
                      <select
                        value={selectedWorldSprite.texturePath}
                        onChange={(event) =>
                          setSelectedWorldSprite((current) => ({
                            ...current,
                            texturePath: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      >
                        {worldSpriteOptions.map((spritePath) => (
                          <option key={spritePath} value={spritePath}>
                            {spritePath.split('/').at(-1) ?? spritePath}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Scale</span>
                      <input
                        type="number"
                        min={0.25}
                        max={8}
                        step={0.25}
                        value={selectedWorldSprite.scale}
                        onChange={(event) =>
                          setSelectedWorldSprite((current) => ({
                            ...current,
                            scale: Math.max(0.25, Math.min(8, Number.parseFloat(event.target.value) || 1)),
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      />
                    </label>
                    <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Preview</div>
                      <div className="mt-3 flex min-h-[96px] items-center justify-center rounded-xl border border-[#d9efbd]/18 bg-[#102108]/60 p-3">
                        {selectedWorldSprite.texturePath ? (
                          <img
                            src={selectedWorldSprite.texturePath}
                            alt="Selected world sprite preview"
                            className="h-16 w-16 object-contain"
                            style={{
                              transform: `rotate(${selectedWorldSprite.rotation}deg) scale(${selectedWorldSprite.scale}) scaleX(${selectedWorldSprite.flipX ? -1 : 1})`,
                              imageRendering: 'pixelated',
                            }}
                          />
                        ) : (
                          <div className="text-xs uppercase tracking-[0.18em] text-[#9fbc7e]">No Sprite</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : worldEditorMode === 'trader' ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Name</span>
                      <input
                        type="text"
                        value={selectedWorldTrader.name}
                        onChange={(event) =>
                          setSelectedWorldTrader((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Body</span>
                      <select
                        value={selectedWorldTrader.bodyTexturePath}
                        onChange={(event) =>
                          setSelectedWorldTrader((current) => ({
                            ...current,
                            bodyTexturePath: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      >
                        {worldTraderBodyOptions.map((spritePath) => (
                          <option key={spritePath} value={spritePath}>
                            {spritePath.split('/').at(-1) ?? spritePath}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#bfd8a4]">Head</span>
                      <select
                        value={selectedWorldTrader.headTexturePath}
                        onChange={(event) =>
                          setSelectedWorldTrader((current) => ({
                            ...current,
                            headTexturePath: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/70 px-3 py-2 text-sm text-[#f3ffe7] outline-none"
                      >
                        {worldTraderHeadOptions.map((spritePath) => (
                          <option key={spritePath} value={spritePath}>
                            {spritePath.split('/').at(-1) ?? spritePath}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Preview</div>
                      <div className="mt-3 flex min-h-[120px] items-center justify-center rounded-xl border border-[#d9efbd]/18 bg-[#102108]/60 p-3">
                        {selectedWorldTrader.bodyTexturePath || selectedWorldTrader.headTexturePath ? (
                          <div className="relative h-20 w-20">
                            <img
                              src="/sprites/characters/body-torso-8x8.png"
                              alt="Trader body base"
                              className="pixelated absolute inset-0 h-full w-full object-contain"
                            />
                            {selectedWorldTrader.bodyTexturePath ? (
                              <img
                                src={selectedWorldTrader.bodyTexturePath}
                                alt="Trader body preview"
                                className="pixelated absolute inset-0 h-full w-full object-contain"
                              />
                            ) : null}
                            <img
                              src="/sprites/characters/body-head-8x8.png"
                              alt="Trader head base"
                              className="pixelated absolute inset-0 h-full w-full object-contain"
                            />
                            {selectedWorldTrader.headTexturePath ? (
                              <img
                                src={selectedWorldTrader.headTexturePath}
                                alt="Trader head preview"
                                className="pixelated absolute inset-0 h-full w-full object-contain"
                              />
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-xs uppercase tracking-[0.18em] text-[#9fbc7e]">No Trader Parts</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">Spawn Point</div>
                    <div className="mt-3 text-sm text-[#d8ebc7]">
                      Click or drag directly on the world to place the spawn point.
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveWorldMap().catch((error) => {
                        setWorldMapStatus(error instanceof Error ? error.message : 'Failed to save world map.');
                      });
                    }}
                    className="rounded-xl border border-[#d9efbd]/30 bg-[#d7f0b6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
                  >
                    Save Map
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleReloadWorldMap().catch((error) => {
                        setWorldMapStatus(error instanceof Error ? error.message : 'Failed to reload world map.');
                      });
                    }}
                    className="rounded-xl border border-[#d9efbd]/22 bg-[#203b11]/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d7ebc1] transition hover:bg-[#294816]/72"
                  >
                    Reload
                  </button>
                </div>

                {worldMapStatus ? (
                  <div className="rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-2 text-sm text-[#d8ebc7]">
                    {worldMapStatus}
                  </div>
                ) : null}

                {worldMapDraft ? (
                  <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">World Paint Mode</div>
                    <div className="space-y-2 text-sm text-[#d8ebc7]">
                      <div>
                        {worldEditorMode === 'tile'
                          ? 'Hold left mouse button and paint directly on the world.'
                          : worldEditorMode === 'sprite'
                            ? 'Hold left mouse button to place the selected sprite on the world. Right mouse button removes the sprite from a tile.'
                            : worldEditorMode === 'trader'
                              ? 'Hold left mouse button to place a trader. Right mouse button removes the trader from a tile.'
                            : 'Click or drag on the world to move the spawn point.'}
                      </div>
                      <div>
                        Brush:
                        {' '}
                        {worldEditorMode === 'tile'
                          ? selectedWorldTile
                          : worldEditorMode === 'sprite'
                            ? `${selectedWorldSprite.texturePath || 'no sprite selected'} @ ${selectedWorldSprite.rotation}deg x${selectedWorldSprite.scale}${selectedWorldSprite.flipX ? ' mirror' : ''}`
                            : worldEditorMode === 'trader'
                              ? `${selectedWorldTrader.name || 'Trader'} · ${selectedWorldTrader.bodyTexturePath || 'no body'} · ${selectedWorldTrader.headTexturePath || 'no head'}`
                            : `spawn @ ${worldMapDraft.spawn.x}:${worldMapDraft.spawn.y}`}
                      </div>
                      <div>
                        Cursor:
                        {' '}
                        {worldHoverTile ? `${worldHoverTile.x}:${worldHoverTile.y}` : '--:--'}
                      </div>
                      <div>Draft sprite-tiles: {worldMapDraft.stamps.length}</div>
                      <div>Draft traders: {worldMapDraft.traders.length}</div>
                      <div>Texture key: {worldEditorDebug.textureKey || 'none'}</div>
                      <div>Texture loaded: {worldEditorDebug.textureLoaded ? 'yes' : 'no'}</div>
                      {worldEditorMode === 'sprite' ? (
                        <div>
                          Transform:
                          {' '}
                          rotation {selectedWorldSprite.rotation}deg, scale {selectedWorldSprite.scale}, {selectedWorldSprite.flipX ? 'mirrored' : 'normal'}
                        </div>
                      ) : null}
                      {worldEditorMode === 'sprite' ? <div>Hotkeys: R rotate, F mirror</div> : null}
                      <div>
                        Spawn:
                        {' '}
                        {worldMapDraft.spawn.x}:{worldMapDraft.spawn.y}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#d9efbd]/18 bg-[#203b11]/45 px-3 py-2 text-sm text-[#d8ebc7]">
                    Loading world map...
                  </div>
                )}
              </div>
            ) : null}

            {activeAdminTab === 'assets' ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredAdminImageOptions.map((path) => (
                  <div
                    key={path}
                    className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3"
                  >
                    <img
                      src={path}
                      alt={path}
                      className="pixelated mx-auto h-20 w-20 rounded-lg border border-[#d9efbd]/20 bg-[#203b11]/65 object-contain p-1"
                    />
                    <div className="mt-2 break-all text-xs text-[#d8ebc7]">{path}</div>
                  </div>
                ))}
                {filteredAdminImageOptions.length === 0 ? (
                  <div className="col-span-2 rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4 text-sm text-[#d8ebc7]">
                    No images matched the current search.
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeAdminTab === 'system' ? (
              <div className="rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#bfd8a4]">System</div>
                <div className="mt-3 space-y-2 text-sm text-[#d8ebc7]">
                  <div>Logged in as: {username}</div>
                  <div>Role: {playerRole}</div>
                  <div>Loaded images: {adminImageOptions.length}</div>
                  <div>Future sections can be added here without growing the skills tab.</div>
                </div>
              </div>
            ) : null}
          </div>
        </HudWindow>
          ) : null}
        </>
      ) : null}

      {isDead ? (
        <section className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[rgba(10,16,8,0.45)]">
          <div className="rounded-[2rem] border border-[#d9efbd]/24 bg-[#17320d]/88 px-8 py-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-md">
            <div className="text-xs uppercase tracking-[0.28em] text-[#bfd8a4]">{text.defeated}</div>
            <h2 className="mt-3 font-serif text-4xl font-bold text-[#f6ffea]">{text.youDied}</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#dceec9]">
              {text.deathMessage}
            </p>
            <button
              type="button"
              onClick={handleRespawnRequest}
              className="mt-6 rounded-2xl bg-[#d7f0b6] px-5 py-3 font-semibold uppercase tracking-[0.18em] text-[#18310d] transition hover:bg-[#e7f8cf]"
            >
              {text.respawn}
            </button>
          </div>
        </section>
      ) : null}

      <GameChat
        messages={chatMessages}
        onSendMessage={(text) => {
          const giveItemMatch = text.match(/^\/giveitem\s+(\S+)\s+(\S+)$/i);

          if (giveItemMatch) {
            const [, targetNickname, itemCode] = giveItemMatch;

            void giveItemToPlayer({
              nickname: targetNickname,
              itemCode,
            })
              .then((player) => {
                if (player.nickname === username) {
                  applySerializedCharacter(player.character);
                }

                setChatMessages((current) => [
                  ...current,
                  {
                    id: `command-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                    author: 'Admin',
                    text: `Gave ${itemCode} to ${player.nickname}.`,
                    channel: 'general',
                    createdAt: new Date().toISOString(),
                  },
                ]);
              })
              .catch((error) => {
                setChatMessages((current) => [
                  ...current,
                  {
                    id: `command-error-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                    author: 'Admin',
                    text: error instanceof Error ? error.message : 'Command failed.',
                    channel: 'general',
                    createdAt: new Date().toISOString(),
                  },
                ]);
              });

            return;
          }

          setChatMessages((current) => [
            ...current,
            {
              id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
              author: username,
              text,
              channel: 'general',
              createdAt: new Date().toISOString(),
            },
          ]);
          chatSenderRef.current?.(text);
        }}
        onInputFocusChange={setChatInputFocused}
      />
    </main>
  );
}
