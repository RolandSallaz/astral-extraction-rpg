import type { ThrownConsumableMessage } from "@mmorpg/shared/realtime/contracts";

type DamageTextPayload = {
  x: number;
  y: number;
  text: string;
  color: string;
};

export interface RoomMessageBroadcaster {
  broadcast(type: string, payload: unknown): void;
}

export function broadcastDamageText(
  broadcaster: RoomMessageBroadcaster,
  x: number,
  y: number,
  text: string,
  color = "#ff5959",
) {
  const payload: DamageTextPayload = { x, y, text, color };
  broadcaster.broadcast("damageText", payload);
}

export function broadcastThrownConsumable(
  broadcaster: RoomMessageBroadcaster,
  payload: ThrownConsumableMessage,
) {
  broadcaster.broadcast("thrownConsumable", payload);
}
