'use client';

import type { MouseEvent as ReactMouseEvent, MouseEventHandler, ReactNode } from 'react';
import { HudWindow } from '@/components/ui/HudWindow';
import type {
  DragState,
  HoveredItemState,
  HoveredSkillState,
  InspectItemState,
  ItemContextMenuState,
  SkillId,
} from '@/components/game-hud/types';

type TooltipPosition = {
  left: number;
  top: number;
};

type ItemTooltipView = {
  name: string;
  label: string;
  lines: string[];
  textColor: string;
};

type SkillTooltipView = {
  name: string;
  lines: string[];
};

type InspectItemView = ItemTooltipView & {
  socketColors: Array<string | null>;
  socketCount: number;
  socketGemValues: Array<string | null>;
};

type RenderItemTileArgs = {
  itemValue: string;
  compact?: boolean;
  socketCount?: number;
  socketColors?: Array<string | null>;
};

type SkillIcons = Partial<Record<SkillId, { src: string; alt: string }>>;

export function HudDragPreview({
  dragState,
  renderItemTile,
  skillIcons,
}: {
  dragState: DragState | null;
  renderItemTile: (args: RenderItemTileArgs) => ReactNode;
  skillIcons: SkillIcons;
}) {
  if (!dragState) {
    return null;
  }

  const skillIcon = dragState.skillId ? skillIcons[dragState.skillId] : null;

  return (
    <div
      className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2"
      style={{ left: dragState.pointerX, top: dragState.pointerY }}
    >
      <div className="rounded-xl border border-[#d8f1b4]/55 bg-[#17320d]/88 p-2 shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
        {dragState.itemId ? (
          renderItemTile({ itemValue: dragState.itemId })
        ) : dragState.skillId ? (
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[#f1b26a]/28 bg-[linear-gradient(180deg,rgba(95,41,18,0.82),rgba(46,20,10,0.88))]">
            {skillIcon ? (
              <img
                src={skillIcon.src}
                alt={skillIcon.alt}
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
  );
}

export function HudItemContextMenu({
  itemContextMenu,
  position,
  getPrimaryActionLabel,
  onPrimaryAction,
  onInspect,
  onDrop,
}: {
  itemContextMenu: ItemContextMenuState | null;
  position: TooltipPosition | null;
  getPrimaryActionLabel: (itemValue: string) => string;
  onPrimaryAction: (state: ItemContextMenuState) => void;
  onInspect: (state: ItemContextMenuState) => void;
  onDrop: (state: ItemContextMenuState) => void;
}) {
  if (!itemContextMenu) {
    return null;
  }

  return (
    <div
      className="fixed z-50 w-[200px] rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/94 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md"
      style={{
        left: position?.left ?? itemContextMenu.pointerX + 16,
        top: position?.top ?? itemContextMenu.pointerY + 16,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onPrimaryAction(itemContextMenu)}
        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#f4ffe8] transition hover:bg-[#294816]/72"
      >
        {getPrimaryActionLabel(itemContextMenu.itemValue)}
      </button>
      <button
        type="button"
        onClick={() => onInspect(itemContextMenu)}
        className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-[#f4ffe8] transition hover:bg-[#294816]/72"
      >
        Inspect
      </button>
      <button
        type="button"
        onClick={() => onDrop(itemContextMenu)}
        className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-[#ffd7c9] transition hover:bg-[#5a2318]/72"
      >
        Drop
      </button>
    </div>
  );
}

export function HudInspectWindow({
  inspectItem,
  inspectItemView,
  dragState,
  onClose,
  onInspectSocketMouseDown,
  onInspectSocketMouseUp,
  onInspectSocketClick,
  renderItemTile,
  showItemTooltip,
  moveItemTooltip,
  hideItemTooltip,
  windowClassName,
  sectionClassName,
}: {
  inspectItem: InspectItemState | null;
  inspectItemView: InspectItemView | null;
  dragState: DragState | null;
  onClose: () => void;
  onInspectSocketMouseDown: (
    socketGemValue: string | null,
    socketIndex: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onInspectSocketMouseUp: (socketIndex: number, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onInspectSocketClick: (socketIndex: number) => void;
  renderItemTile: (args: RenderItemTileArgs) => ReactNode;
  showItemTooltip: (
    itemValue: string,
    scope: HoveredItemState['scope'],
  ) => MouseEventHandler<HTMLElement>;
  moveItemTooltip: MouseEventHandler<HTMLElement>;
  hideItemTooltip: () => void;
  windowClassName: string;
  sectionClassName: string;
}) {
  if (!inspectItem || !inspectItemView) {
    return null;
  }

  return (
    <HudWindow
      title="Inspect"
      defaultPosition={{ left: 480, top: 180 }}
      storageKey="mmorpg.ui.inspect.position.v1"
      onClose={onClose}
      className={windowClassName}
    >
      <div className="space-y-4">
        <div className={sectionClassName}>
          <div
            className="flex items-center gap-3"
            onMouseEnter={showItemTooltip(inspectItem.itemValue, 'inspect')}
            onMouseMove={moveItemTooltip}
            onMouseLeave={hideItemTooltip}
          >
            {renderItemTile({
              itemValue: inspectItem.itemValue,
              socketCount: inspectItemView.socketCount,
              socketColors: inspectItemView.socketColors,
            })}
            <div>
              <div className="font-serif text-lg font-bold" style={{ color: inspectItemView.textColor }}>
                {inspectItemView.name}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#bfd8a4]">
                {inspectItemView.label}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {inspectItemView.lines.map((line) => (
              <span
                key={line}
                className="rounded border border-[#a8d96e]/25 bg-[#1a3510]/70 px-2 py-0.5 text-[11px] font-semibold text-[#9ecf68]"
              >
                {line}
              </span>
            ))}
          </div>
        </div>

        {inspectItemView.socketCount > 0 ? (
          <div className={sectionClassName}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bfd8a4]">
              Gem Slots
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: inspectItemView.socketCount }, (_, index) => {
                const socketGemValue = inspectItemView.socketGemValues[index] ?? null;

                return (
                  <button
                    key={index}
                    type="button"
                    onMouseEnter={socketGemValue ? showItemTooltip(socketGemValue, 'inspect') : undefined}
                    onMouseMove={socketGemValue ? moveItemTooltip : undefined}
                    onMouseLeave={socketGemValue ? hideItemTooltip : undefined}
                    onMouseDown={(event) => onInspectSocketMouseDown(socketGemValue, index, event)}
                    onMouseUp={(event) => onInspectSocketMouseUp(index, event)}
                    onClick={() => onInspectSocketClick(index)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d9efbd]/20 bg-[#102008]/72 transition hover:border-[#d8f1b4]/45"
                  >
                    {socketGemValue ? (
                      renderItemTile({
                        itemValue: socketGemValue,
                        compact: true,
                      })
                    ) : (
                      <span
                        className="h-4 w-4 rounded-full border border-[#102008]/90"
                        style={{
                          backgroundColor: inspectItemView.socketColors[index] ?? 'rgba(7,12,5,0.82)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#9fbc7f]">
              Drop gem on socket to insert. Click filled socket to remove.
            </div>
          </div>
        ) : null}
      </div>
    </HudWindow>
  );
}

export function HudItemTooltip({
  hoveredItem,
  tooltipView,
  position,
}: {
  hoveredItem: HoveredItemState | null;
  tooltipView: ItemTooltipView | null;
  position: TooltipPosition | null;
}) {
  if (!hoveredItem || !tooltipView) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-50 max-h-[calc(100vh-40px)] max-w-[220px] overflow-y-auto rounded-2xl border border-[#d9efbd]/30 bg-[#17320d]/94 px-4 py-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md"
      style={{
        left: position?.left ?? hoveredItem.pointerX + 16,
        top: position?.top ?? hoveredItem.pointerY + 16,
      }}
    >
      <div className="font-serif text-lg font-bold" style={{ color: tooltipView.textColor }}>
        {tooltipView.name}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#bfd8a4]">
        {tooltipView.label}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tooltipView.lines.map((line) => (
          <span
            key={line}
            className="rounded border border-[#a8d96e]/25 bg-[#1a3510]/70 px-2 py-0.5 text-[11px] font-semibold text-[#9ecf68]"
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HudSkillTooltip({
  hoveredSkill,
  tooltipView,
  position,
}: {
  hoveredSkill: HoveredSkillState | null;
  tooltipView: SkillTooltipView | null;
  position: TooltipPosition | null;
}) {
  if (!hoveredSkill || !tooltipView) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-50 max-h-[calc(100vh-40px)] max-w-[220px] overflow-y-auto rounded-2xl border border-[#f4b36b]/30 bg-[#2b140b]/94 px-4 py-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md"
      style={{
        left: position?.left ?? hoveredSkill.pointerX + 16,
        top: position?.top ?? hoveredSkill.pointerY + 16,
      }}
    >
      <div className="font-serif text-lg font-bold text-[#fff1d3]">{tooltipView.name}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tooltipView.lines.map((line) => (
          <span
            key={line}
            className="rounded border border-[#f4b36b]/30 bg-[#1f0e06]/70 px-2 py-0.5 text-[11px] font-semibold text-[#e8a85e]"
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
