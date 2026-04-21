import type { CastSkillMessage } from '@mmorpg/shared/realtime/contracts';
import type { MouseActionSlotKey, MouseSkillBindings, SkillId } from '@/components/game-hud/types';

const ACTION_BAR_STORAGE_KEY = 'mmorpg.ui.action-bar.bindings.v1';

function isStoredMouseSkillId(skillId: string | undefined): skillId is SkillId {
  return skillId === 'woodStaffStrike'
    || skillId === 'woodStaffChainStrike'
    || skillId === 'woodStaffDash'
    || skillId === 'woodStaffSlam'
    || skillId === 'woodStaffSpectralVolley'
    || skillId === 'woodStaffStormIncarnate'
    || skillId === 'woodStaffVoidFracture'
    || skillId === 'fireNova'
    || skillId === 'fireField';
}

export function readStoredMouseSkillBindings(): MouseSkillBindings {
  if (typeof window === 'undefined') {
    return { LMB: null, RMB: null };
  }

  try {
    const rawValue = window.localStorage.getItem(ACTION_BAR_STORAGE_KEY);
    if (!rawValue) {
      return { LMB: null, RMB: null };
    }

    const parsed = JSON.parse(rawValue) as Partial<
      Record<'LMB' | 'RMB', { kind?: string; skillId?: string } | null>
    >;

    return {
      LMB:
        parsed.LMB?.kind === 'skill' && isStoredMouseSkillId(parsed.LMB.skillId)
          ? parsed.LMB.skillId
          : null,
      RMB:
        parsed.RMB?.kind === 'skill' && isStoredMouseSkillId(parsed.RMB.skillId)
          ? parsed.RMB.skillId
          : null,
    };
  } catch {
    return { LMB: null, RMB: null };
  }
}

export function resolvePointerButtons(pointer: Phaser.Input.Pointer) {
  const pointerEvent = pointer.event as MouseEvent | PointerEvent | null | undefined;
  const eventButton = typeof pointerEvent?.button === 'number' ? pointerEvent.button : null;
  const eventButtons = typeof pointerEvent?.buttons === 'number' ? pointerEvent.buttons : null;

  return {
    isLeftButton:
      eventButton === 0 ||
      pointer.button === 0 ||
      (eventButtons !== null && (eventButtons & 1) !== 0) ||
      pointer.leftButtonDown(),
    isRightButton:
      eventButton === 2 ||
      pointer.button === 2 ||
      (eventButtons !== null && (eventButtons & 2) !== 0) ||
      pointer.rightButtonDown(),
  };
}

export function resolveMouseActionSlotKey(
  isLeftButton: boolean,
  isRightButton: boolean,
): MouseActionSlotKey | null {
  if (isLeftButton) {
    return 'LMB';
  }

  if (isRightButton) {
    return 'RMB';
  }

  return null;
}

export function createTimedCastSkillMessage(
  message: Omit<CastSkillMessage, 'clientEstimatedLatencyMs' | 'clientSentAt'>,
  estimatedOneWayLatencyMs: number,
): CastSkillMessage {
  const safeEstimatedLatencyMs = Math.max(0, Math.round(estimatedOneWayLatencyMs));

  return {
    ...message,
    ...(safeEstimatedLatencyMs > 0 ? { clientEstimatedLatencyMs: safeEstimatedLatencyMs } : {}),
    clientSentAt: Date.now(),
  };
}

type ActiveTargetingLike =
  | { type: 'skill'; skillId: 'fireball' | 'fireField' }
  | { type: 'consumable'; itemId: 'healing_potion' }
  | null;

type WorldEditorInputLike = {
  handlePointerDown: (pointer: Phaser.Input.Pointer, mouseSlotKey: MouseActionSlotKey | null) => boolean;
};

export function handleCanvasPointerDown({
  pointer,
  camera,
  worldEditorInput,
  currentTargeting,
  getMouseBoundSkill,
  castMouseBoundSkill,
  castFireball,
  castFireField,
  useHeldConsumableOnSelf,
  throwHeldConsumable,
  cancelSkillTarget,
}: {
  pointer: Phaser.Input.Pointer;
  camera: Phaser.Cameras.Scene2D.Camera;
  worldEditorInput: WorldEditorInputLike;
  currentTargeting: ActiveTargetingLike;
  getMouseBoundSkill: (slotKey: MouseActionSlotKey) => SkillId | null;
  castMouseBoundSkill: (skillId: SkillId, targetX: number, targetY: number) => void;
  castFireball: (targetX: number, targetY: number) => void;
  castFireField: (targetX: number, targetY: number) => void;
  useHeldConsumableOnSelf: (payload: { itemId: 'healing_potion' }) => void;
  throwHeldConsumable: (payload: { itemId: 'healing_potion'; x: number; y: number }) => void;
  cancelSkillTarget: () => void;
}) {
  const { isLeftButton, isRightButton } = resolvePointerButtons(pointer);
  const mouseSlotKey = resolveMouseActionSlotKey(isLeftButton, isRightButton);

  if (worldEditorInput.handlePointerDown(pointer, mouseSlotKey)) {
    return true;
  }

  if (currentTargeting) {
    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);

    if (currentTargeting.type === 'consumable') {
      pointer.event?.preventDefault();
      if (mouseSlotKey === 'LMB') {
        useHeldConsumableOnSelf({ itemId: currentTargeting.itemId });
      } else if (mouseSlotKey === 'RMB') {
        throwHeldConsumable({
          itemId: currentTargeting.itemId,
          x: worldPoint.x,
          y: worldPoint.y,
        });
      }
      return true;
    }

    if (mouseSlotKey === 'RMB') {
      pointer.event?.preventDefault();
      cancelSkillTarget();
      return true;
    }

    if (mouseSlotKey === 'LMB') {
      pointer.event?.preventDefault();
      if (currentTargeting.skillId === 'fireball') {
        castFireball(worldPoint.x, worldPoint.y);
      } else if (currentTargeting.skillId === 'fireField') {
        castFireField(worldPoint.x, worldPoint.y);
      }
      cancelSkillTarget();
      return true;
    }
  }

  if (!mouseSlotKey) {
    return false;
  }

  const boundSkill = getMouseBoundSkill(mouseSlotKey);
  if (!boundSkill) {
    return false;
  }

  pointer.event?.preventDefault();
  const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
  castMouseBoundSkill(boundSkill, worldPoint.x, worldPoint.y);
  return true;
}
