'use client';

import type { ConsumableItemId, EquipmentSlot } from '@/lib/items/equipmentItems';

export type SkillId = 'woodStaffStrike' | 'woodStaffDash' | 'woodStaffSlam' | 'woodStaffChainStrike' | 'woodStaffSpectralVolley' | 'woodStaffStormIncarnate' | 'woodStaffVoidFracture' | 'fireball' | 'fireNova' | 'fireField';

export type SkillCooldownState = Partial<Record<SkillId, number>>;

export type ConsumableCooldownState = Partial<
  Record<
    'healing_potion' | 'poison_potion' | 'slow_potion' | 'antidote' | 'speed_potion' | 'fire_resistance_potion' | 'teleport_scroll',
    number
  >
>;

export type ConsumableUseRequest =
  | { type: 'inventory'; slotIndex: number }
  | { type: 'container'; containerId: string; slotIndex: number };

export type MouseActionSlotKey = 'LMB' | 'RMB';
export type KeyboardActionSlotKey = '1' | '2' | '3' | '4' | 'Q' | 'E' | 'R';
export type ActionSlotKey = KeyboardActionSlotKey | MouseActionSlotKey;

export type MouseSkillBindings = Record<MouseActionSlotKey, SkillId | null>;

export type ActionBarBinding =
  | { kind: 'skill'; skillId: SkillId }
  | { kind: 'item'; itemId: ConsumableItemId };

export type DragSource =
  | { type: 'inventory'; index: number }
  | { type: 'container'; index: number }
  | { type: 'equipment'; slot: EquipmentSlot }
  | { type: 'inspect-socket'; itemSource: DragSource; socketIndex: number }
  | { type: 'skill-library'; skillId: SkillId }
  | { type: 'action-bar'; slotKey: ActionSlotKey };

export type DragState = {
  itemId: string | null;
  skillId: SkillId | null;
  source: DragSource;
  pointerX: number;
  pointerY: number;
};

export type HoveredItemState = {
  itemId: string;
  pointerX: number;
  pointerY: number;
  scope: 'inventory' | 'equipment' | 'container' | 'inspect' | 'action-bar';
};

export type HoveredSkillState = {
  skillId: SkillId;
  pointerX: number;
  pointerY: number;
  scope: 'skill-library' | 'action-bar';
};

export type ItemContextMenuState = {
  itemValue: string;
  source: DragSource;
  pointerX: number;
  pointerY: number;
};

export type InspectItemState = {
  itemValue: string;
  source: DragSource;
};
