import type {
  CastSkillMessage,
  MoveMessage,
  SyncChestMessage,
  UseExitMessage,
  UseConsumableMessage,
} from "@mmorpg/shared/realtime/contracts";
import {
  castSkillMessageSchema,
  moveMessageSchema,
  syncChestMessageSchema,
  useConsumableMessageSchema,
  useExitMessageSchema,
} from "@mmorpg/shared/realtime/contracts";

const MAX_INPUT_COMPONENT = 1;
const MAX_SEQUENCE = 2_147_483_647;
const MAX_CONTENT_VERSION_LENGTH = 128;
const MAX_SKILL_ID_LENGTH = 64;
const MAX_CONTAINER_ID_LENGTH = 128;
const MAX_CLIENT_LATENCY_MS = 10_000;
const MAX_CLIENT_SENT_AT = 9_999_999_999_999;
const MIN_WORLD_COORDINATE = -1_000_000;
const MAX_WORLD_COORDINATE = 1_000_000;

function normalizeFiniteNumber(
  value: unknown,
  minValue: number,
  maxValue: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(minValue, Math.min(maxValue, value));
}

function normalizeOptionalFiniteNumber(
  value: unknown,
  minValue: number,
  maxValue: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(minValue, Math.min(maxValue, value));
}

function normalizeOptionalInteger(
  value: unknown,
  minValue: number,
  maxValue: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(minValue, Math.min(maxValue, Math.floor(value)));
}

export function normalizeMoveMessage(message: MoveMessage | null | undefined) {
  const parsed = moveMessageSchema.safeParse(message);
  if (!parsed.success) {
    return null;
  }

  const nextMessage = parsed.data;
  return {
    x: normalizeFiniteNumber(nextMessage.x, -MAX_INPUT_COMPONENT, MAX_INPUT_COMPONENT),
    y: normalizeFiniteNumber(nextMessage.y, -MAX_INPUT_COMPONENT, MAX_INPUT_COMPONENT),
    sequence:
      typeof nextMessage.sequence === "number" && Number.isFinite(nextMessage.sequence)
        ? Math.max(0, Math.min(MAX_SEQUENCE, Math.floor(nextMessage.sequence)))
        : 0,
    clientEstimatedLatencyMs: normalizeOptionalInteger(
      nextMessage.clientEstimatedLatencyMs,
      0,
      MAX_CLIENT_LATENCY_MS,
    ),
  };
}

export function normalizeContentVersion(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_CONTENT_VERSION_LENGTH);
}

export function normalizeCastSkillMessage(
  message: CastSkillMessage | null | undefined,
): CastSkillMessage | null {
  const parsed = castSkillMessageSchema.safeParse(message);
  if (!parsed.success) {
    return null;
  }

  const nextMessage = parsed.data;
  return {
    skillId:
      typeof nextMessage.skillId === "string"
        ? nextMessage.skillId.trim().slice(0, MAX_SKILL_ID_LENGTH)
        : "",
    targetX: normalizeOptionalFiniteNumber(nextMessage.targetX, MIN_WORLD_COORDINATE, MAX_WORLD_COORDINATE),
    targetY: normalizeOptionalFiniteNumber(nextMessage.targetY, MIN_WORLD_COORDINATE, MAX_WORLD_COORDINATE),
    clientEstimatedLatencyMs: normalizeOptionalInteger(
      nextMessage.clientEstimatedLatencyMs,
      0,
      MAX_CLIENT_LATENCY_MS,
    ),
    clientSentAt: normalizeOptionalInteger(nextMessage.clientSentAt, 0, MAX_CLIENT_SENT_AT),
  };
}

export function normalizeUseConsumableMessage(
  message: UseConsumableMessage | null | undefined,
): UseConsumableMessage | null {
  const parsed = useConsumableMessageSchema.safeParse(message);
  if (!parsed.success) {
    return null;
  }

  const nextMessage = parsed.data;
  return {
    source: nextMessage.source === "container" ? "container" : "inventory",
    slotIndex: normalizeOptionalInteger(nextMessage.slotIndex, 0, MAX_SEQUENCE),
    containerId:
      typeof nextMessage.containerId === "string"
        ? nextMessage.containerId.trim().slice(0, MAX_CONTAINER_ID_LENGTH)
        : undefined,
    mode: nextMessage.mode === "throw" ? "throw" : "self",
    targetX: normalizeOptionalFiniteNumber(nextMessage.targetX, MIN_WORLD_COORDINATE, MAX_WORLD_COORDINATE),
    targetY: normalizeOptionalFiniteNumber(nextMessage.targetY, MIN_WORLD_COORDINATE, MAX_WORLD_COORDINATE),
  };
}

export function normalizeSyncChestMessage(
  message: SyncChestMessage | null | undefined,
): SyncChestMessage | null {
  const parsed = syncChestMessageSchema.safeParse(message);
  if (!parsed.success) {
    return null;
  }

  return {
    chestId:
      typeof parsed.data.chestId === "string"
        ? parsed.data.chestId.trim().slice(0, MAX_CONTAINER_ID_LENGTH)
        : undefined,
    slots: parsed.data.slots ? [...parsed.data.slots] : undefined,
  };
}

export function normalizeUseExitMessage(
  message: UseExitMessage | null | undefined,
): UseExitMessage | null {
  const parsed = useExitMessageSchema.safeParse(message);
  if (!parsed.success) {
    return null;
  }

  return {
    exitId:
      typeof parsed.data.exitId === "string"
        ? parsed.data.exitId.trim().slice(0, MAX_CONTAINER_ID_LENGTH)
        : undefined,
  };
}
