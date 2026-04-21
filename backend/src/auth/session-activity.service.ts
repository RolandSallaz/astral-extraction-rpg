import { Injectable } from '@nestjs/common';

const SESSION_ACTIVITY_TTL_MS = 15_000;

type ActiveSessionRecord = {
  token: string;
  lastSeenAt: number;
};

@Injectable()
export class SessionActivityService {
  private readonly sessionsByPlayerId = new Map<string, ActiveSessionRecord>();

  touch(playerId: string, token: string, now = Date.now()) {
    this.sessionsByPlayerId.set(playerId, {
      token,
      lastSeenAt: now,
    });
  }

  replacePlayerSession(playerId: string, token: string, now = Date.now()) {
    this.touch(playerId, token, now);
  }

  isPlayerActive(playerId: string, now = Date.now()) {
    this.prune(now);
    return this.sessionsByPlayerId.has(playerId);
  }

  invalidatePlayer(playerId: string) {
    this.sessionsByPlayerId.delete(playerId);
  }

  private prune(now: number) {
    for (const [playerId, session] of this.sessionsByPlayerId.entries()) {
      if (session.lastSeenAt + SESSION_ACTIVITY_TTL_MS > now) {
        continue;
      }

      this.sessionsByPlayerId.delete(playerId);
    }
  }
}
