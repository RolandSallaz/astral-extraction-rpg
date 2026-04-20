'use client';

import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';
import {
  EQUIPMENT_ITEMS,
  type GemItemId,
  getBaseEquipmentSlot,
  getEquipmentGemSlotIds,
  getInventoryItemId,
  serializeInventoryItem,
  type BaseEquipmentSlot,
} from '@/lib/items/equipmentItems';
import type { EquipmentState, InventoryState } from '@/lib/playerProfile';
import type {
  DragSource,
  DragState,
  HoveredItemState,
  InspectItemState,
} from '@/components/game-hud/types';
import {
  getItemSocketGemIds,
  MAX_ITEM_SOCKET_COUNT,
  serializeSocketedEquipmentItem,
} from '@/components/game-hud/itemSocketHelpers';
import { isSameDragSource } from '@/components/game-hud/dragHelpers';
import { findFirstEmptySlot } from '@/components/game-hud/inventoryHelpers';

type ContainerLike = { slots: InventoryState } | null;

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

export type InspectSocketHandlersParams = {
  dragState: DragState | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  inspectItem: InspectItemState | null;
  socketGemIntoInspectItem: (socketIndex: number, itemValue: string, source: DragSource) => boolean;
};

export type UseSocketMutationsParams = {
  equipment: EquipmentState;
  inventory: InventoryState;
  container: ContainerLike;
  inspectItem: InspectItemState | null;
  setInspectItem: Dispatch<SetStateAction<InspectItemState | null>>;
  setHoveredItem: Dispatch<SetStateAction<HoveredItemState | null>>;
  onEquipmentChange: (equipment: EquipmentState) => void;
  onInventoryChange: (inventory: InventoryState) => void;
  onContainerChange: (slots: InventoryState) => void;
};

function buildEquipmentWithSockets(
  equipment: EquipmentState,
  slot: BaseEquipmentSlot,
  nextGemIds: Array<string | null>,
) {
  const nextEquipment = { ...equipment };
  getEquipmentGemSlotIds(slot, MAX_ITEM_SOCKET_COUNT).forEach((slotId, index) => {
    const gemId = nextGemIds[index] ?? null;
    if (gemId) {
      nextEquipment[slotId] = gemId as GemItemId;
    } else {
      delete nextEquipment[slotId];
    }
  });
  return nextEquipment;
}

function buildInventoryWithItemSockets(
  sourceInventory: InventoryState,
  index: number,
  nextGemIds: Array<string | null>,
) {
  const currentValue = sourceInventory[index];
  const itemId = getInventoryItemId(currentValue);
  if (!currentValue || !itemId) {
    return sourceInventory;
  }

  const nextInventory = [...sourceInventory];
  nextInventory[index] = serializeSocketedEquipmentItem(itemId, nextGemIds);
  return nextInventory;
}

function buildContainerWithItemSockets(
  sourceSlots: InventoryState,
  index: number,
  nextGemIds: Array<string | null>,
) {
  const currentValue = sourceSlots[index] ?? null;
  const itemId = getInventoryItemId(currentValue);
  if (!currentValue || !itemId) {
    return sourceSlots;
  }

  const nextContainer = [...sourceSlots];
  nextContainer[index] = serializeSocketedEquipmentItem(itemId, nextGemIds);
  return nextContainer;
}

export function useSocketMutations({
  equipment,
  inventory,
  container,
  inspectItem,
  setInspectItem,
  setHoveredItem,
  onEquipmentChange,
  onInventoryChange,
  onContainerChange,
}: UseSocketMutationsParams) {
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

      onEquipmentChange(buildEquipmentWithSockets(equipment, baseSlot, nextSocketGemIds));
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

      onEquipmentChange(buildEquipmentWithSockets(equipment, baseSlot, nextSocketGemIds));
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

      if (container) {
        onContainerChange(buildContainerWithItemSockets(container.slots, inspectItem.source.index, nextSocketGemIds));
      }
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

  const buildRemoveGemFromItemSourceResult = (
    itemSource: DragSource,
    socketIndex: number,
  ): RemoveGemResult | null => {
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

      return {
        gemValue: serializeInventoryItem(gemId),
        nextEquipment: buildEquipmentWithSockets(equipment, baseSlot, nextSocketGemIds),
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

  return {
    socketGemIntoInspectItem,
    removeGemFromInspectItem,
    buildRemoveGemFromItemSourceResult,
  };
}

export function buildInspectSocketHandlers({
  dragState,
  setDragState,
  inspectItem,
  socketGemIntoInspectItem,
}: InspectSocketHandlersParams) {
  const handleInspectSocketMouseDown = (
    socketGemValue: string | null,
    socketIndex: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!inspectItem || !socketGemValue || event.button !== 0) {
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
        socketIndex,
      },
      pointerX: event.clientX,
      pointerY: event.clientY,
    });
  };

  const handleInspectSocketMouseUp = (
    socketIndex: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (dragState?.source.type === 'equipment' || !dragState) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (dragState.itemId && socketGemIntoInspectItem(socketIndex, dragState.itemId, dragState.source)) {
      setDragState(null);
    }
  };

  return { handleInspectSocketMouseDown, handleInspectSocketMouseUp };
}
