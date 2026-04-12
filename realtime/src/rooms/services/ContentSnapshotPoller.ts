import type { GameContentSnapshot, GameContentSnapshotVersion } from "@mmorpg/shared/content/snapshot";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

export type ContentSnapshotPollerOptions = {
  intervalMs?: number;
  baseUrl?: string;
  onSnapshot?: (snapshot: GameContentSnapshot) => void;
};

export class ContentSnapshotPoller {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly baseUrl: string;
  private readonly options: ContentSnapshotPollerOptions;
  private lastVersion = "";

  constructor(options: ContentSnapshotPollerOptions = {}) {
    this.intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.baseUrl =
      options.baseUrl ??
      process.env.BACKEND_URL ??
      process.env.BACKEND_API_URL ??
      "http://localhost:3000";
    this.options = options;
  }

  start() {
    if (this.intervalHandle) {
      return;
    }

    void this.poll();
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
  }

  stop() {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  private async poll() {
    if (!this.options.onSnapshot) {
      return;
    }

    try {
      const versionResponse = await fetch(`${this.baseUrl}/game-configs/content-version`);
      if (!versionResponse.ok) {
        return;
      }

      const versionPayload = (await versionResponse.json()) as GameContentSnapshotVersion;
      if (this.lastVersion && versionPayload.version === this.lastVersion) {
        return;
      }

      const snapshotResponse = await fetch(`${this.baseUrl}/game-configs/content-snapshot`);
      if (!snapshotResponse.ok) {
        return;
      }

      const snapshot = (await snapshotResponse.json()) as GameContentSnapshot;
      this.lastVersion = snapshot.version;
      this.options.onSnapshot(snapshot);
    } catch {
      // Backend may be temporarily unreachable; retry on the next interval.
    }
  }
}
