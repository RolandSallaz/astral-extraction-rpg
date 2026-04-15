import { Room } from "colyseus";

type DamageTextPayload = {
  x: number;
  y: number;
  text: string;
  color: string;
};

export function broadcastDamageText(
  room: Room,
  x: number,
  y: number,
  text: string,
  color = "#ff5959",
) {
  const payload: DamageTextPayload = { x, y, text, color };
  room.broadcast("damageText", payload);
}
