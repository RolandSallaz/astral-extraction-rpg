import { readLocalContentVersion } from "../../src/rooms/services/contentVersion.js";

type JoinOptions = Record<string, unknown>;

export async function connectToRoom<TColyseus extends { connectTo: (...args: any[]) => Promise<any> }>(
  colyseus: TColyseus,
  room: Parameters<TColyseus["connectTo"]>[0],
  options: JoinOptions = {},
) {
  return colyseus.connectTo(room, {
    ...options,
    contentVersion: await readLocalContentVersion(),
  }) as Promise<Awaited<ReturnType<TColyseus["connectTo"]>>>;
}
