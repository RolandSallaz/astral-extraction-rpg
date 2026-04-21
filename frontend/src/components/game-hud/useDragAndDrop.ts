'use client';

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { serializeInventoryItem, type ConsumableItemId } from '@/lib/items/equipmentItems';
import type {
  ActionBarBinding,
  ActionSlotKey,
  DragSource,
  DragState,
  HoveredItemState,
  HoveredSkillState,
  InspectItemState,
  ItemContextMenuState,
  SkillId,
} from '@/components/game-hud/types';

type UseDragAndDropParams = {
  getActionBarItemQuantity: (itemId: ConsumableItemId) => number;
  onAltItemAction: (source: DragSource, itemValue: string) => void;
  onUnhandledActionBarDragRelease: (slotKey: ActionSlotKey) => void;
};

export function useDragAndDrop({
  getActionBarItemQuantity,
  onAltItemAction,
  onUnhandledActionBarDragRelease,
}: UseDragAndDropParams) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredItem, setHoveredItem] = useState<HoveredItemState | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<HoveredSkillState | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<ItemContextMenuState | null>(null);
  const [inspectItem, setInspectItem] = useState<InspectItemState | null>(null);
  const actionBarDragHandledRef = useRef(false);

  const clearHoveredItemScope = (scope: HoveredItemState['scope']) => {
    setHoveredItem((current) => (current?.scope === scope ? null : current));
  };

  const clearActionBarTooltip = () => {
    setHoveredItem((current) => (current?.scope === 'action-bar' ? null : current));
    setHoveredSkill((current) => (current?.scope === 'action-bar' ? null : current));
  };

  const beginItemDrag = (
    event: ReactMouseEvent<HTMLElement>,
    itemId: string,
    source: DragSource,
  ) => {
    if (event.button !== 0) {
      return false;
    }

    event.preventDefault();
    setDragState({
      itemId,
      skillId: null,
      source,
      pointerX: event.clientX,
      pointerY: event.clientY,
    });
    return true;
  };

  const beginSkillDrag = (
    event: ReactMouseEvent<HTMLElement>,
    skillId: SkillId,
    source: DragSource,
  ) => {
    if (event.button !== 0) {
      return false;
    }

    event.preventDefault();
    setDragState({
      itemId: null,
      skillId,
      source,
      pointerX: event.clientX,
      pointerY: event.clientY,
    });
    return true;
  };

  const beginActionBarDrag = (
    event: ReactMouseEvent<HTMLElement>,
    slotKey: ActionSlotKey,
    binding: ActionBarBinding | null,
  ) => {
    if (!binding || event.button !== 0) {
      return false;
    }

    actionBarDragHandledRef.current = false;
    return binding.kind === 'item'
      ? beginItemDrag(event, serializeInventoryItem(binding.itemId), { type: 'action-bar', slotKey })
      : beginSkillDrag(event, binding.skillId, { type: 'action-bar', slotKey });
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
    (skillId: SkillId, scope: HoveredSkillState['scope'] = 'skill-library') =>
    (event: ReactMouseEvent<HTMLElement>) => {
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
    clearActionBarTooltip();

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
        clearActionBarTooltip();
        return;
      }

      syncActionBarTooltip(binding, event.clientX, event.clientY);
    };

  const openItemContextMenu =
    (itemValue: string, source: DragSource) => (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 2) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.altKey) {
        onAltItemAction(source, itemValue);
        return;
      }

      setItemContextMenu({
        itemValue,
        source,
        pointerX: event.clientX,
        pointerY: event.clientY,
      });
    };

  const openInspectItem = (itemValue: string, source: DragSource) => {
    setInspectItem({ itemValue, source });
    setItemContextMenu(null);
  };

  const closeInspectItem = () => {
    setInspectItem(null);
    clearHoveredItemScope('inspect');
  };

  const markActionBarDragHandled = () => {
    actionBarDragHandledRef.current = true;
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
        onUnhandledActionBarDragRelease(dragState.source.slotKey);
        clearActionBarTooltip();
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
  }, [dragState, onUnhandledActionBarDragRelease]);

  useEffect(() => {
    const handlePointerDown = () => {
      setItemContextMenu(null);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return {
    dragState,
    setDragState,
    hoveredItem,
    setHoveredItem,
    hoveredSkill,
    setHoveredSkill,
    itemContextMenu,
    setItemContextMenu,
    inspectItem,
    setInspectItem,
    clearHoveredItemScope,
    beginItemDrag,
    beginSkillDrag,
    beginActionBarDrag,
    showItemTooltip,
    moveItemTooltip,
    hideItemTooltip,
    showSkillTooltip,
    moveSkillTooltip,
    hideSkillTooltip,
    syncActionBarTooltip,
    moveActionBarTooltip,
    openItemContextMenu,
    openInspectItem,
    closeInspectItem,
    markActionBarDragHandled,
  };
}
