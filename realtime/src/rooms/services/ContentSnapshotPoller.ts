import type { GameContentSnapshot, GameContentSnapshotVersion } from "@mmorpg/shared/content/snapshot";
import { readLocalContentVersion } from "./contentVersion.js";

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
  private initialLoadPromise: Promise<void> | null = null;
  private localVersionPromise: Promise<void> | null = null;

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

    this.initialLoadPromise = this.poll();
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

  getCurrentVersion() {
    return this.lastVersion;
  }

  async ensureLoaded() {
    if (this.lastVersion) {
      return;
    }

    if (!this.initialLoadPromise) {
      this.initialLoadPromise = this.poll();
    }

    await this.initialLoadPromise;
    if (!this.lastVersion) {
      await this.ensureLocalVersion();
    }
  }

  private async poll() {
    try {
      const versionResponse = await fetch(`${this.baseUrl}/game-configs/content-version`);
      if (!versionResponse.ok) {
        await this.ensureLocalVersion();
        return;
      }

      const versionPayload = (await versionResponse.json()) as GameContentSnapshotVersion;
      if (this.lastVersion && versionPayload.version === this.lastVersion) {
        return;
      }

      if (!this.options.onSnapshot) {
        this.lastVersion = versionPayload.version;
        return;
      }

      const snapshotResponse = await fetch(`${this.baseUrl}/game-configs/content-snapshot`);
      if (!snapshotResponse.ok) {
        await this.ensureLocalVersion();
        return;
      }

      const snapshot = (await snapshotResponse.json()) as GameContentSnapshot;
      this.lastVersion = snapshot.version;
      this.options.onSnapshot(snapshot);
    } catch {
      await this.ensureLocalVersion();
    } finally {
      this.initialLoadPromise = null;
    }
  }

  private async ensureLocalVersion() {
    if (this.lastVersion) {
      return;
    }

    if (!this.localVersionPromise) {
      this.localVersionPromise = readLocalContentVersion()
        .then((version) => {
          this.lastVersion = version;
        })
        .catch(() => {
          // Local game-data may be temporarily unavailable during setup.
        })
        .finally(() => {
          this.localVersionPromise = null;
        });
    }

    await this.localVersionPromise;
  }
}
