import { type CastSkillMessage } from "@mmorpg/shared/realtime/contracts";
import { type RoomGameplayProfile } from "@mmorpg/shared/gameplay/profiles";
import { LagCompensationTracker } from "../systems/LagCompensationTracker.js";

export type LagCompensatedCastTiming = {
  at: number;
  enabled: boolean;
};

export function resolveLagCompensatedCastTiming(
  profile: RoomGameplayProfile,
  message: CastSkillMessage,
  now: number,
): LagCompensatedCastTiming {
  const maxRewindMs = Math.max(0, profile.lagCompensationMaxRewindMs);
  const estimatedLatencyMs = Number.isFinite(message.clientEstimatedLatencyMs)
    ? Math.floor(message.clientEstimatedLatencyMs!)
    : NaN;
  if (Number.isFinite(estimatedLatencyMs)) {
    const rewindMs = Math.max(0, Math.min(maxRewindMs, estimatedLatencyMs));
    return rewindMs > 0
      ? { at: now - rewindMs, enabled: true }
      : { at: now, enabled: false };
  }

  const clientSentAt = Number.isFinite(message.clientSentAt)
    ? Math.floor(message.clientSentAt!)
    : NaN;
  if (!Number.isFinite(clientSentAt)) {
    return { at: now, enabled: false };
  }

  const ageMs = now - clientSentAt;
  if (ageMs < 0 || ageMs > maxRewindMs) {
    return { at: now, enabled: false };
  }

  return { at: clientSentAt, enabled: true };
}

type PositionCarrier = {
  id: string;
  x: number;
  y: number;
};

export function recordPlayerPositionHistory<TPlayer extends PositionCarrier>(
  tracker: LagCompensationTracker<TPlayer>,
  players: Iterable<TPlayer>,
  now: number,
  options: { historyDurationMs: number; minSampleIntervalMs: number },
) {
  tracker.record(players, now, options);
}

export function getPlayerPositionAt<TPlayer extends PositionCarrier>(
  tracker: LagCompensationTracker<TPlayer>,
  playerId: string,
  at: number,
) {
  return tracker.getPositionAt(playerId, at);
}
