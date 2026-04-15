type PositionSample = {
  at: number;
  x: number;
  y: number;
};

type PositionCarrier = {
  id: string;
  x: number;
  y: number;
};

type RecordOptions = {
  historyDurationMs: number;
  minSampleIntervalMs: number;
};

export class LagCompensationTracker<TPlayer extends PositionCarrier = PositionCarrier> {
  private readonly historyByPlayer = new Map<string, PositionSample[]>();

  record(players: Iterable<TPlayer>, now: number, options: RecordOptions) {
    const keepAfter = now - Math.max(0, options.historyDurationMs);
    const activeIds = new Set<string>();

    for (const player of players) {
      activeIds.add(player.id);
      const history = this.historyByPlayer.get(player.id) ?? [];
      const last = history[history.length - 1];
      if (
        !last ||
        last.x !== player.x ||
        last.y !== player.y ||
        now - last.at >= options.minSampleIntervalMs
      ) {
        history.push({
          at: now,
          x: player.x,
          y: player.y,
        });
      }

      while (history.length > 1 && history[1]!.at < keepAfter) {
        history.shift();
      }
      this.historyByPlayer.set(player.id, history);
    }

    for (const playerId of Array.from(this.historyByPlayer.keys())) {
      if (!activeIds.has(playerId)) {
        this.historyByPlayer.delete(playerId);
      }
    }
  }

  getPositionAt(playerId: string, at: number): { x: number; y: number } | null {
    const history = this.historyByPlayer.get(playerId);
    if (!history || history.length === 0) {
      return null;
    }

    if (at <= history[0]!.at) {
      return {
        x: history[0]!.x,
        y: history[0]!.y,
      };
    }

    for (let index = history.length - 1; index >= 0; index -= 1) {
      const current = history[index]!;
      if (current.at > at) {
        continue;
      }

      const next = history[index + 1];
      if (!next) {
        return {
          x: current.x,
          y: current.y,
        };
      }

      const span = Math.max(1, next.at - current.at);
      const t = Math.max(0, Math.min(1, (at - current.at) / span));
      return {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
    }

    return null;
  }

  clearPlayer(playerId: string) {
    this.historyByPlayer.delete(playerId);
  }

  clearAll() {
    this.historyByPlayer.clear();
  }
}
