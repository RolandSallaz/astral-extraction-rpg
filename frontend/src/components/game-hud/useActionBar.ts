'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EQUIPMENT_ITEMS,
  getInventoryItemId,
  parseInventoryItem,
  type ConsumableItemId,
} from '@/lib/items/equipmentItems';
import type { EquipmentItemProgressionState, EquipmentState, InventoryState } from '@/lib/playerProfile';
import type {
  ActionBarBinding,
  ActionSlotKey,
  ConsumableCooldownState,
  ConsumableUseRequest,
  DragState,
  MouseSkillBindings,
  SkillCooldownState,
  SkillId,
} from '@/components/game-hud/types';
import {
  ACTION_BAR_SLOTS,
  ACTION_BAR_STORAGE_KEY,
  KEYBOARD_ACTION_SLOTS,
  MOUSE_ACTION_SLOTS,
  getAvailableSkills,
  getDefaultActionBarBindings,
  getMouseSkillBindingsFromActionBar,
  getResolvedActionBarBindings,
  parseStoredActionBarBindings,
} from '@/components/game-hud/actionBarHelpers';
import { CONSUMABLE_COOLDOWN_MS } from '@/components/game-hud/cooldownConstants';

type ActionBarBindings = Partial<Record<ActionSlotKey, ActionBarBinding | null>>;

export type UseActionBarParams = {
  equipment: EquipmentState;
  equipmentItemProgression: EquipmentItemProgressionState;
  inventory: InventoryState;
  skillCooldowns: SkillCooldownState;
  consumableCooldowns: ConsumableCooldownState;
  onSkillTrigger: (skillId: SkillId) => void;
  onInventoryUse: (request: ConsumableUseRequest) => void;
  onActionBarConsumableTrigger: (itemId: 'healing_potion') => void;
  onMouseSkillBindingsChange?: (bindings: MouseSkillBindings) => void;
};

export function useActionBar({
  equipment,
  equipmentItemProgression,
  inventory,
  skillCooldowns,
  consumableCooldowns,
  onSkillTrigger,
  onInventoryUse,
  onActionBarConsumableTrigger,
  onMouseSkillBindingsChange,
}: UseActionBarParams) {
  const autoAssignedSkillsRef = useRef<Set<SkillId>>(new Set());
  const [actionBarBindings, setActionBarBindings] = useState<ActionBarBindings>(() => {
    if (typeof window === 'undefined') {
      return getDefaultActionBarBindings();
    }

    return parseStoredActionBarBindings(window.localStorage.getItem(ACTION_BAR_STORAGE_KEY))
      ?? getDefaultActionBarBindings();
  });

  const availableSkills = getAvailableSkills(equipment, equipmentItemProgression);

  useEffect(() => {
    const persistedBindings = getResolvedActionBarBindings(actionBarBindings, equipment, equipmentItemProgression);
    window.localStorage.setItem(ACTION_BAR_STORAGE_KEY, JSON.stringify(persistedBindings));
  }, [actionBarBindings, equipment, equipmentItemProgression]);

  useEffect(() => {
    const resolvedBindings = getResolvedActionBarBindings(actionBarBindings, equipment, equipmentItemProgression);
    onMouseSkillBindingsChange?.(getMouseSkillBindingsFromActionBar(resolvedBindings));
  }, [actionBarBindings, equipment, equipmentItemProgression, onMouseSkillBindingsChange]);

  useEffect(() => {
    setActionBarBindings((current) => {
      const resolved = getResolvedActionBarBindings(current, equipment, equipmentItemProgression);
      const next: ActionBarBindings = { ...resolved };
      let changed = false;
      const boundSkills = new Set<SkillId>();

      ACTION_BAR_SLOTS.forEach(({ key }) => {
        const binding = resolved[key];
        if (binding?.kind === 'skill') {
          boundSkills.add(binding.skillId);
        }
      });

      autoAssignedSkillsRef.current.forEach((skillId) => {
        if (!availableSkills.includes(skillId)) {
          autoAssignedSkillsRef.current.delete(skillId);
        }
      });

      const findEmptySlot = () => {
        for (const { key } of MOUSE_ACTION_SLOTS) {
          if (!next[key]) {
            return key;
          }
        }
        for (const { key } of KEYBOARD_ACTION_SLOTS) {
          if (!next[key]) {
            return key;
          }
        }
        return null;
      };

      availableSkills.forEach((skillId) => {
        if (boundSkills.has(skillId) || autoAssignedSkillsRef.current.has(skillId)) {
          return;
        }

        const emptySlot = findEmptySlot();
        if (!emptySlot) {
          return;
        }

        next[emptySlot] = { kind: 'skill', skillId };
        boundSkills.add(skillId);
        autoAssignedSkillsRef.current.add(skillId);
        changed = true;
      });

      return changed ? next : current;
    });
  }, [availableSkills, equipment, equipmentItemProgression]);

  const updateActionBarBindings = (
    updater: (current: ActionBarBindings) => ActionBarBindings,
  ) => {
    setActionBarBindings((current) => updater(getResolvedActionBarBindings(current, equipment, equipmentItemProgression)));
  };

  const getActionBarBinding = (slotKey: ActionSlotKey) =>
    getResolvedActionBarBindings(actionBarBindings, equipment, equipmentItemProgression)[slotKey] ?? null;

  const findActionBarInventorySlot = (itemId: ConsumableItemId) =>
    inventory.findIndex((itemValue) => getInventoryItemId(itemValue) === itemId);

  const setActionBarBinding = (slotKey: ActionSlotKey, binding: ActionBarBinding | null) => {
    updateActionBarBindings((current) => ({
      ...current,
      [slotKey]: binding,
    }));
  };

  const assignSkillToFirstAvailableActionSlot = (skillId: SkillId) => {
    updateActionBarBindings((current) => {
      const emptySlot = KEYBOARD_ACTION_SLOTS.find(({ key }) => !current[key]);
      const targetSlotKey = emptySlot?.key ?? KEYBOARD_ACTION_SLOTS[0].key;
      return {
        ...current,
        [targetSlotKey]: { kind: 'skill', skillId },
      };
    });
  };

  const getActionBarItemQuantity = (itemId: ConsumableItemId) =>
    inventory.reduce((total, itemValue) => {
      const parsed = parseInventoryItem(itemValue);
      if (!parsed || parsed.itemId !== itemId) {
        return total;
      }

      return total + parsed.quantity;
    }, 0);

  const triggerActionBarBinding = (binding: ActionBarBinding | null) => {
    if (!binding) {
      return;
    }

    if (binding.kind === 'skill') {
      if (!availableSkills.includes(binding.skillId)) {
        return;
      }

      const cooldownSkillId = binding.skillId === 'woodStaffChainStrike' ? 'woodStaffStrike' : binding.skillId;
      const readyAt = skillCooldowns[cooldownSkillId] ?? 0;
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

    if (binding.itemId === 'healing_potion') {
      onActionBarConsumableTrigger('healing_potion');
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

  return {
    actionBarBindings,
    setActionBarBindings,
    availableSkills,
    getActionBarBinding,
    setActionBarBinding,
    updateActionBarBindings,
    assignSkillToFirstAvailableActionSlot,
    triggerActionBarBinding,
    getActionBarItemQuantity,
    findActionBarInventorySlot,
    getDraggedActionBarBinding,
  };
}
