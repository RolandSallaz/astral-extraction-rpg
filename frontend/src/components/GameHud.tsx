'use client';

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { HudWindow } from '@/components/ui/HudWindow';
import {
  DEFAULT_ITEM_BALANCE_CONFIG,
  getResolvedItemTooltipStats,
  getResolvedItemValue,
  type ItemBalanceConfig,
} from '@/lib/itemBalance';
import {
  EQUIPMENT_ITEMS,
  type GemItemId,
  type EquipmentItemId,
  type ConsumableItemId,
  type BaseEquipmentSlot,
  getInventoryItemId,
  getEquipmentGemSlotIds,
  getBaseEquipmentSlot,
  parseInventoryItem,
  serializeInventoryItem,
  type EquipmentSlot,
} from '@/lib/items/equipmentItems';
import {
  type EquipmentState,
  type InventoryState,
} from '@/lib/playerProfile';

export type ContainerView = {
  id: string;
  title: string;
  subtitle: string;
  columns: number;
  rows: number;
  slots: InventoryState;
};

type ConsumableUseRequest =
  | { type: 'inventory'; slotIndex: number }
  | { type: 'container'; containerId: string; slotIndex: number };

type EquipSlotId = BaseEquipmentSlot;

type DragSource =
  | { type: 'inventory'; index: number }
  | { type: 'container'; index: number }
  | { type: 'equipment'; slot: EquipmentSlot }
  | { type: 'inspect-socket'; itemSource: DragSource; socketIndex: number }
  | { type: 'skill-library'; skillId: SkillId }
  | { type: 'action-bar'; slotKey: ActionSlotKey };

type DragState = {
  itemId: string | null;
  skillId: SkillId | null;
  source: DragSource;
  pointerX: number;
  pointerY: number;
};

type HoveredItemState = {
  itemId: string;
  pointerX: number;
  pointerY: number;
  scope: 'inventory' | 'equipment' | 'container' | 'inspect' | 'action-bar';
};

type HoveredSkillState = {
  skillId: SkillId;
  pointerX: number;
  pointerY: number;
  scope: 'skill-library' | 'action-bar';
};

type ItemContextMenuState = {
  itemValue: string;
  source: DragSource;
  pointerX: number;
  pointerY: number;
};

type InspectItemState = {
  itemValue: string;
  source: DragSource;
};

type SkillId = 'fireball' | 'fireNova' | 'fireField';

type ActionSlotKey = '1' | '2' | '3' | '4' | 'Q' | 'E' | 'R';

type ActionBarBinding =
  | { kind: 'skill'; skillId: SkillId }
  | { kind: 'item'; itemId: ConsumableItemId };

function isSameDragSource(left: DragSource, right: DragSource): boolean {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === 'inventory' && right.type === 'inventory') {
    return left.index === right.index;
  }

  if (left.type === 'container' && right.type === 'container') {
    return left.index === right.index;
  }

  if (left.type === 'equipment' && right.type === 'equipment') {
    return left.slot === right.slot;
  }

  if (left.type === 'inspect-socket' && right.type === 'inspect-socket') {
    return (
      left.socketIndex === right.socketIndex &&
      isSameDragSource(left.itemSource, right.itemSource)
    );
  }

  if (left.type === 'skill-library' && right.type === 'skill-library') {
    return left.skillId === right.skillId;
  }

  if (left.type === 'action-bar' && right.type === 'action-bar') {
    return left.slotKey === right.slotKey;
  }

  return false;
}

type HudPanel = 'inventory' | 'equipment';

const EQUIP_SLOTS: Array<{ id: EquipSlotId; label: string }> = [
  { id: 'amulet', label: 'Amulet' },
  { id: 'weapon', label: 'Weapon' },
  { id: 'offhand', label: 'Offhand' },
  { id: 'ring-1', label: 'Ring I' },
  { id: 'ring-2', label: 'Ring II' },
];

const HUD_WINDOW_GREEN_CLASS =
  'border-[#d9efbd]/35 bg-[#17320d]/82';
const HUD_WINDOW_BROWN_CLASS =
  'border-[#d9efbd]/35 bg-[#17320d]/82';
const HUD_SECTION_CLASS =
  'rounded-2xl border border-[#89ad5d]/20 bg-[linear-gradient(180deg,rgba(39,64,23,0.72),rgba(23,38,14,0.78))] p-3';
const HUD_GRID_SLOT_CLASS =
  'flex aspect-square items-center justify-center rounded-lg border border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.68),rgba(28,48,16,0.72))] shadow-[inset_0_1px_0_rgba(232,255,211,0.06)] transition hover:border-[#cfe8ab]/35';
const HUD_CONTAINER_SLOT_CLASS =
  'flex aspect-square items-center justify-center rounded-lg border border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.68),rgba(28,48,16,0.72))] shadow-[inset_0_1px_0_rgba(232,255,211,0.06)] transition hover:border-[#cfe8ab]/35';
const SKILL_BAR_SLOT_CLASS =
  'group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d9efbd]/28 bg-[linear-gradient(180deg,rgba(41,68,24,0.88),rgba(20,34,12,0.92))] shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(232,255,211,0.07)]';
const INVENTORY_SLOT_SIZE = 40;
const CONTAINER_SLOT_SIZE = 40;
const INVENTORY_POSITION_STORAGE_KEY = 'mmorpg.ui.inventory.position.v1';
const EQUIPMENT_POSITION_STORAGE_KEY = 'mmorpg.ui.equipment.position.v1';
const CONTAINER_POSITION_STORAGE_KEY = 'mmorpg.ui.container.position.v1';
const ACTION_BAR_STORAGE_KEY = 'mmorpg.ui.action-bar.bindings.v1';
const ACTION_BAR_SLOTS: Array<{ key: ActionSlotKey; code?: string }> = [
  { key: '1', code: 'Digit1' },
  { key: '2', code: 'Digit2' },
  { key: '3', code: 'Digit3' },
  { key: '4', code: 'Digit4' },
  { key: 'Q', code: 'KeyQ' },
  { key: 'E', code: 'KeyE' },
  { key: 'R', code: 'KeyR' },
];

type SkillCooldownState = Partial<Record<SkillId, number>>;
type ConsumableCooldownState = Partial<Record<'healing_potion' | 'teleport_scroll', number>>;
const CONSUMABLE_COOLDOWN_MS: Partial<Record<ConsumableItemId, number>> = {
  healing_potion: 20000,
};

const SKILL_ICONS: Partial<Record<SkillId, { src: string; alt: string }>> = {
  fireball: {
    src: '/ui/skills/fireball-skill-16x16.png',
    alt: 'Fireball',
  },
  fireNova: {
    src: '/ui/skills/fire-nova-skill-16x16.png',
    alt: 'Fire Nova',
  },
  fireField: {
    src: '/ui/skills/fire-field-skill-16x16.png',
    alt: 'Fire Field',
  },
};

const SKILL_COOLDOWN_MS: Record<SkillId, number> = {
  fireball: 1000,
  fireNova: 10000,
  fireField: 12000,
};

const SKILL_TOOLTIP_STATS: Record<SkillId, string[]> = {
  fireball: ['20 damage', 'Applies burning', 'Cooldown: 1s'],
  fireNova: ['12 projectiles around you', 'Applies burning', 'Cooldown: 10s'],
  fireField: ['3x3 burning ground', '10s duration', 'Cooldown: 12s'],
};

type ItemTintOverrides = Record<string, never>;
const MAX_ITEM_SOCKET_COUNT = 3;
const ITEM_TIER_STYLES = {
  1: {
    slotBackground: 'linear-gradient(180deg,rgba(92,92,92,0.34),rgba(38,38,38,0.52))',
    slotBorder: '#9d9d9d',
    textColor: '#d2d2d2',
    badgeBackground: 'rgba(78,78,78,0.9)',
  },
  2: {
    slotBackground: 'linear-gradient(180deg,rgba(67,121,210,0.3),rgba(19,44,94,0.56))',
    slotBorder: '#6da8ff',
    textColor: '#8cc4ff',
    badgeBackground: 'rgba(32,72,148,0.9)',
  },
  3: {
    slotBackground: 'linear-gradient(180deg,rgba(130,76,184,0.32),rgba(55,23,91,0.58))',
    slotBorder: '#bc8cff',
    textColor: '#d3a8ff',
    badgeBackground: 'rgba(88,40,132,0.9)',
  },
} as const;

function getEquipmentItemDefinition(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  const itemId = equipment[slot];
  if (!itemId) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[itemId as keyof typeof EQUIPMENT_ITEMS];
  return item?.type === 'equipment' ? item : null;
}

function getEquipmentSocketSlotIds(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  const item = getEquipmentItemDefinition(slot, equipment);
  return item ? getEquipmentGemSlotIds(slot, item.socketCount ?? 0) : [];
}

function getEquipmentSocketGemIds(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  return getEquipmentSocketSlotIds(slot, equipment).map((slotId) => equipment[slotId] ?? null);
}

function getSocketColors(gemIds: Array<string | null>, _itemTintOverrides: ItemTintOverrides) {
  return gemIds.map(() => null);
}

function getItemSocketGemIds(itemValue: string, equipment: EquipmentState, source?: DragSource) {
  if (source?.type === 'equipment') {
    const baseSlot = getBaseEquipmentSlot(source.slot);
    return baseSlot ? getEquipmentSocketGemIds(baseSlot, equipment) : [];
  }

  const parsed = parseInventoryItem(itemValue);
  return parsed?.socketedGemIds ?? [];
}

function getItemSocketColors(
  itemValue: string,
  equipment: EquipmentState,
  itemTintOverrides: ItemTintOverrides,
  source?: DragSource,
) {
  return getSocketColors(getItemSocketGemIds(itemValue, equipment, source), itemTintOverrides);
}

function serializeSocketedEquipmentItem(itemId: string, gemIds: Array<string | null>) {
  return serializeInventoryItem(itemId as EquipmentItemId, 1, gemIds);
}

function getItemTierStyle(itemId: string | null | undefined) {
  if (!itemId) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[itemId as keyof typeof EQUIPMENT_ITEMS];
  if (!item || item.type !== 'equipment' || !item.tier) {
    return null;
  }

  return ITEM_TIER_STYLES[item.tier];
}

function getSafeTooltipPosition(pointerX: number, pointerY: number, width: number, height: number) {
  if (typeof window === 'undefined') {
    return {
      left: pointerX + 16,
      top: pointerY + 16,
    };
  }

  const margin = 20;
  const horizontalOffset = 16;
  const verticalOffset = 16;
  const preferredRightLeft = pointerX + horizontalOffset;
  const preferredBottomTop = pointerY + verticalOffset;
  const preferredLeftLeft = pointerX - width - horizontalOffset;
  const preferredTopTop = pointerY - height - verticalOffset;
  const left =
    preferredRightLeft + width <= window.innerWidth - margin
      ? preferredRightLeft
      : preferredLeftLeft >= margin
        ? preferredLeftLeft
        : Math.min(
            Math.max(margin, preferredRightLeft),
            Math.max(margin, window.innerWidth - width - margin),
          );
  const top =
    preferredBottomTop + height <= window.innerHeight - margin
      ? preferredBottomTop
      : preferredTopTop >= margin
        ? preferredTopTop
        : Math.min(
            Math.max(margin, preferredBottomTop),
            Math.max(margin, window.innerHeight - height - margin),
          );

  return {
    left,
    top,
  };
}

function shouldIgnoreHudHotkey(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

function formatGoldValue(value: number) {
  return `${Math.max(0, Math.floor(value))}g`;
}

function getItemTooltipLines(itemId: string, itemBalanceConfig: ItemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG) {
  const item = EQUIPMENT_ITEMS[itemId as keyof typeof EQUIPMENT_ITEMS];
  if (!item) {
    return ['Unknown item'];
  }

  return [
    ...getResolvedItemTooltipStats(item.id, itemBalanceConfig),
    `Value: ${formatGoldValue(getResolvedItemValue(item.id, itemBalanceConfig))}`,
  ];
}

function HudTabIcon({ panel }: { panel: HudPanel }) {
  const src = panel === 'inventory' ? '/ui/panels/inventory-8bit.png' : '/ui/panels/equipment-8bit.png';
  const alt = panel === 'inventory' ? 'Inventory' : 'Character';

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="pixelated h-8 w-8 object-contain"
    />
  );
}

function SlotIcon({ slot }: { slot: EquipSlotId }) {
  const common =
    'h-7 w-7 text-[#e5f5cf] opacity-80 transition group-hover:opacity-100';

  switch (slot) {
    case 'head':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 9a5 5 0 1 1 10 0v2H7V9Z" />
          <path d="M9 11v3m6-3v3" />
          <path d="M8 17h8" />
        </svg>
      );
    case 'amulet':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 6c1.5 2 3 3 4 3s2.5-1 4-3" />
          <path d="M12 9v4" />
          <path d="M9.5 16 12 20l2.5-4L12 13l-2.5 3Z" />
        </svg>
      );
    case 'body':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5h6l2 3-2 2v8H9v-8L7 8l2-3Z" />
          <path d="M12 5v13" />
        </svg>
      );
    case 'weapon':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m7 17 7-7" />
          <path d="m13 6 2-2 5 5-2 2" />
          <path d="m5 19 2-2 2 2-2 2-2-2Z" />
        </svg>
      );
    case 'offhand':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4 6 7v5c0 4 2.6 6.8 6 8 3.4-1.2 6-4 6-8V7l-6-3Z" />
          <path d="M12 8v8" />
        </svg>
      );
    case 'ring-1':
    case 'ring-2':
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="14" r="4.5" />
          <path d="m9.5 7 2.5-3 2.5 3" />
        </svg>
      );
  }
}

function ItemTile({
  itemValue,
  faded = false,
  compact = false,
  cooldownEndsAt = 0,
  cooldownNow = 0,
  socketCount = 0,
  socketColors = [],
  itemTintOverrides = {},
}: {
  itemValue: string;
  faded?: boolean;
  compact?: boolean;
  cooldownEndsAt?: number;
  cooldownNow?: number;
  socketCount?: number;
  socketColors?: Array<string | null>;
  itemTintOverrides?: ItemTintOverrides;
}) {
  const parsed = parseInventoryItem(itemValue);
  if (!parsed) {
    return null;
  }

  const item = EQUIPMENT_ITEMS[parsed.itemId];
  const tierStyle = getItemTierStyle(parsed.itemId);
  const rotationDeg = item.iconRotationDeg ?? 0;
  const scale = compact ? (item.compactIconScale ?? item.iconScale ?? 1) : (item.iconScale ?? 1);
  const frameSizeClass = compact ? 'h-10 w-10' : 'h-12 w-12';
  const isConsumable = item.type === 'consumable' && parsed.itemId in CONSUMABLE_COOLDOWN_MS;
  const remainingMs =
    isConsumable ? Math.max(0, cooldownEndsAt - cooldownNow) : 0;
  const isCoolingDown = remainingMs > 0;
  const cooldownDuration =
    isConsumable ? (CONSUMABLE_COOLDOWN_MS[parsed.itemId as ConsumableItemId] ?? 0) : 0;
  const cooldownProgress =
    isConsumable && cooldownDuration > 0
      ? Math.max(
          0,
          Math.min(1, remainingMs / cooldownDuration),
        )
      : 0;

  return (
    <span className={`relative flex items-center justify-center overflow-hidden rounded-md ${frameSizeClass}`}>
      {tierStyle ? (
        <>
          <span
            className="absolute inset-0 rounded-md"
            style={{
              background: tierStyle.slotBackground,
              boxShadow: `inset 0 0 0 1px ${tierStyle.slotBorder}`,
            }}
          />
          <span
            className="absolute inset-[1px] rounded-[5px] border border-white/5"
            style={{ backgroundColor: 'rgba(10, 16, 10, 0.22)' }}
          />
        </>
      ) : null}
      <img
        src={item.texturePath}
        alt={item.name}
        draggable={false}
        className={`pixelated relative z-[1] h-full w-full object-contain ${faded ? 'opacity-25' : ''}`}
        style={{
          transform: `rotate(${rotationDeg}deg) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
      {parsed.quantity > 1 ? (
        <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded-sm bg-[#102008]/88 px-1 text-[10px] font-bold leading-none text-[#f4ffe8]">
          {parsed.quantity}
        </span>
      ) : null}
      {socketCount > 0 ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 flex gap-0.5">
          {Array.from({ length: socketCount }, (_, index) => (
            <span
              key={index}
              className="h-2.5 w-2.5 rounded-full border border-[#102008]/90 shadow-[0_0_0_1px_rgba(236,255,218,0.12)]"
              style={{
                backgroundColor: socketColors[index] ?? 'rgba(7,12,5,0.82)',
              }}
            />
          ))}
        </span>
      ) : null}
      {isCoolingDown ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 rounded-md"
            style={{
              background: `conic-gradient(from -90deg, rgba(12,18,8,0.12) 0deg, rgba(12,18,8,0.12) ${
                360 - cooldownProgress * 360
              }deg, rgba(8,12,6,0.72) ${360 - cooldownProgress * 360}deg, rgba(8,12,6,0.72) 360deg)`,
            }}
          />
          <span className="pointer-events-none absolute inset-[3px] rounded-md bg-[rgba(10,14,8,0.26)]" />
          <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded-sm bg-[#102008]/88 px-1 text-[10px] font-bold leading-none text-[#fff4cf]">
            {(remainingMs / 1000).toFixed(1)}
          </span>
        </>
      ) : null}
    </span>
  );
}

function moveInventoryItem(
  inventory: InventoryState,
  fromIndex: number,
  toIndex: number,
): InventoryState {
  const nextInventory = [...inventory];
  const targetItem = nextInventory[toIndex];
  nextInventory[toIndex] = nextInventory[fromIndex];
  nextInventory[fromIndex] = targetItem;
  return nextInventory;
}

function moveGridItem(
  slots: InventoryState,
  fromIndex: number,
  toIndex: number,
): InventoryState {
  const nextSlots = [...slots];
  const targetItem = nextSlots[toIndex];
  nextSlots[toIndex] = nextSlots[fromIndex];
  nextSlots[fromIndex] = targetItem;
  return nextSlots;
}

function findFirstEmptySlot(slots: InventoryState) {
  return slots.findIndex((itemId) => itemId === null);
}

function findFirstEmptySocketSlot(slot: BaseEquipmentSlot, equipment: EquipmentState) {
  return getEquipmentSocketSlotIds(slot, equipment).find((slotId) => !equipment[slotId]) ?? null;
}

function canSocketGemIntoSlot(itemId: GemItemId, slot: BaseEquipmentSlot, equipment: EquipmentState) {
  const equippedItem = getEquipmentItemDefinition(slot, equipment);
  if (!equippedItem) {
    return false;
  }

  const gemItem = EQUIPMENT_ITEMS[itemId];
  if (!gemItem || gemItem.type !== 'gem') {
    return false;
  }

  if (!equippedItem.socketCount || equippedItem.socketCount <= 0) {
    return false;
  }

  if (gemItem.gemType && equippedItem.socketType && gemItem.gemType !== equippedItem.socketType) {
    return false;
  }

  if (!gemItem.socketableInto?.includes(equippedItem.id as EquipmentItemId)) {
    return false;
  }

  return true;
}

function findFirstCompatibleEquipmentSlotForGem(itemId: GemItemId, equipment: EquipmentState) {
  const compatibleSlots = EQUIP_SLOTS
    .map(({ id }) => id)
    .filter((slot) => canSocketGemIntoSlot(itemId, slot, equipment));

  if (compatibleSlots.length === 0) {
    return null;
  }

  return compatibleSlots.find((slot) => findFirstEmptySocketSlot(slot, equipment)) ?? compatibleSlots[0];
}

function canSwapIntoEquipment(itemValue: string | null, slot: EquipmentSlot) {
  const itemId = getInventoryItemId(itemValue);
  if (!itemId) {
    return true;
  }

  const item = EQUIPMENT_ITEMS[itemId];
  return item.type === 'equipment' && item.slot === slot;
}

function getAvailableSkills(equipment: EquipmentState): SkillId[] {
  const availableSkills: SkillId[] = [];

  if (equipment.weapon === 'default_staff') {
    availableSkills.push('fireball');
  }

  return availableSkills;
}

function getDefaultActionBarBindings(equipment: EquipmentState): Partial<Record<ActionSlotKey, ActionBarBinding | null>> {
  const nextBindings: Partial<Record<ActionSlotKey, ActionBarBinding | null>> = {};

  if (equipment.weapon === 'default_staff') {
    nextBindings['1'] = { kind: 'skill', skillId: 'fireball' };
  }

  return nextBindings;
}

function parseStoredActionBarBindings(
  rawValue: string | null,
): Partial<Record<ActionSlotKey, ActionBarBinding | null>> | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<Record<ActionSlotKey, ActionBarBinding | null>>;
    const nextBindings: Partial<Record<ActionSlotKey, ActionBarBinding | null>> = {};

    ACTION_BAR_SLOTS.forEach(({ key }) => {
      const binding = parsed[key];
      if (!binding) {
        return;
      }

      if (
        binding.kind === 'skill' &&
        ['fireball', 'fireNova', 'fireField'].includes(binding.skillId)
      ) {
        nextBindings[key] = { kind: 'skill', skillId: binding.skillId as SkillId };
        return;
      }

      if (binding.kind === 'item') {
        const item = EQUIPMENT_ITEMS[binding.itemId as ConsumableItemId];
        if (item?.type === 'consumable') {
          nextBindings[key] = { kind: 'item', itemId: binding.itemId as ConsumableItemId };
        }
      }
    });

    return nextBindings;
  } catch {
    return null;
  }
}

export function GameHud({
  equipment,
  inventory,
  container,
  playerGold,
  playerStrength,
  playerAgility,
  playerIntellect,
  activeSkillTargeting,
  skillCooldowns,
  consumableCooldowns,
  onSkillTrigger,
  onEquipmentChange,
  onInventoryChange,
  onInventoryUse,
  onContainerChange,
  onCloseContainer,
  isQuestLogOpen = false,
  onToggleQuestLog,
  itemTintOverrides = {},
  itemBalanceConfig = DEFAULT_ITEM_BALANCE_CONFIG,
}: {
  equipment: EquipmentState;
  inventory: InventoryState;
  container: ContainerView | null;
  playerGold: number;
  playerStrength: number;
  playerAgility: number;
  playerIntellect: number;
  activeSkillTargeting: 'fireball' | 'fireField' | null;
  skillCooldowns: SkillCooldownState;
  consumableCooldowns: ConsumableCooldownState;
  onSkillTrigger: (skillId: SkillId) => void;
  onEquipmentChange: (equipment: EquipmentState) => void;
  onInventoryChange: (inventory: InventoryState) => void;
  onInventoryUse: (request: ConsumableUseRequest) => void;
  onContainerChange: (slots: InventoryState) => void;
  onCloseContainer: () => void;
  isQuestLogOpen?: boolean;
  onToggleQuestLog?: () => void;
  itemTintOverrides?: ItemTintOverrides;
  itemBalanceConfig?: ItemBalanceConfig;
}) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const actionBarDragHandledRef = useRef(false);
  const [hoveredItem, setHoveredItem] = useState<HoveredItemState | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<HoveredSkillState | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<ItemContextMenuState | null>(null);
  const [inspectItem, setInspectItem] = useState<InspectItemState | null>(null);
  const [skillsDrawerOpen, setSkillsDrawerOpen] = useState(false);
  const [actionBarBindings, setActionBarBindings] = useState<Partial<Record<ActionSlotKey, ActionBarBinding | null>>>(() => {
    if (typeof window === 'undefined') {
      return getDefaultActionBarBindings(equipment);
    }

    return parseStoredActionBarBindings(window.localStorage.getItem(ACTION_BAR_STORAGE_KEY))
      ?? getDefaultActionBarBindings(equipment);
  });
  const availableSkills = getAvailableSkills(equipment);
  const hoveredItemTooltipLineCount = hoveredItem
    ? (() => {
        const itemId = getInventoryItemId(hoveredItem.itemId);
        return itemId ? getItemTooltipLines(itemId, itemBalanceConfig).length : 1;
      })()
    : 0;
  const hoveredItemPosition = hoveredItem
    ? getSafeTooltipPosition(
        hoveredItem.pointerX,
        hoveredItem.pointerY,
        252,
        Math.min(320, 92 + hoveredItemTooltipLineCount * 22),
      )
    : null;
  const hoveredSkillPosition = hoveredSkill
    ? getSafeTooltipPosition(hoveredSkill.pointerX, hoveredSkill.pointerY, 252, 164)
    : null;
  const itemContextMenuPosition = itemContextMenu
    ? getSafeTooltipPosition(itemContextMenu.pointerX, itemContextMenu.pointerY, 216, 196)
    : null;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ACTION_BAR_STORAGE_KEY, JSON.stringify(actionBarBindings));
  }, [actionBarBindings]);

  useEffect(() => {
    setActionBarBindings((current) => {
      if (Object.keys(current).length > 0) {
        return current;
      }

      return getDefaultActionBarBindings(equipment);
    });
  }, [equipment]);

  const getActionBarBinding = (slotKey: ActionSlotKey) => actionBarBindings[slotKey] ?? null;

  const findActionBarInventorySlot = (itemId: ConsumableItemId) =>
    inventory.findIndex((itemValue) => getInventoryItemId(itemValue) === itemId);

  const getActionBarItemQuantity = (itemId: ConsumableItemId) =>
    inventory.reduce((total, itemValue) => {
      const parsed = parseInventoryItem(itemValue);
      if (!parsed || parsed.itemId !== itemId) {
        return total;
      }

      return total + parsed.quantity;
    }, 0);

  const setActionBarBinding = (slotKey: ActionSlotKey, binding: ActionBarBinding | null) => {
    setActionBarBindings((current) => ({
      ...current,
      [slotKey]: binding,
    }));
  };

  const assignSkillToFirstAvailableActionSlot = (skillId: SkillId) => {
    setActionBarBindings((current) => {
      const emptySlot = ACTION_BAR_SLOTS.find(({ key }) => !current[key]);
      const targetSlotKey = emptySlot?.key ?? ACTION_BAR_SLOTS[0].key;
      return {
        ...current,
        [targetSlotKey]: { kind: 'skill', skillId },
      };
    });
  };

  const triggerActionBarBinding = (binding: ActionBarBinding | null) => {
    if (!binding) {
      return;
    }

    if (binding.kind === 'skill') {
      if (!availableSkills.includes(binding.skillId)) {
        return;
      }

      const readyAt = skillCooldowns[binding.skillId] ?? 0;
      if (readyAt <= Date.now()) {
        onSkillTrigger(binding.skillId);
      }
      return;
    }

    const inventorySlot = findActionBarInventorySlot(binding.itemId);
    if (inventorySlot === -1) {
      return;
    }

    const cooldownDuration = CONSUMABLE_COOLDOWN_MS[binding.itemId] ?? 0;
    const cooldownEndsAt = consumableCooldowns[binding.itemId] ?? 0;
    if (cooldownDuration > 0 && cooldownEndsAt > Date.now()) {
      return;
    }

    onInventoryUse({ type: 'inventory', slotIndex: inventorySlot });
  };

  const getDraggedActionBarBinding = (currentDragState: DragState | null): ActionBarBinding | null => {
    if (!currentDragState || currentDragState.source.type !== 'action-bar') {
      return null;
    }

    if (currentDragState.skillId) {
      return {
        kind: 'skill',
        skillId: currentDragState.skillId,
      };
    }

    const draggedItemId = currentDragState.itemId ? getInventoryItemId(currentDragState.itemId) : null;
    if (draggedItemId && EQUIPMENT_ITEMS[draggedItemId].type === 'consumable') {
      return {
        kind: 'item',
        itemId: draggedItemId as ConsumableItemId,
      };
    }

    return null;
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      setDragState((current) =>
        current
          ? {
              ...current,
              pointerX: event.clientX,
              pointerY: event.clientY,
            }
          : null,
      );
    };

    const handleMouseUp = () => {
      if (dragState.source.type === 'action-bar' && !actionBarDragHandledRef.current) {
        setActionBarBinding(dragState.source.slotKey, null);
        setHoveredItem((current) => (current?.scope === 'action-bar' ? null : current));
        setHoveredSkill((current) => (current?.scope === 'action-bar' ? null : current));
      }

      actionBarDragHandledRef.current = false;
      window.setTimeout(() => {
        setDragState(null);
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  useEffect(() => {
    const handlePointerDown = () => {
      setItemContextMenu(null);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (shouldIgnoreHudHotkey(event.target)) {
        return;
      }

      if (event.code === 'KeyI') {
        event.preventDefault();
        setInventoryOpen((current) => !current);
        return;
      }

      if (event.code === 'Tab') {
        event.preventDefault();
        setEquipmentOpen((current) => !current);
        return;
      }

      const slotConfig = ACTION_BAR_SLOTS.find(({ code }) => code === event.code);
      if (!slotConfig) {
        return;
      }

      const binding = getActionBarBinding(slotConfig.key);
      if (!binding) {
        return;
      }

      if (binding.kind === 'skill') {
        if (!availableSkills.includes(binding.skillId)) {
          return;
        }
      }

      event.preventDefault();
      triggerActionBarBinding(binding);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionBarBindings, availableSkills, consumableCooldowns, inventory, onInventoryUse, onSkillTrigger, skillCooldowns]);

  useEffect(() => {
    if (container) {
      return;
    }

    setHoveredItem((current) => (current?.scope === 'container' ? null : current));
    setItemContextMenu((current) =>
      current?.source.type === 'container' ? null : current,
    );
    setInspectItem((current) =>
      current?.source.type === 'container' ? null : current,
    );
    setDragState((current) => {
      if (!current) {
        return current;
      }

      if (current.source.type === 'container') {
        return null;
      }

      if (
        current.source.type === 'inspect-socket' &&
        current.source.itemSource.type === 'container'
      ) {
        return null;
      }

      return current;
    });
  }, [container]);

  useEffect(() => {
    if (inventoryOpen) {
      return;
    }

    setHoveredItem((current) => (current?.scope === 'inventory' ? null : current));
  }, [inventoryOpen]);

  useEffect(() => {
    if (equipmentOpen) {
      return;
    }

    setHoveredItem((current) => (current?.scope === 'equipment' ? null : current));
  }, [equipmentOpen]);

  useEffect(() => {
    if (inspectItem) {
      return;
    }

    setHoveredItem((current) => (current?.scope === 'inspect' ? null : current));
  }, [inspectItem]);

  const setEquipmentSocketsInEquipment = (slot: BaseEquipmentSlot, nextGemIds: Array<string | null>) => {
    const nextEquipment = { ...equipment };
    getEquipmentGemSlotIds(slot, MAX_ITEM_SOCKET_COUNT).forEach((slotId, index) => {
      const gemId = nextGemIds[index] ?? null;
      if (gemId) {
        nextEquipment[slotId] = gemId as GemItemId;
      } else {
        delete nextEquipment[slotId];
      }
    });
    onEquipmentChange(nextEquipment);
  };

  const buildInventoryWithItemSockets = (
    sourceInventory: InventoryState,
    index: number,
    nextGemIds: Array<string | null>,
  ) => {
    const currentValue = sourceInventory[index];
    const itemId = getInventoryItemId(currentValue);
    if (!currentValue || !itemId) {
      return sourceInventory;
    }

    const nextInventory = [...sourceInventory];
    nextInventory[index] = serializeSocketedEquipmentItem(itemId, nextGemIds);
    return nextInventory;
  };

  const updateInventoryItemSockets = (index: number, nextGemIds: Array<string | null>) => {
    onInventoryChange(buildInventoryWithItemSockets(inventory, index, nextGemIds));
  };

  const buildContainerWithItemSockets = (
    sourceSlots: InventoryState,
    index: number,
    nextGemIds: Array<string | null>,
  ) => {
    const currentValue = sourceSlots[index] ?? null;
    const itemId = getInventoryItemId(currentValue);
    if (!currentValue || !itemId) {
      return sourceSlots;
    }

    const nextContainer = [...sourceSlots];
    nextContainer[index] = serializeSocketedEquipmentItem(itemId, nextGemIds);
    return nextContainer;
  };

  const updateContainerItemSockets = (index: number, nextGemIds: Array<string | null>) => {
    if (!container) {
      return;
    }

    onContainerChange(buildContainerWithItemSockets(container.slots, index, nextGemIds));
  };

  const socketGemIntoInspectItem = (socketIndex: number, gemValue: string, source: DragSource) => {
    const gemId = getInventoryItemId(gemValue);
    if (!inspectItem || !gemId) {
      return false;
    }

    const itemDefinition = EQUIPMENT_ITEMS[gemId];
    if (itemDefinition.type !== 'gem') {
      return false;
    }
    const typedGemId = gemId as GemItemId;

    const currentSocketGemIds = getItemSocketGemIds(inspectItem.itemValue, equipment, inspectItem.source);
    const nextSocketGemIds = Array.from({ length: Math.max(currentSocketGemIds.length, socketIndex + 1) }, (_, index) =>
      currentSocketGemIds[index] ?? null,
    );
    const replacedGemId = nextSocketGemIds[socketIndex] ?? null;
    nextSocketGemIds[socketIndex] = typedGemId;

    if (
      source.type === 'inspect-socket' &&
      isSameDragSource(source.itemSource, inspectItem.source)
    ) {
      if (source.socketIndex === socketIndex) {
        return true;
      }

      nextSocketGemIds[source.socketIndex] = replacedGemId;
    }

    if (inspectItem.source.type === 'equipment') {
      const baseSlot = getBaseEquipmentSlot(inspectItem.source.slot);
      if (!baseSlot) {
        return false;
      }

      setEquipmentSocketsInEquipment(baseSlot, nextSocketGemIds);
    } else if (inspectItem.source.type === 'inventory') {
      const nextInventory = buildInventoryWithItemSockets(inventory, inspectItem.source.index, nextSocketGemIds);
      if (source.type === 'inventory') {
        nextInventory[source.index] = replacedGemId;
      }
      onInventoryChange(nextInventory);
      setInspectItem((current) =>
        current
          ? { ...current, itemValue: serializeSocketedEquipmentItem(getInventoryItemId(current.itemValue) ?? gemId, nextSocketGemIds) }
          : current,
      );
    } else if (inspectItem.source.type === 'container') {
      const nextContainer = buildContainerWithItemSockets(container?.slots ?? [], inspectItem.source.index, nextSocketGemIds);
      if (source.type === 'container') {
        nextContainer[source.index] = replacedGemId;
      }
      onContainerChange(nextContainer);
      setInspectItem((current) =>
        current
          ? { ...current, itemValue: serializeSocketedEquipmentItem(getInventoryItemId(current.itemValue) ?? gemId, nextSocketGemIds) }
          : current,
      );
    } else {
      return false;
    }

    setHoveredItem((current) => (current?.scope === 'inspect' ? null : current));

    if (inspectItem.source.type !== 'inventory' && source.type === 'inventory') {
      const nextInventory = [...inventory];
      nextInventory[source.index] = replacedGemId;
      onInventoryChange(nextInventory);
    } else if (inspectItem.source.type !== 'container' && source.type === 'container' && container) {
      const nextContainer = [...container.slots];
      nextContainer[source.index] = replacedGemId;
      onContainerChange(nextContainer);
    }

    return true;
  };

  const removeGemFromInspectItem = (socketIndex: number) => {
    if (!inspectItem) {
      return false;
    }

    const currentSocketGemIds = getItemSocketGemIds(inspectItem.itemValue, equipment, inspectItem.source);
    const gemId = currentSocketGemIds[socketIndex] ?? null;
    if (!gemId) {
      return false;
    }

    const nextSocketGemIds = [...currentSocketGemIds];
    nextSocketGemIds[socketIndex] = null;

    if (inspectItem.source.type === 'equipment') {
      const emptyIndex = findFirstEmptySlot(inventory);
      if (emptyIndex === -1) {
        return false;
      }

      const baseSlot = getBaseEquipmentSlot(inspectItem.source.slot);
      if (!baseSlot) {
        return false;
      }

      setEquipmentSocketsInEquipment(baseSlot, nextSocketGemIds);
      const nextInventory = [...inventory];
      nextInventory[emptyIndex] = gemId;
      onInventoryChange(nextInventory);
    } else if (inspectItem.source.type === 'inventory') {
      const emptyIndex = findFirstEmptySlot(inventory);
      if (emptyIndex === -1) {
        return false;
      }

      const nextInventory = buildInventoryWithItemSockets(inventory, inspectItem.source.index, nextSocketGemIds);
      nextInventory[emptyIndex] = gemId;
      onInventoryChange(nextInventory);
      setInspectItem((current) =>
        current
          ? {
              ...current,
              itemValue: serializeSocketedEquipmentItem(getInventoryItemId(current.itemValue) ?? gemId, nextSocketGemIds),
            }
          : current,
      );
    } else if (inspectItem.source.type === 'container') {
      const emptyIndex = findFirstEmptySlot(inventory);
      if (emptyIndex === -1) {
        return false;
      }

      updateContainerItemSockets(inspectItem.source.index, nextSocketGemIds);
      const nextInventory = [...inventory];
      nextInventory[emptyIndex] = gemId;
      onInventoryChange(nextInventory);
      setInspectItem((current) =>
        current
          ? {
              ...current,
              itemValue: serializeSocketedEquipmentItem(getInventoryItemId(current.itemValue) ?? gemId, nextSocketGemIds),
            }
          : current,
      );
    } else {
      return false;
    }

    setHoveredItem((current) => (current?.scope === 'inspect' ? null : current));

    return true;
  };

  const buildRemoveGemFromItemSourceResult = (itemSource: DragSource, socketIndex: number) => {
    const sourceItemValue =
      itemSource.type === 'inventory'
        ? inventory[itemSource.index]
        : itemSource.type === 'container'
          ? (container?.slots[itemSource.index] ?? null)
          : itemSource.type === 'equipment'
            ? equipment[itemSource.slot]
            : null;

    if (!sourceItemValue) {
      return null;
    }

    const socketGemIds = getItemSocketGemIds(sourceItemValue, equipment, itemSource);
    const gemId = socketGemIds[socketIndex] ?? null;
    if (!gemId) {
      return null;
    }

    const nextSocketGemIds = [...socketGemIds];
    nextSocketGemIds[socketIndex] = null;

    if (itemSource.type === 'equipment') {
      const baseSlot = getBaseEquipmentSlot(itemSource.slot);
      if (!baseSlot) {
        return null;
      }

      const nextEquipment = { ...equipment };
      getEquipmentGemSlotIds(baseSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId, index) => {
        const nextGemId = nextSocketGemIds[index] ?? null;
        if (nextGemId) {
          nextEquipment[slotId] = nextGemId as GemItemId;
        } else {
          delete nextEquipment[slotId];
        }
      });

      return {
        gemValue: serializeInventoryItem(gemId),
        nextEquipment,
      };
    } else if (itemSource.type === 'inventory') {
      return {
        gemValue: serializeInventoryItem(gemId),
        nextInventory: buildInventoryWithItemSockets(inventory, itemSource.index, nextSocketGemIds),
        nextInspectItemValue: serializeSocketedEquipmentItem(getInventoryItemId(sourceItemValue) ?? gemId, nextSocketGemIds),
      };
    } else if (itemSource.type === 'container') {
      return {
        gemValue: serializeInventoryItem(gemId),
        nextContainer: buildContainerWithItemSockets(container?.slots ?? [], itemSource.index, nextSocketGemIds),
        nextInspectItemValue: serializeSocketedEquipmentItem(getInventoryItemId(sourceItemValue) ?? gemId, nextSocketGemIds),
      };
    } else {
      return null;
    }
  };

  const preventPrimaryDefault = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button === 0) {
      event.preventDefault();
    }
  };

  const showItemTooltip =
    (itemId: string, scope: HoveredItemState['scope']) => (event: ReactMouseEvent<HTMLElement>) => {
      setHoveredItem({
        itemId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        scope,
      });
    };

  const moveItemTooltip = (event: ReactMouseEvent<HTMLElement>) => {
    setHoveredItem((current) =>
      current
        ? {
            ...current,
            pointerX: event.clientX,
            pointerY: event.clientY,
          }
        : null,
    );
  };

  const hideItemTooltip = () => {
    setHoveredItem(null);
  };

  const showSkillTooltip =
    (skillId: SkillId, scope: HoveredSkillState['scope'] = 'skill-library') => (event: ReactMouseEvent<HTMLElement>) => {
      setHoveredSkill({
        skillId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        scope,
      });
    };

  const moveSkillTooltip = (event: ReactMouseEvent<HTMLElement>) => {
    setHoveredSkill((current) =>
      current
        ? {
            ...current,
            pointerX: event.clientX,
            pointerY: event.clientY,
          }
        : null,
    );
  };

  const hideSkillTooltip = () => {
    setHoveredSkill(null);
  };

  const syncActionBarTooltip = (
    binding: ActionBarBinding | null,
    pointerX: number,
    pointerY: number,
  ) => {
    setHoveredItem((current) => (current?.scope === 'action-bar' ? null : current));
    setHoveredSkill((current) => (current?.scope === 'action-bar' ? null : current));

    if (!binding) {
      return;
    }

    if (binding.kind === 'skill') {
      setHoveredSkill({
        skillId: binding.skillId,
        pointerX,
        pointerY,
        scope: 'action-bar',
      });
      return;
    }

    const itemQuantity = getActionBarItemQuantity(binding.itemId);
    setHoveredItem({
      itemId: serializeInventoryItem(binding.itemId, Math.max(1, itemQuantity)),
      pointerX,
      pointerY,
      scope: 'action-bar',
    });
  };

  const moveActionBarTooltip =
    (binding: ActionBarBinding | null) => (event: ReactMouseEvent<HTMLElement>) => {
      if (!binding) {
        setHoveredItem((current) => (current?.scope === 'action-bar' ? null : current));
        setHoveredSkill((current) => (current?.scope === 'action-bar' ? null : current));
        return;
      }

      syncActionBarTooltip(binding, event.clientX, event.clientY);
    };

  const togglePanel = (panel: HudPanel) => {
    if (panel === 'inventory') {
      setInventoryOpen((current) => !current);
      return;
    }

    setEquipmentOpen((current) => !current);
  };

  const openItemContextMenu =
    (itemValue: string, source: DragSource) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 2) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.ctrlKey) {
        handleEquipFromSource(source, itemValue);
        return;
      }

      setItemContextMenu({
        itemValue,
        source,
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const handleInspectItem = (itemValue: string, source: DragSource) => {
    setInspectItem({ itemValue, source });
    setItemContextMenu(null);
  };

  const handleDropItem = (source: DragSource) => {
    if (source.type === 'inventory') {
      const nextInventory = [...inventory];
      nextInventory[source.index] = null;
      onInventoryChange(nextInventory);
    } else if (source.type === 'container' && container) {
      const nextContainer = [...container.slots];
      nextContainer[source.index] = null;
      onContainerChange(nextContainer);
    } else if (source.type === 'equipment') {
      const nextEquipment = { ...equipment };
      delete nextEquipment[source.slot];
      getEquipmentGemSlotIds(source.slot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
      onEquipmentChange(nextEquipment);
    }

    setItemContextMenu(null);
    setDragState(null);
  };

  const handleEquipFromSource = (source: DragSource, itemValue: string) => {
    const itemId = getInventoryItemId(itemValue);
    if (!itemId) {
      setItemContextMenu(null);
      return;
    }

    const itemDefinition = EQUIPMENT_ITEMS[itemId];
    if (itemDefinition.type === 'consumable') {
      if (source.type === 'inventory') {
        onInventoryUse({ type: 'inventory', slotIndex: source.index });
      } else if (source.type === 'container' && container) {
        onInventoryUse({ type: 'container', containerId: container.id, slotIndex: source.index });
      }
      setItemContextMenu(null);
      return;
    }

    if (source.type === 'equipment') {
      setItemContextMenu(null);
      return;
    }

    if (itemDefinition.type === 'gem') {
      const targetEquipmentSlot = findFirstCompatibleEquipmentSlotForGem(itemDefinition.id as GemItemId, equipment);
      if (!targetEquipmentSlot) {
        setItemContextMenu(null);
        return;
      }

      const targetSlot =
        findFirstEmptySocketSlot(targetEquipmentSlot, equipment)
        ?? getEquipmentSocketSlotIds(targetEquipmentSlot, equipment)[0];
      const replacedItem = targetSlot ? (equipment[targetSlot] ?? null) : null;
      if (!targetSlot) {
        setItemContextMenu(null);
        return;
      }

      const nextEquipment: EquipmentState = {
        ...equipment,
        [targetSlot]: itemDefinition.id as GemItemId,
      };

      if (source.type === 'inventory') {
        const nextInventory = [...inventory];
        nextInventory[source.index] = replacedItem;
        onInventoryChange(nextInventory);
      } else if (source.type === 'container' && container) {
        const nextContainer = [...container.slots];
        nextContainer[source.index] = replacedItem;
        onContainerChange(nextContainer);
      }

      onEquipmentChange(nextEquipment);
      setItemContextMenu(null);
      return;
    }

    const targetSlot = itemDefinition.slot as BaseEquipmentSlot;
    const parsedItem = parseInventoryItem(itemValue);
    const replacedItem = equipment[targetSlot] ?? null;
    const nextEquipment: EquipmentState = {
      ...equipment,
      [targetSlot]: itemId as EquipmentItemId,
    };

    getEquipmentGemSlotIds(targetSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId, index) => {
      const gemId = parsedItem?.socketedGemIds[index] ?? null;
      if (gemId) {
        nextEquipment[slotId] = gemId;
      } else {
        delete nextEquipment[slotId];
      }
    });

    const replacedItemValue =
      replacedItem
        ? serializeSocketedEquipmentItem(replacedItem, getEquipmentSocketGemIds(targetSlot, equipment))
        : replacedItem;

    if (source.type === 'inventory') {
      const nextInventory = [...inventory];
      nextInventory[source.index] = replacedItemValue;
      onInventoryChange(nextInventory);
    } else if (source.type === 'container' && container) {
      const nextContainer = [...container.slots];
      nextContainer[source.index] = replacedItemValue;
      onContainerChange(nextContainer);
    }

    onEquipmentChange(nextEquipment);
    setItemContextMenu(null);
  };

  const quickTransferItem = (source: DragSource) => {
    if (
      !container ||
      source.type === 'equipment' ||
      source.type === 'inspect-socket' ||
      source.type === 'skill-library' ||
      source.type === 'action-bar'
    ) {
      return false;
    }

    if (source.type === 'inventory') {
      const itemValue = inventory[source.index];
      if (!itemValue) {
        return false;
      }

      const targetIndex = findFirstEmptySlot(container.slots);
      if (targetIndex === -1) {
        return false;
      }

      const nextInventory = [...inventory];
      const nextContainer = [...container.slots];
      nextContainer[targetIndex] = itemValue;
      nextInventory[source.index] = null;
      onContainerChange(nextContainer);
      onInventoryChange(nextInventory);
      return true;
    }

    const itemValue = container.slots[source.index];
    if (!itemValue) {
      return false;
    }

    const targetIndex = findFirstEmptySlot(inventory);
    if (targetIndex === -1) {
      return false;
    }

    const nextInventory = [...inventory];
    const nextContainer = [...container.slots];
    nextInventory[targetIndex] = itemValue;
    nextContainer[source.index] = null;
    onInventoryChange(nextInventory);
    onContainerChange(nextContainer);
    return true;
  };


  const startInventoryDrag =
    (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const itemId = inventory[index];
      if (!itemId || event.button !== 0) {
        return;
      }

      if (event.ctrlKey && quickTransferItem({ type: 'inventory', index })) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      setDragState({
        itemId,
        skillId: null,
        source: { type: 'inventory', index },
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const startEquipmentDrag =
    (slot: EquipmentSlot) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const itemId = equipment[slot];
      if (!itemId || event.button !== 0) {
        return;
      }

      event.preventDefault();
      setDragState({
        itemId,
        skillId: null,
        source: { type: 'equipment', slot },
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const startContainerDrag =
    (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const itemId = container?.slots[index];
      if (!itemId || event.button !== 0) {
        return;
      }

      if (event.ctrlKey && quickTransferItem({ type: 'container', index })) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      setDragState({
        itemId,
        skillId: null,
        source: { type: 'container', index },
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const startSkillLibraryDrag =
    (skillId: SkillId) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      setDragState({
        itemId: null,
        skillId,
        source: { type: 'skill-library', skillId },
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const startActionBarDrag =
    (slotKey: ActionSlotKey) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      const binding = getActionBarBinding(slotKey);
      if (!binding || event.button !== 0) {
        return;
      }

      event.preventDefault();
      actionBarDragHandledRef.current = false;
      setDragState({
        itemId: binding.kind === 'item' ? serializeInventoryItem(binding.itemId) : null,
        skillId: binding.kind === 'skill' ? binding.skillId : null,
        source: { type: 'action-bar', slotKey },
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const clearActionBarSlot = (slotKey: ActionSlotKey) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActionBarBinding(slotKey, null);
    syncActionBarTooltip(null, event.clientX, event.clientY);
  };

  const dropOnActionBar =
    (slotKey: ActionSlotKey) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!dragState) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (dragState.source.type === 'action-bar') {
        const sourceSlotKey = dragState.source.slotKey;
        if (sourceSlotKey === slotKey) {
          actionBarDragHandledRef.current = true;
          syncActionBarTooltip(getActionBarBinding(slotKey), event.clientX, event.clientY);
          setDragState(null);
          return;
        }

        const draggedBinding = getDraggedActionBarBinding(dragState);
        actionBarDragHandledRef.current = true;
        if (!draggedBinding) {
          setDragState(null);
          return;
        }

        setActionBarBindings((current) => ({
          ...current,
          [slotKey]: draggedBinding,
          [sourceSlotKey]: current[slotKey] ?? null,
        }));
        syncActionBarTooltip(draggedBinding, event.clientX, event.clientY);
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'skill-library' && dragState.skillId) {
        const nextBinding = { kind: 'skill', skillId: dragState.skillId } as const;
        setActionBarBinding(slotKey, nextBinding);
        syncActionBarTooltip(nextBinding, event.clientX, event.clientY);
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inventory' && dragState.itemId) {
        const draggedItemId = getInventoryItemId(dragState.itemId);
        if (draggedItemId && EQUIPMENT_ITEMS[draggedItemId].type === 'consumable') {
          const nextBinding = { kind: 'item', itemId: draggedItemId as ConsumableItemId } as const;
          setActionBarBinding(slotKey, nextBinding);
          syncActionBarTooltip(nextBinding, event.clientX, event.clientY);
        } else {
          syncActionBarTooltip(null, event.clientX, event.clientY);
        }
        setDragState(null);
        return;
      }

      syncActionBarTooltip(null, event.clientX, event.clientY);
      setDragState(null);
    };

  const dropOnInventory =
    (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!dragState) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (dragState.source.type === 'skill-library' || dragState.source.type === 'action-bar') {
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inventory') {
        const fromIndex = dragState.source.index;
        onInventoryChange(moveInventoryItem(inventory, fromIndex, index));
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inspect-socket') {
        if (inventory[index] !== null) {
          setDragState(null);
          return;
        }

        const result = buildRemoveGemFromItemSourceResult(
          dragState.source.itemSource,
          dragState.source.socketIndex,
        );
        if (!result) {
          setDragState(null);
          return;
        }

        if (result.nextEquipment) {
          onEquipmentChange(result.nextEquipment);
        }

        const nextInventory = result.nextInventory ? [...result.nextInventory] : [...inventory];
        nextInventory[index] = result.gemValue;
        onInventoryChange(nextInventory);
        if (result.nextContainer && container) {
          onContainerChange(result.nextContainer);
        }
        if (result.nextInspectItemValue) {
          setInspectItem((current) =>
            current ? { ...current, itemValue: result.nextInspectItemValue } : current,
          );
        }
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'container') {
        if (!container) {
          setDragState(null);
          return;
        }

        if (!dragState.itemId) {
          setDragState(null);
          return;
        }

        const fromIndex = dragState.source.index;
        const preferredIndex =
          inventory[index] === null ? index : findFirstEmptySlot(inventory);

        if (preferredIndex !== -1) {
          const nextInventory = [...inventory];
          const nextContainer = [...container.slots];

          nextInventory[preferredIndex] = dragState.itemId;
          nextContainer[fromIndex] = null;
          onInventoryChange(nextInventory);
          onContainerChange(nextContainer);
          setDragState(null);
          return;
        }

        const nextInventory = [...inventory];
        const nextContainer = [...container.slots];
        const targetItem = nextInventory[index];

        nextInventory[index] = dragState.itemId;
        nextContainer[fromIndex] = targetItem ?? null;
        onInventoryChange(nextInventory);
        onContainerChange(nextContainer);
        setDragState(null);
        return;
      }

      const sourceSlot = dragState.source.slot;
      if (!dragState.itemId) {
        setDragState(null);
        return;
      }
      const preferredIndex =
        inventory[index] === null ? index : findFirstEmptySlot(inventory);
      const sourceItemValue =
        serializeSocketedEquipmentItem(dragState.itemId, getEquipmentSocketGemIds(sourceSlot as BaseEquipmentSlot, equipment));

      if (preferredIndex !== -1) {
        const nextInventory = [...inventory];
        nextInventory[preferredIndex] = sourceItemValue;
        onInventoryChange(nextInventory);

        const nextEquipment = { ...equipment };
        delete nextEquipment[sourceSlot];
        getEquipmentGemSlotIds(sourceSlot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
        onEquipmentChange(nextEquipment);
        setDragState(null);
        return;
      }

      const targetItem = inventory[index];

      if (!canSwapIntoEquipment(targetItem, sourceSlot)) {
        setDragState(null);
        return;
      }

      const nextInventory = [...inventory];
      nextInventory[index] = sourceItemValue;
      onInventoryChange(nextInventory);

      if (targetItem) {
        onEquipmentChange({
          ...equipment,
          [sourceSlot]: targetItem,
        });
      } else {
        const nextEquipment = { ...equipment };
        delete nextEquipment[sourceSlot];
        getEquipmentGemSlotIds(sourceSlot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
        onEquipmentChange(nextEquipment);
      }

      setDragState(null);
    };

  const dropOnEquipment =
    (slot: EquipmentSlot) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!dragState) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (dragState.source.type === 'skill-library' || dragState.source.type === 'action-bar' || !dragState.itemId) {
        setDragState(null);
        return;
      }

      const dragItemId = getInventoryItemId(dragState.itemId);
      if (!dragItemId) {
        return;
      }

      const dragItem = EQUIPMENT_ITEMS[dragItemId];
      const isGemDropOnEquipment = dragItem.type === 'gem' && canSocketGemIntoSlot(dragItem.id as GemItemId, slot as BaseEquipmentSlot, equipment);
      const isRegularEquipmentDrop =
        dragItem.type === 'equipment' && dragItem.slot === slot;

      if (
        (dragItem.type !== 'equipment' && dragItem.type !== 'gem') ||
        (!isRegularEquipmentDrop && !isGemDropOnEquipment)
      ) {
        return;
      }

      if (isGemDropOnEquipment) {
        if (dragState.source.type === 'equipment') {
          setDragState(null);
          return;
        }

        const targetSocketSlot =
          findFirstEmptySocketSlot(slot as BaseEquipmentSlot, equipment)
          ?? getEquipmentSocketSlotIds(slot as BaseEquipmentSlot, equipment)[0];
        if (!targetSocketSlot) {
          setDragState(null);
          return;
        }

        const replacedItem = equipment[targetSocketSlot] ?? null;

        onEquipmentChange({
          ...equipment,
          [targetSocketSlot]: dragItem.id as GemItemId,
        });

        if (dragState.source.type === 'inventory') {
          const nextInventory = [...inventory];
          nextInventory[dragState.source.index] = replacedItem;
          onInventoryChange(nextInventory);
        }

        if (dragState.source.type === 'container' && container) {
          const nextContainer = [...container.slots];
          nextContainer[dragState.source.index] = replacedItem;
          onContainerChange(nextContainer);
        }

        setDragState(null);
        return;
      }

      if (dragState.source.type === 'equipment') {
        const sourceSlot = dragState.source.slot;
        if (sourceSlot === slot) {
          setDragState(null);
          return;
        }

        const targetItem = equipment[slot] ?? null;
        if (!canSwapIntoEquipment(targetItem, sourceSlot)) {
          setDragState(null);
          return;
        }

        const nextEquipment = { ...equipment };
        const sourceItem = nextEquipment[sourceSlot];
        const currentTargetItem = nextEquipment[slot];

        if (sourceItem) {
          nextEquipment[slot] = sourceItem;
        }

        if (currentTargetItem) {
          nextEquipment[sourceSlot] = currentTargetItem;
        } else {
          delete nextEquipment[sourceSlot];
        }

        onEquipmentChange(nextEquipment);
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inspect-socket') {
        setDragState(null);
        return;
      }

      const fromIndex = dragState.source.index;
      if (!dragState.itemId) {
        setDragState(null);
        return;
      }
      const targetItem = equipment[slot];
      const parsedDraggedItem = parseInventoryItem(dragState.itemId);
      const targetItemValue =
        targetItem
          ? serializeSocketedEquipmentItem(targetItem, getEquipmentSocketGemIds(slot as BaseEquipmentSlot, equipment))
          : targetItem ?? null;

      const nextEquipment: EquipmentState = {
        ...equipment,
        [slot]: dragItemId,
      };
      getEquipmentGemSlotIds(slot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId, index) => {
        const gemId = parsedDraggedItem?.socketedGemIds[index] ?? null;
        if (gemId) {
          nextEquipment[slotId] = gemId;
        } else {
          delete nextEquipment[slotId];
        }
      });

      onEquipmentChange(nextEquipment);

      if (dragState.source.type === 'inventory') {
        const nextInventory = [...inventory];
        nextInventory[fromIndex] = targetItemValue;
        onInventoryChange(nextInventory);
      }

      if (dragState.source.type === 'container' && container) {
        const nextContainer = [...container.slots];
        nextContainer[fromIndex] = targetItemValue;
        onContainerChange(nextContainer);
      }

      setDragState(null);
    };

  const dropOnContainer =
    (index: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!dragState || !container) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (dragState.source.type === 'skill-library' || dragState.source.type === 'action-bar') {
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'container') {
        const fromIndex = dragState.source.index;
        onContainerChange(moveGridItem(container.slots, fromIndex, index));
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inventory') {
        const fromIndex = dragState.source.index;
        if (!dragState.itemId) {
          setDragState(null);
          return;
        }
        const nextContainer = [...container.slots];
        const targetItem = nextContainer[index];

        nextContainer[index] = dragState.itemId;
        onContainerChange(nextContainer);

        const nextInventory = [...inventory];
        nextInventory[fromIndex] = targetItem ?? null;
        onInventoryChange(nextInventory);
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inspect-socket') {
        if (container.slots[index] !== null) {
          setDragState(null);
          return;
        }

        const result = buildRemoveGemFromItemSourceResult(
          dragState.source.itemSource,
          dragState.source.socketIndex,
        );
        if (!result) {
          setDragState(null);
          return;
        }

        if (result.nextEquipment) {
          onEquipmentChange(result.nextEquipment);
        }

        const nextContainer = result.nextContainer ? [...result.nextContainer] : [...container.slots];
        nextContainer[index] = result.gemValue;
        onContainerChange(nextContainer);
        if (result.nextInventory) {
          onInventoryChange(result.nextInventory);
        }
        if (result.nextInspectItemValue) {
          setInspectItem((current) =>
            current ? { ...current, itemValue: result.nextInspectItemValue } : current,
          );
        }
        setDragState(null);
        return;
      }

      setDragState(null);
    };

  const dropIntoBackpackZone = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragState || dragState.source.type === 'inventory') {
      return;
    }

    event.preventDefault();

    if (dragState.source.type === 'skill-library' || dragState.source.type === 'action-bar') {
      setDragState(null);
      return;
    }

    const emptyIndex = findFirstEmptySlot(inventory);
    if (emptyIndex === -1) {
      setDragState(null);
      return;
    }

    if (!dragState.itemId) {
      setDragState(null);
      return;
    }

    const nextInventory = [...inventory];

    if (dragState.source.type === 'inspect-socket') {
      const result = buildRemoveGemFromItemSourceResult(
        dragState.source.itemSource,
        dragState.source.socketIndex,
      );
      if (!result) {
        setDragState(null);
        return;
      }

      if (result.nextEquipment) {
        onEquipmentChange(result.nextEquipment);
      }
      const nextInventory = result.nextInventory ? [...result.nextInventory] : [...inventory];
      nextInventory[emptyIndex] = result.gemValue;
      onInventoryChange(nextInventory);
      if (result.nextContainer && container) {
        onContainerChange(result.nextContainer);
      }
      if (result.nextInspectItemValue) {
        setInspectItem((current) =>
          current ? { ...current, itemValue: result.nextInspectItemValue } : current,
        );
      }
      setDragState(null);
      return;
    }

    nextInventory[emptyIndex] =
      dragState.source.type === 'equipment'
        ? serializeSocketedEquipmentItem(dragState.itemId, getEquipmentSocketGemIds(dragState.source.slot as BaseEquipmentSlot, equipment))
        : dragState.itemId;
    onInventoryChange(nextInventory);

    if (dragState.source.type === 'equipment') {
      const nextEquipment = { ...equipment };
      delete nextEquipment[dragState.source.slot];
      getEquipmentGemSlotIds(dragState.source.slot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
      onEquipmentChange(nextEquipment);
    }

    if (dragState.source.type === 'container' && container) {
      const nextContainer = [...container.slots];
      nextContainer[dragState.source.index] = null;
      onContainerChange(nextContainer);
    }

    setDragState(null);
  };

  return (
    <>
      <section className="pointer-events-auto fixed right-5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 select-none">
        <div className="rounded-2xl border border-[#d9efbd]/35 bg-[#17320d]/82 px-3 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">Gold</div>
          <div className="mt-1 font-serif text-lg font-bold text-[#ffe29c]">{formatGoldValue(playerGold)}</div>
        </div>
        <button
          type="button"
          onMouseDown={preventPrimaryDefault}
          onClick={() => togglePanel('inventory')}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition ${
            inventoryOpen
              ? 'border-[#d8f1b4]/55 bg-[linear-gradient(180deg,rgba(87,131,56,0.82),rgba(35,60,19,0.88))] text-[#f4ffe8]'
              : 'border-[#d9efbd]/35 bg-[#17320d]/82 text-[#bfd8a4] hover:bg-[#234514]/90'
          }`}
          title="Inventory"
        >
          <HudTabIcon panel="inventory" />
        </button>

        <button
          type="button"
          onMouseDown={preventPrimaryDefault}
          onClick={() => togglePanel('equipment')}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition ${
            equipmentOpen
              ? 'border-[#d8f1b4]/55 bg-[linear-gradient(180deg,rgba(87,131,56,0.82),rgba(35,60,19,0.88))] text-[#f4ffe8]'
              : 'border-[#d9efbd]/35 bg-[#17320d]/82 text-[#bfd8a4] hover:bg-[#234514]/90'
          }`}
          title="Character"
        >
          <HudTabIcon panel="equipment" />
        </button>

        {onToggleQuestLog ? (
          <button
            type="button"
            onMouseDown={preventPrimaryDefault}
            onClick={onToggleQuestLog}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition ${
              isQuestLogOpen
                ? 'border-[#d8f1b4]/55 bg-[linear-gradient(180deg,rgba(87,131,56,0.82),rgba(35,60,19,0.88))] text-[#f4ffe8]'
                : 'border-[#d9efbd]/35 bg-[#17320d]/82 text-[#bfd8a4] hover:bg-[#234514]/90'
            }`}
            title="Quests"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Q</span>
          </button>
        ) : null}
      </section>

      {inventoryOpen ? (
        <HudWindow
          title="Backpack"
          storageKey={INVENTORY_POSITION_STORAGE_KEY}
          defaultPosition={{ left: 620, top: 120 }}
          onClose={() => setInventoryOpen(false)}
          className={`z-20 w-max ${HUD_WINDOW_GREEN_CLASS}`}
        >
          <div className={HUD_SECTION_CLASS} onMouseUp={dropIntoBackpackZone}>
            <div
              className="grid content-start justify-center gap-2"
              style={{
                gridTemplateColumns: `repeat(6, ${INVENTORY_SLOT_SIZE}px)`,
              }}
            >
              {inventory.map((itemId, index) => {
                const isDraggingThisItem =
                  dragState?.source.type === 'inventory' &&
                  dragState.source.index === index;

                return (
                  <button
                    key={index}
                    type="button"
                    onMouseDown={itemId ? startInventoryDrag(index) : preventPrimaryDefault}
                    onMouseEnter={itemId ? showItemTooltip(itemId, 'inventory') : undefined}
                    onMouseMove={itemId ? moveItemTooltip : undefined}
                      onMouseLeave={itemId ? hideItemTooltip : undefined}
                    onContextMenu={itemId ? openItemContextMenu(itemId, { type: 'inventory', index }) : undefined}
                      onMouseUp={dropOnInventory(index)}
                      className={HUD_GRID_SLOT_CLASS}
                    >
                    {itemId ? (
                      <ItemTile
                        itemValue={itemId}
                        compact
                        faded={Boolean(isDraggingThisItem)}
                        itemTintOverrides={itemTintOverrides}
                        cooldownEndsAt={consumableCooldowns[getInventoryItemId(itemId) as keyof ConsumableCooldownState] ?? 0}
                        cooldownNow={cooldownNow}
                        socketCount={(() => {
                          const parsed = parseInventoryItem(itemId);
                          return parsed ? (EQUIPMENT_ITEMS[parsed.itemId].socketCount ?? 0) : 0;
                        })()}
                        socketColors={getItemSocketColors(itemId, equipment, itemTintOverrides)}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </HudWindow>
      ) : null}

      {equipmentOpen ? (
        <HudWindow
          title="Character"
          storageKey={EQUIPMENT_POSITION_STORAGE_KEY}
          defaultPosition={{ left: 860, top: 120 }}
          onClose={() => setEquipmentOpen(false)}
          className={`z-20 w-max ${HUD_WINDOW_GREEN_CLASS}`}
        >
          <div className="flex items-start gap-4">
            <div className={`${HUD_SECTION_CLASS} order-1 w-[170px] shrink-0`}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">
                Stats
              </div>
              <div className="grid min-w-[170px] gap-2">
                {[
                  { label: 'GLD', value: formatGoldValue(playerGold) },
                  { label: 'STR', value: playerStrength },
                  { label: 'AGI', value: playerAgility },
                  { label: 'INT', value: playerIntellect },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between rounded-xl border border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.56),rgba(28,48,16,0.68))] px-3 py-2"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">
                      {stat.label}
                    </div>
                    <div className="font-serif text-lg font-bold text-[#f4ffe8]">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${HUD_SECTION_CLASS} order-2 shrink-0`}>
              <div className="grid grid-cols-2 gap-1">
                {EQUIP_SLOTS.map((slot) => {
                  const equippedId = equipment[slot.id];
                  const isDraggingThisItem =
                    dragState?.source.type === 'equipment' &&
                    dragState.source.slot === slot.id;
                  const dragItemId = dragState ? getInventoryItemId(dragState.itemId) : null;
                  const dragItem = dragItemId ? EQUIPMENT_ITEMS[dragItemId] : null;
                  const canSocketDraggedGem =
                    dragItem?.type === 'gem' &&
                    canSocketGemIntoSlot(dragItem.id as GemItemId, slot.id, equipment);
                  const equippedTierStyle = getItemTierStyle(equippedId);
                  const dropAllowed =
                    dragItem !== null &&
                    (canSocketDraggedGem ||
                      (dragItem.type === 'equipment' && dragItem.slot === slot.id));

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onMouseDown={equippedId ? startEquipmentDrag(slot.id) : preventPrimaryDefault}
                      onMouseEnter={equippedId ? showItemTooltip(equippedId, 'equipment') : undefined}
                      onMouseMove={equippedId ? moveItemTooltip : undefined}
                      onMouseLeave={equippedId ? hideItemTooltip : undefined}
                      onContextMenu={equippedId ? openItemContextMenu(equippedId, { type: 'equipment', slot: slot.id }) : undefined}
                      onMouseUp={dropOnEquipment(slot.id)}
                      className={`group rounded-lg border p-1 text-left shadow-[inset_0_1px_0_rgba(232,255,211,0.06)] transition ${
                        dropAllowed
                          ? 'border-[#d8f1b4]/55 bg-[linear-gradient(180deg,rgba(87,131,56,0.7),rgba(35,60,19,0.78))]'
                          : 'border-[#8fb466]/25 bg-[linear-gradient(180deg,rgba(60,94,38,0.56),rgba(28,48,16,0.68))]'
                      }`}
                    >
                      <div className="flex h-12 items-center justify-center rounded-md border border-dashed border-[#d5edbb]/18 bg-[#14240d]/55">
                        {equippedId ? (
                          <ItemTile
                            itemValue={equippedId}
                            compact
                            faded={Boolean(isDraggingThisItem)}
                            itemTintOverrides={itemTintOverrides}
                            socketCount={EQUIPMENT_ITEMS[equippedId].socketCount ?? 0}
                            socketColors={getSocketColors(getEquipmentSocketGemIds(slot.id, equipment), itemTintOverrides)}
                          />
                        ) : (
                          <SlotIcon slot={slot.id} />
                        )}
                      </div>
                      <div
                        className="mt-1 text-center text-[8px] font-medium uppercase tracking-[0.08em]"
                        style={{ color: equippedTierStyle?.textColor ?? '#bfd8a4' }}
                      >
                        {slot.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </HudWindow>
      ) : null}

      {container ? (
        <HudWindow
          title={container.title}
          subtitle={container.subtitle}
          storageKey={CONTAINER_POSITION_STORAGE_KEY}
          defaultPosition={{ left: 20, top: 120 }}
          onClose={onCloseContainer}
          className={`z-30 w-max ${HUD_WINDOW_BROWN_CLASS}`}
        >
          <div className={HUD_SECTION_CLASS}>
            <div
              className="grid content-start justify-center gap-2"
              style={{
                gridTemplateColumns: `repeat(${container.columns}, ${CONTAINER_SLOT_SIZE}px)`,
              }}
            >
              {container.slots.map((itemId, index) => {
                const isDraggingThisItem =
                  dragState?.source.type === 'container' &&
                  dragState.source.index === index;
                const containerItemId = itemId ? parseInventoryItem(itemId)?.itemId ?? null : null;

                return (
                  <button
                    key={`${container.id}-${index}`}
                    type="button"
                    data-container-id={container.id}
                    data-slot-index={index}
                    data-item-id={containerItemId ?? undefined}
                    onMouseDown={itemId ? startContainerDrag(index) : preventPrimaryDefault}
                    onMouseEnter={itemId ? showItemTooltip(itemId, 'container') : undefined}
                    onMouseMove={itemId ? moveItemTooltip : undefined}
                    onMouseLeave={itemId ? hideItemTooltip : undefined}
                    onContextMenu={itemId ? openItemContextMenu(itemId, { type: 'container', index }) : undefined}
                    onMouseUp={dropOnContainer(index)}
                    className={HUD_CONTAINER_SLOT_CLASS}
                  >
                    {itemId ? (
                      <ItemTile
                        itemValue={itemId}
                        compact
                        faded={Boolean(isDraggingThisItem)}
                        itemTintOverrides={itemTintOverrides}
                        socketCount={(() => {
                          const parsed = parseInventoryItem(itemId);
                          return parsed ? (EQUIPMENT_ITEMS[parsed.itemId].socketCount ?? 0) : 0;
                        })()}
                        socketColors={getItemSocketColors(itemId, equipment, itemTintOverrides)}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </HudWindow>
      ) : null}

      {dragState ? (
        <div
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragState.pointerX, top: dragState.pointerY }}
        >
          <div className="rounded-xl border border-[#d8f1b4]/55 bg-[#17320d]/88 p-2 shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
            {dragState.itemId ? (
              <ItemTile itemValue={dragState.itemId} itemTintOverrides={itemTintOverrides} />
            ) : dragState.skillId ? (
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[#f1b26a]/28 bg-[linear-gradient(180deg,rgba(95,41,18,0.82),rgba(46,20,10,0.88))]">
                {SKILL_ICONS[dragState.skillId] ? (
                  <img
                    src={SKILL_ICONS[dragState.skillId]!.src}
                    alt={SKILL_ICONS[dragState.skillId]!.alt}
                    draggable={false}
                    className="pixelated h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-sm font-bold text-[#ffe7b8]">*</span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {itemContextMenu ? (
        <div
          className="fixed z-50 w-[200px] rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/94 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md"
          style={{
            left: itemContextMenuPosition?.left ?? itemContextMenu.pointerX + 16,
            top: itemContextMenuPosition?.top ?? itemContextMenu.pointerY + 16,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleEquipFromSource(itemContextMenu.source, itemContextMenu.itemValue)}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#f4ffe8] transition hover:bg-[#294816]/72"
          >
            {(() => {
              const itemId = getInventoryItemId(itemContextMenu.itemValue);
              return itemId && EQUIPMENT_ITEMS[itemId].type === 'consumable' ? 'Use' : 'Equip';
            })()}
          </button>
          <button
            type="button"
            onClick={() => handleInspectItem(itemContextMenu.itemValue, itemContextMenu.source)}
            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-[#f4ffe8] transition hover:bg-[#294816]/72"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={() => handleDropItem(itemContextMenu.source)}
            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-[#ffd7c9] transition hover:bg-[#5a2318]/72"
          >
            Drop
          </button>
        </div>
      ) : null}

      {inspectItem ? (
        <HudWindow
          title="Inspect"
          defaultPosition={{ left: 480, top: 180 }}
          storageKey="mmorpg.ui.inspect.position.v1"
          onClose={() => {
            setInspectItem(null);
            setHoveredItem((current) => (current?.scope === 'inspect' ? null : current));
          }}
          className={`z-40 w-[280px] ${HUD_WINDOW_GREEN_CLASS}`}
        >
          {(() => {
            const parsed = parseInventoryItem(inspectItem.itemValue);
            if (!parsed) {
              return null;
            }

            const item = EQUIPMENT_ITEMS[parsed.itemId];
            const socketCount = item.socketCount ?? 0;
            const socketGemIds = getItemSocketGemIds(inspectItem.itemValue, equipment, inspectItem.source);
            const socketColors = getItemSocketColors(
              inspectItem.itemValue,
              equipment,
              itemTintOverrides,
              inspectItem.source,
            );

            return (
              <div className="space-y-4">
                <div className={HUD_SECTION_CLASS}>
                  <div
                    className="flex items-center gap-3"
                    onMouseEnter={showItemTooltip(inspectItem.itemValue, 'inspect')}
                    onMouseMove={moveItemTooltip}
                    onMouseLeave={hideItemTooltip}
                  >
                    <ItemTile
                      itemValue={inspectItem.itemValue}
                      socketCount={socketCount}
                      socketColors={socketColors}
                      itemTintOverrides={itemTintOverrides}
                    />
                    <div>
                      <div
                        className="font-serif text-lg font-bold"
                        style={{ color: getItemTierStyle(item.id)?.textColor ?? '#f6ffea' }}
                      >
                        {item.name}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#bfd8a4]">
                        {item.slot ?? item.type}
                      </div>
                    </div>
                  </div>
          <div className="mt-3 space-y-1 text-sm leading-5 text-[#dceec9]">
            {getItemTooltipLines(parsed.itemId, itemBalanceConfig).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
                </div>

                {socketCount > 0 ? (
                  <div className={HUD_SECTION_CLASS}>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">
                      Gem Slots
                    </div>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: socketCount }, (_, index) => {
                        const socketGemId = socketGemIds[index] ?? null;
                        const socketGemValue = socketGemId ? serializeInventoryItem(socketGemId) : null;

                        return (
                        <button
                          key={index}
                          type="button"
                          onMouseEnter={socketGemValue ? showItemTooltip(socketGemValue, 'inspect') : undefined}
                          onMouseMove={socketGemValue ? moveItemTooltip : undefined}
                          onMouseLeave={socketGemValue ? hideItemTooltip : undefined}
                          onMouseDown={(event) => {
                            if (!socketGemValue || event.button !== 0) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            setDragState({
                              itemId: socketGemValue,
                              skillId: null,
                              source: {
                                type: 'inspect-socket',
                                itemSource: inspectItem.source,
                                socketIndex: index,
                              },
                              pointerX: event.clientX,
                              pointerY: event.clientY,
                            });
                          }}
                          onMouseUp={(event) => {
                            if (dragState?.source.type === 'equipment') {
                              return;
                            }

                            if (!dragState) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            if (dragState.itemId && socketGemIntoInspectItem(index, dragState.itemId, dragState.source)) {
                              setDragState(null);
                            }
                          }}
                          onClick={() => {
                            removeGemFromInspectItem(index);
                          }}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d9efbd]/20 bg-[#102008]/72 transition hover:border-[#d8f1b4]/45"
                        >
                          {socketGemValue ? (
                            <ItemTile
                              itemValue={socketGemValue}
                              compact
                              itemTintOverrides={itemTintOverrides}
                            />
                          ) : (
                            <span
                              className="h-4 w-4 rounded-full border border-[#102008]/90"
                              style={{
                                backgroundColor: socketColors[index] ?? 'rgba(7,12,5,0.82)',
                              }}
                            />
                          )}
                        </button>
                      )})}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#9fbc7f]">
                      Drop gem on socket to insert. Click filled socket to remove.
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </HudWindow>
      ) : null}

      {hoveredItem ? (
        <div
          className="pointer-events-none fixed z-50 max-h-[calc(100vh-40px)] max-w-[220px] overflow-y-auto rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/94 px-4 py-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md"
          style={{
            left: hoveredItemPosition?.left ?? hoveredItem.pointerX + 16,
            top: hoveredItemPosition?.top ?? hoveredItem.pointerY + 16,
          }}
        >
          <div
            className="font-serif text-lg font-bold"
            style={{
              color: (() => {
                const itemId = getInventoryItemId(hoveredItem.itemId);
                return getItemTierStyle(itemId)?.textColor ?? '#f6ffea';
              })(),
            }}
          >
            {(() => {
              const itemId = getInventoryItemId(hoveredItem.itemId);
              return itemId ? EQUIPMENT_ITEMS[itemId].name : 'Unknown Item';
            })()}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#bfd8a4]">
            {(() => {
              const itemId = getInventoryItemId(hoveredItem.itemId);
              return itemId ? (EQUIPMENT_ITEMS[itemId].slot ?? EQUIPMENT_ITEMS[itemId].type) : 'item';
            })()}
          </div>
          <div className="mt-2 space-y-1 text-sm leading-5 text-[#dceec9]">
            {(() => {
              const itemId = getInventoryItemId(hoveredItem.itemId);
              return (itemId ? getItemTooltipLines(itemId, itemBalanceConfig) : ['Unknown item']).map((line) => (
                <div key={line}>{line}</div>
              ));
            })()}
          </div>
        </div>
      ) : null}

      {hoveredSkill ? (
        <div
          className="pointer-events-none fixed z-50 max-h-[calc(100vh-40px)] max-w-[220px] overflow-y-auto rounded-2xl border border-[#f4b36b]/30 bg-[#2b140b]/94 px-4 py-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md"
          style={{
            left: hoveredSkillPosition?.left ?? hoveredSkill.pointerX + 16,
            top: hoveredSkillPosition?.top ?? hoveredSkill.pointerY + 16,
          }}
        >
          <div className="font-serif text-lg font-bold text-[#fff1d3]">
            {hoveredSkill.skillId === 'fireball'
              ? 'Fireball'
              : hoveredSkill.skillId === 'fireNova'
                ? 'Fire Nova'
                : 'Fire Field'}
          </div>
          <div className="mt-2 space-y-1 text-sm leading-5 text-[#ffe0bc]">
            {SKILL_TOOLTIP_STATS[hoveredSkill.skillId].map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      ) : null}

      <section className="pointer-events-auto fixed bottom-5 left-1/2 z-20 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onMouseDown={preventPrimaryDefault}
            onClick={() => setSkillsDrawerOpen((current) => !current)}
            className="rounded-2xl border border-[#d9efbd]/24 bg-[#17320d]/76 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#dff4c6] shadow-[0_16px_32px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-[#224515]/88"
            title="Toggle skills drawer"
          >
            {skillsDrawerOpen ? '▼ Skills' : '▲ Skills'}
          </button>

          {skillsDrawerOpen ? (
            <div className="flex items-center gap-2 rounded-[1.25rem] border border-[#d9efbd]/24 bg-[#17320d]/76 px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-md">
              {availableSkills.length > 0 ? availableSkills.map((skillId) => {
                const skillIcon = SKILL_ICONS[skillId];
                return (
                  <button
                    key={skillId}
                    type="button"
                    onMouseDown={startSkillLibraryDrag(skillId)}
                    onMouseEnter={showSkillTooltip(skillId)}
                    onMouseMove={moveSkillTooltip}
                    onMouseLeave={hideSkillTooltip}
                    onClick={() => assignSkillToFirstAvailableActionSlot(skillId)}
                    className={`${SKILL_BAR_SLOT_CLASS} border-[#f4b36b]/40 bg-[linear-gradient(180deg,rgba(89,49,20,0.92),rgba(39,21,10,0.96))]`}
                  >
                    <div className="absolute left-1.5 top-1.5 z-10 rounded-md border border-[#d9efbd]/24 bg-[#102008]/72 px-1.5 py-[2px] text-[9px] font-bold leading-none text-[#f4ffe8]">
                      Drag
                    </div>
                    <div className="relative h-full w-full overflow-hidden rounded-[1rem] border border-[#f1b26a]/28 bg-[linear-gradient(180deg,rgba(95,41,18,0.82),rgba(46,20,10,0.88))] text-[#ffe7b8] shadow-[inset_0_1px_0_rgba(255,236,195,0.08)]">
                      {skillIcon ? (
                        <img
                          src={skillIcon.src}
                          alt={skillIcon.alt}
                          draggable={false}
                          className="pixelated h-full w-full object-contain"
                        />
                      ) : null}
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-xl border border-[#d9efbd]/16 bg-[#102008]/50 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-[#bfd8a4]/70">
                  No skills available
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-[1.75rem] border border-[#d9efbd]/24 bg-[#17320d]/76 px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-md">
            {ACTION_BAR_SLOTS.map(({ key }) => {
              const binding = getActionBarBinding(key);
              const isSkillBinding = binding?.kind === 'skill';
              const isItemBinding = binding?.kind === 'item';
              const skillId = isSkillBinding ? binding.skillId : null;
              const itemId = isItemBinding ? binding.itemId : null;
              const skillIcon = skillId ? SKILL_ICONS[skillId] : null;
              const itemQuantity = itemId ? getActionBarItemQuantity(itemId) : 0;
              const readyAt =
                skillId
                  ? (skillCooldowns[skillId] ?? 0)
                  : itemId
                    ? (consumableCooldowns[itemId] ?? 0)
                    : 0;
              const cooldownDuration =
                skillId
                  ? SKILL_COOLDOWN_MS[skillId]
                  : itemId
                    ? (CONSUMABLE_COOLDOWN_MS[itemId] ?? 0)
                    : 0;
              const remainingMs = Math.max(0, readyAt - cooldownNow);
              const isCoolingDown = cooldownDuration > 0 && remainingMs > 0;
              const cooldownProgress =
                cooldownDuration > 0
                  ? Math.max(0, Math.min(1, remainingMs / cooldownDuration))
                  : 0;
              const isBindingAvailable =
                skillId
                  ? availableSkills.includes(skillId)
                  : itemId
                    ? itemQuantity > 0
                    : false;

              return (
                <button
                  key={key}
                  type="button"
                  onMouseDown={binding ? startActionBarDrag(key) : preventPrimaryDefault}
                  onMouseUp={dropOnActionBar(key)}
                  onMouseEnter={
                    skillId
                      ? showSkillTooltip(skillId, 'action-bar')
                      : itemId
                        ? showItemTooltip(serializeInventoryItem(itemId, Math.max(1, itemQuantity)), 'action-bar')
                        : undefined
                  }
                  onMouseMove={binding ? moveActionBarTooltip(binding) : undefined}
                  onMouseLeave={binding ? (skillId ? hideSkillTooltip : hideItemTooltip) : undefined}
                  onClick={() => triggerActionBarBinding(binding)}
                  onContextMenu={binding ? clearActionBarSlot(key) : undefined}
                  className={`${SKILL_BAR_SLOT_CLASS} ${
                    skillId
                      ? 'border-[#f4b36b]/40 bg-[linear-gradient(180deg,rgba(89,49,20,0.92),rgba(39,21,10,0.96))]'
                      : ''
                  } ${
                    activeSkillTargeting === skillId && skillId
                      ? 'ring-2 ring-[#ffd18a]/70 ring-offset-2 ring-offset-transparent'
                      : ''
                  } ${binding && !isBindingAvailable ? 'opacity-55' : ''} ${isCoolingDown ? 'opacity-90' : ''}`}
                >
                  <div className="absolute left-1.5 top-1.5 z-10 rounded-md border border-[#d9efbd]/24 bg-[#102008]/72 px-1.5 py-[2px] text-[10px] font-bold leading-none text-[#f4ffe8]">
                    {key}
                  </div>
                  {binding ? (
                    <div className="relative h-full w-full overflow-hidden rounded-[1rem] border border-[#f1b26a]/28 bg-[linear-gradient(180deg,rgba(95,41,18,0.82),rgba(46,20,10,0.88))] text-[#ffe7b8] shadow-[inset_0_1px_0_rgba(255,236,195,0.08)]">
                      {skillId && skillIcon ? (
                        <img
                          src={skillIcon.src}
                          alt={skillIcon.alt}
                          draggable={false}
                          className="pixelated h-full w-full object-contain"
                        />
                      ) : itemId ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <ItemTile
                            itemValue={serializeInventoryItem(itemId, Math.max(1, itemQuantity))}
                            compact
                            itemTintOverrides={itemTintOverrides}
                            cooldownEndsAt={consumableCooldowns[itemId] ?? 0}
                            cooldownNow={cooldownNow}
                          />
                        </div>
                      ) : null}
                      {itemId && itemQuantity > 1 ? (
                        <div className="absolute bottom-1 right-1 rounded-md bg-[rgba(12,18,8,0.7)] px-1 text-[10px] font-bold leading-none text-[#fff4cf]">
                          {itemQuantity}
                        </div>
                      ) : null}
                      {isCoolingDown ? (
                        <>
                          <div
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: `conic-gradient(from -90deg, rgba(12,18,8,0.12) 0deg, rgba(12,18,8,0.12) ${
                                360 - cooldownProgress * 360
                              }deg, rgba(8,12,6,0.72) ${360 - cooldownProgress * 360}deg, rgba(8,12,6,0.72) 360deg)`,
                            }}
                          />
                          <div className="absolute inset-[5px] rounded-lg bg-[rgba(10,14,8,0.26)]" />
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-[rgba(12,18,8,0.55)] px-1 text-[10px] font-bold leading-none text-[#fff4cf]">
                            {(remainingMs / 1000).toFixed(1)}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-[#d9efbd]/16 bg-[#102008]/50 text-[#bfd8a4]/70">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                        --
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
