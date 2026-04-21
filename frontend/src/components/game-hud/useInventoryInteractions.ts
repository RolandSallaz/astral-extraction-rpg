'use client';

import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';
import {
  EQUIPMENT_ITEMS,
  getEquipmentGemSlotIds,
  getInventoryItemId,
  parseInventoryItem,
  type BaseEquipmentSlot,
  type ConsumableItemId,
  type EquipmentItemId,
  type EquipmentSlot,
  type GemItemId,
} from '@/lib/items/equipmentItems';
import type { EquipmentItemProgressionState, EquipmentState, InventoryState } from '@/lib/playerProfile';
import type {
  ActionBarBinding,
  ActionSlotKey,
  ConsumableUseRequest,
  DragSource,
  DragState,
  InspectItemState,
  ItemContextMenuState,
} from '@/components/game-hud/types';
import {
  getEquipmentSocketGemIds,
  getEquipmentSocketSlotIds,
  MAX_ITEM_SOCKET_COUNT,
  serializeSocketedEquipmentItem,
} from '@/components/game-hud/itemSocketHelpers';
import {
  canSocketGemIntoSlot,
  canSwapIntoEquipment,
  findFirstCompatibleEquipmentSlotForGem,
  findFirstEmptySlot,
  findFirstEmptySocketSlot,
  moveGridItem,
  moveInventoryItem,
} from '@/components/game-hud/inventoryHelpers';
import { canBindActionToSlot } from '@/components/game-hud/actionBarHelpers';

type ContainerLike = { id: string; slots: InventoryState } | null;

type RemoveGemResult =
  | {
      gemValue: string;
      nextEquipment: EquipmentState;
      nextInventory?: undefined;
      nextContainer?: undefined;
      nextInspectItemValue?: undefined;
    }
  | {
      gemValue: string;
      nextInventory: InventoryState;
      nextInspectItemValue: string;
      nextEquipment?: undefined;
      nextContainer?: undefined;
    }
  | {
      gemValue: string;
      nextContainer: InventoryState;
      nextInspectItemValue: string;
      nextEquipment?: undefined;
      nextInventory?: undefined;
    };

type ActionBarBindings = Partial<Record<ActionSlotKey, ActionBarBinding | null>>;

export type UseInventoryInteractionsParams = {
  equipment: EquipmentState;
  equipmentItemProgression: EquipmentItemProgressionState;
  inventory: InventoryState;
  container: ContainerLike;
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  setItemContextMenu: Dispatch<SetStateAction<ItemContextMenuState | null>>;
  setInspectItem: Dispatch<SetStateAction<InspectItemState | null>>;
  markActionBarDragHandled: () => void;
  syncActionBarTooltip: (
    binding: ActionBarBinding | null,
    pointerX: number,
    pointerY: number,
  ) => void;
  getActionBarBinding: (slotKey: ActionSlotKey) => ActionBarBinding | null;
  setActionBarBinding: (slotKey: ActionSlotKey, binding: ActionBarBinding | null) => void;
  updateActionBarBindings: (updater: (current: ActionBarBindings) => ActionBarBindings) => void;
  getDraggedActionBarBinding: (currentDragState: DragState | null) => ActionBarBinding | null;
  buildRemoveGemFromItemSourceResult: (
    itemSource: DragSource,
    socketIndex: number,
  ) => RemoveGemResult | null;
  onEquipmentChange: (
    equipment: EquipmentState,
    equipmentItemProgression: EquipmentItemProgressionState,
  ) => void;
  onInventoryChange: (inventory: InventoryState) => void;
  onContainerChange: (slots: InventoryState) => void;
  onInventoryUse: (request: ConsumableUseRequest) => void;
};

export function useInventoryInteractions({
  equipment,
  equipmentItemProgression,
  inventory,
  container,
  dragState,
  setDragState,
  setItemContextMenu,
  setInspectItem,
  markActionBarDragHandled,
  syncActionBarTooltip,
  getActionBarBinding,
  setActionBarBinding,
  updateActionBarBindings,
  getDraggedActionBarBinding,
  buildRemoveGemFromItemSourceResult,
  onEquipmentChange,
  onInventoryChange,
  onContainerChange,
  onInventoryUse,
}: UseInventoryInteractionsParams) {
  const emitEquipmentChange = (
    nextEquipment: EquipmentState,
    nextEquipmentItemProgression: EquipmentItemProgressionState = equipmentItemProgression,
  ) => {
    onEquipmentChange(nextEquipment, nextEquipmentItemProgression);
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

    if (itemDefinition.type !== 'equipment' && itemDefinition.type !== 'gem') {
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

      emitEquipmentChange(nextEquipment);
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
    const nextEquipmentItemProgression: EquipmentItemProgressionState = {
      ...equipmentItemProgression,
    };
    if (parsedItem?.itemProgression) {
      nextEquipmentItemProgression[targetSlot] = parsedItem.itemProgression;
    } else {
      delete nextEquipmentItemProgression[targetSlot];
    }

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
        ? serializeSocketedEquipmentItem(
          replacedItem,
          getEquipmentSocketGemIds(targetSlot, equipment),
          equipmentItemProgression[targetSlot],
        )
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

    emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);
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
      const nextEquipmentItemProgression = { ...equipmentItemProgression };
      delete nextEquipment[source.slot];
      delete nextEquipmentItemProgression[source.slot as BaseEquipmentSlot];
      getEquipmentGemSlotIds(source.slot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
      emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);
    }

    setItemContextMenu(null);
    setDragState(null);
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
          markActionBarDragHandled();
          syncActionBarTooltip(getActionBarBinding(slotKey), event.clientX, event.clientY);
          setDragState(null);
          return;
        }

        const draggedBinding = getDraggedActionBarBinding(dragState);
        markActionBarDragHandled();
        if (!draggedBinding || !canBindActionToSlot(slotKey, draggedBinding)) {
          setDragState(null);
          return;
        }

        updateActionBarBindings((current) => ({
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
        if (!canBindActionToSlot(slotKey, nextBinding)) {
          setDragState(null);
          return;
        }
        setActionBarBinding(slotKey, nextBinding);
        syncActionBarTooltip(nextBinding, event.clientX, event.clientY);
        setDragState(null);
        return;
      }

      if (dragState.source.type === 'inventory' && dragState.itemId) {
        const draggedItemId = getInventoryItemId(dragState.itemId);
        if (draggedItemId && EQUIPMENT_ITEMS[draggedItemId].type === 'consumable') {
          const nextBinding = { kind: 'item', itemId: draggedItemId as ConsumableItemId } as const;
          if (canBindActionToSlot(slotKey, nextBinding)) {
            setActionBarBinding(slotKey, nextBinding);
            syncActionBarTooltip(nextBinding, event.clientX, event.clientY);
          } else {
            syncActionBarTooltip(null, event.clientX, event.clientY);
          }
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
          emitEquipmentChange(result.nextEquipment);
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
        serializeSocketedEquipmentItem(
          dragState.itemId,
          getEquipmentSocketGemIds(sourceSlot as BaseEquipmentSlot, equipment),
          equipmentItemProgression[sourceSlot as BaseEquipmentSlot],
        );

      if (preferredIndex !== -1) {
        const nextInventory = [...inventory];
        nextInventory[preferredIndex] = sourceItemValue;
        onInventoryChange(nextInventory);

        const nextEquipment = { ...equipment };
        const nextEquipmentItemProgression = { ...equipmentItemProgression };
        delete nextEquipment[sourceSlot];
        delete nextEquipmentItemProgression[sourceSlot as BaseEquipmentSlot];
        getEquipmentGemSlotIds(sourceSlot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
        emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);
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
        emitEquipmentChange(
          {
            ...equipment,
            [sourceSlot]: targetItem,
          },
          {
            ...equipmentItemProgression,
            [sourceSlot]: undefined,
          },
        );
      } else {
        const nextEquipment = { ...equipment };
        const nextEquipmentItemProgression = { ...equipmentItemProgression };
        delete nextEquipment[sourceSlot];
        delete nextEquipmentItemProgression[sourceSlot as BaseEquipmentSlot];
        getEquipmentGemSlotIds(sourceSlot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
        emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);
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

        emitEquipmentChange({
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
        const nextEquipmentItemProgression: EquipmentItemProgressionState = {
          ...equipmentItemProgression,
        };
        const sourceItem = nextEquipment[sourceSlot];
        const currentTargetItem = nextEquipment[slot];
        const sourceProgression = nextEquipmentItemProgression[sourceSlot as BaseEquipmentSlot];
        const targetProgression = nextEquipmentItemProgression[slot as BaseEquipmentSlot];

        if (sourceItem) {
          nextEquipment[slot] = sourceItem;
          if (sourceProgression) {
            nextEquipmentItemProgression[slot as BaseEquipmentSlot] = sourceProgression;
          } else {
            delete nextEquipmentItemProgression[slot as BaseEquipmentSlot];
          }
        }

        if (currentTargetItem) {
          nextEquipment[sourceSlot] = currentTargetItem;
          if (targetProgression) {
            nextEquipmentItemProgression[sourceSlot as BaseEquipmentSlot] = targetProgression;
          } else {
            delete nextEquipmentItemProgression[sourceSlot as BaseEquipmentSlot];
          }
        } else {
          delete nextEquipment[sourceSlot];
          delete nextEquipmentItemProgression[sourceSlot as BaseEquipmentSlot];
        }

        emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);
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
          ? serializeSocketedEquipmentItem(
            targetItem,
            getEquipmentSocketGemIds(slot as BaseEquipmentSlot, equipment),
            equipmentItemProgression[slot as BaseEquipmentSlot],
          )
          : targetItem ?? null;

      const nextEquipment: EquipmentState = {
        ...equipment,
        [slot]: dragItemId,
      };
      const nextEquipmentItemProgression: EquipmentItemProgressionState = {
        ...equipmentItemProgression,
      };
      if (parsedDraggedItem?.itemProgression) {
        nextEquipmentItemProgression[slot as BaseEquipmentSlot] = parsedDraggedItem.itemProgression;
      } else {
        delete nextEquipmentItemProgression[slot as BaseEquipmentSlot];
      }
      getEquipmentGemSlotIds(slot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId, index) => {
        const gemId = parsedDraggedItem?.socketedGemIds[index] ?? null;
        if (gemId) {
          nextEquipment[slotId] = gemId;
        } else {
          delete nextEquipment[slotId];
        }
      });

      emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);

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
          emitEquipmentChange(result.nextEquipment);
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
        emitEquipmentChange(result.nextEquipment);
      }
      const nextInventoryFromResult = result.nextInventory ? [...result.nextInventory] : [...inventory];
      nextInventoryFromResult[emptyIndex] = result.gemValue;
      onInventoryChange(nextInventoryFromResult);
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
        ? serializeSocketedEquipmentItem(
          dragState.itemId,
          getEquipmentSocketGemIds(dragState.source.slot as BaseEquipmentSlot, equipment),
          equipmentItemProgression[dragState.source.slot as BaseEquipmentSlot],
        )
        : dragState.itemId;
    onInventoryChange(nextInventory);

    if (dragState.source.type === 'equipment') {
      const nextEquipment = { ...equipment };
      const nextEquipmentItemProgression = { ...equipmentItemProgression };
      delete nextEquipment[dragState.source.slot];
      delete nextEquipmentItemProgression[dragState.source.slot as BaseEquipmentSlot];
      getEquipmentGemSlotIds(dragState.source.slot as BaseEquipmentSlot, MAX_ITEM_SOCKET_COUNT).forEach((slotId) => delete nextEquipment[slotId]);
      emitEquipmentChange(nextEquipment, nextEquipmentItemProgression);
    }

    if (dragState.source.type === 'container' && container) {
      const nextContainer = [...container.slots];
      nextContainer[dragState.source.index] = null;
      onContainerChange(nextContainer);
    }

    setDragState(null);
  };

  return {
    handleEquipFromSource,
    handleDropItem,
    quickTransferItem,
    dropOnActionBar,
    dropOnInventory,
    dropOnEquipment,
    dropOnContainer,
    dropIntoBackpackZone,
  };
}
