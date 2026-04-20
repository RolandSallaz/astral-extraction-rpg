import { isSameEquipmentItemFamily } from '@mmorpg/shared';
import {
  EQUIPMENT_ITEMS,
  type ConsumableItemId,
} from '@/lib/items/equipmentItems';
import type { EquipmentState } from '@/lib/playerProfile';
import type {
  ActionBarBinding,
  ActionSlotKey,
  KeyboardActionSlotKey,
  MouseActionSlotKey,
  MouseSkillBindings,
  SkillId,
} from '@/components/game-hud/types';

export const ACTION_BAR_STORAGE_KEY = 'mmorpg.ui.action-bar.bindings.v1';

export const MOUSE_ACTION_SLOTS: Array<{ key: MouseActionSlotKey; label: string }> = [
  { key: 'LMB', label: 'LMB' },
  { key: 'RMB', label: 'RMB' },
];

export const KEYBOARD_ACTION_SLOTS: Array<{ key: KeyboardActionSlotKey; code?: string }> = [
  { key: '1', code: 'Digit1' },
  { key: '2', code: 'Digit2' },
  { key: '3', code: 'Digit3' },
  { key: '4', code: 'Digit4' },
  { key: 'Q', code: 'KeyQ' },
  { key: 'E', code: 'KeyE' },
  { key: 'R', code: 'KeyR' },
];

export const ACTION_BAR_SLOTS: Array<{ key: ActionSlotKey; code?: string }> = [
  ...MOUSE_ACTION_SLOTS,
  ...KEYBOARD_ACTION_SLOTS,
];

export function getAvailableSkills(equipment: EquipmentState): SkillId[] {
  const availableSkills: SkillId[] = [];

  if (isSameEquipmentItemFamily(equipment.weapon, 'wood_staff')) {
    availableSkills.push('woodStaffStrike');
    availableSkills.push('woodStaffDash');
  }

  return availableSkills;
}

export function getDefaultActionBarBindings(): Partial<Record<ActionSlotKey, ActionBarBinding | null>> {
  const nextBindings: Partial<Record<ActionSlotKey, ActionBarBinding | null>> = {};

  return nextBindings;
}

export function isMouseActionSlot(slotKey: ActionSlotKey): slotKey is MouseActionSlotKey {
  return slotKey === 'LMB' || slotKey === 'RMB';
}

export function canBindActionToSlot(slotKey: ActionSlotKey, binding: ActionBarBinding | null) {
  if (!binding) {
    return true;
  }

  if (isMouseActionSlot(slotKey)) {
    return binding.kind === 'skill';
  }

  return true;
}

export function parseStoredActionBarBindings(
  rawValue: string | null,
): Partial<Record<ActionSlotKey, ActionBarBinding | null>> | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<Record<ActionSlotKey, ActionBarBinding | null>>;
    const nextBindings: Partial<Record<ActionSlotKey, ActionBarBinding | null>> = {};

    ACTION_BAR_SLOTS.forEach(({ key }) => {
      if (!(key in parsed)) {
        return;
      }

      const binding = parsed[key];
      if (binding === null) {
        nextBindings[key] = null;
        return;
      }

      if (!binding) {
        return;
      }

      if (
        binding.kind === 'skill' &&
        ['woodStaffStrike', 'woodStaffDash', 'fireNova', 'fireField'].includes(binding.skillId)
      ) {
        nextBindings[key] = { kind: 'skill', skillId: binding.skillId as SkillId };
        return;
      }

      if (binding.kind === 'item' && !isMouseActionSlot(key)) {
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

export function getMouseSkillBindingsFromActionBar(
  bindings: Partial<Record<ActionSlotKey, ActionBarBinding | null>>,
): MouseSkillBindings {
  return {
    LMB: bindings.LMB?.kind === 'skill' ? bindings.LMB.skillId : null,
    RMB: bindings.RMB?.kind === 'skill' ? bindings.RMB.skillId : null,
  };
}

export function getResolvedActionBarBindings(
  bindings: Partial<Record<ActionSlotKey, ActionBarBinding | null>>,
  equipment: EquipmentState,
) {
  const availableSkills = getAvailableSkills(equipment);
  const merged: Partial<Record<ActionSlotKey, ActionBarBinding | null>> = {
    ...getDefaultActionBarBindings(),
    ...bindings,
  };

  ACTION_BAR_SLOTS.forEach(({ key }) => {
    const binding = merged[key];
    if (!binding || binding.kind !== 'skill') {
      return;
    }
    if (!availableSkills.includes(binding.skillId)) {
      merged[key] = null;
    }
  });

  return merged;
}
