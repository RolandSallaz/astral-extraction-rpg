import type { DragSource } from '@/components/game-hud/types';

export function isSameDragSource(left: DragSource, right: DragSource): boolean {
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
