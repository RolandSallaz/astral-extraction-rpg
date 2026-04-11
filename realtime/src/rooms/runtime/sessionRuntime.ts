import { type Client } from "colyseus";
import {
  applyVerifiedProfile,
  verifySessionToken,
  type VerifiedPlayer,
} from "../auth.js";

type SessionCollection = {
  delete(key: string): unknown;
};

type AggroReference = {
  aggroTargetId: string;
};

type OwnedReference = {
  ownerId: string;
};

type VerifiedProfileTarget = Parameters<typeof applyVerifiedProfile>[0];

export function resolveVerifiedRoomAuthResult(
  authResult?: VerifiedPlayer | boolean | null,
) {
  return authResult && typeof authResult === "object"
    ? authResult as VerifiedPlayer
    : null;
}

export function refreshVerifiedRoomProfile(options: {
  sessionToken: unknown;
  sessionId: string;
  verifiedPlayers: Map<string, VerifiedPlayer>;
  player: VerifiedProfileTarget;
}) {
  if (typeof options.sessionToken !== "string" || !options.sessionToken) {
    return;
  }

  void verifySessionToken(options.sessionToken)
    .then((verified) => {
      options.verifiedPlayers.set(options.sessionId, verified);
      applyVerifiedProfile(options.player, verified);
    })
    .catch(() => {
      // Keep the current room state when token refresh fails.
    });
}

export function sendRoomBalanceSnapshots(
  client: Pick<Client, "send">,
  skillBalanceConfig: unknown,
  mobBalanceConfig: unknown,
) {
  client.send("skillBalanceConfig", skillBalanceConfig);
  client.send("mobBalanceConfig", mobBalanceConfig);
}

export function moveRoomMapValue<T>(
  map: Map<string, T>,
  fromId: string,
  toId: string,
) {
  if (fromId === toId) {
    return;
  }

  const value = map.get(fromId);
  map.delete(fromId);
  if (value !== undefined) {
    map.set(toId, value);
  }
}

export function clearRoomSessionCollections(
  sessionId: string,
  ...collections: Array<SessionCollection | undefined>
) {
  collections.forEach((collection) => {
    collection?.delete(sessionId);
  });
}

export function transferRoomOwnedReferences(options: {
  fromId: string;
  toId: string;
  mobs?: Iterable<AggroReference>;
  projectiles?: Iterable<OwnedReference>;
  groundEffects?: Iterable<OwnedReference>;
  pendingBurstSpawns?: Iterable<OwnedReference>;
  pendingAftershocks?: Iterable<OwnedReference>;
}) {
  const { fromId, toId } = options;
  if (fromId === toId) {
    return;
  }

  for (const mob of options.mobs ?? []) {
    if (mob.aggroTargetId === fromId) {
      mob.aggroTargetId = toId;
    }
  }

  for (const ownedReference of options.projectiles ?? []) {
    if (ownedReference.ownerId === fromId) {
      ownedReference.ownerId = toId;
    }
  }

  for (const ownedReference of options.groundEffects ?? []) {
    if (ownedReference.ownerId === fromId) {
      ownedReference.ownerId = toId;
    }
  }

  for (const ownedReference of options.pendingBurstSpawns ?? []) {
    if (ownedReference.ownerId === fromId) {
      ownedReference.ownerId = toId;
    }
  }

  for (const ownedReference of options.pendingAftershocks ?? []) {
    if (ownedReference.ownerId === fromId) {
      ownedReference.ownerId = toId;
    }
  }
}
