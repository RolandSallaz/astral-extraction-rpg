/**
 * Periodically polls the NestJS backend for balance config changes
 * so that live rooms always reflect the latest admin updates.
 *
 * Without this, balance changes only took effect when a new room
 * was created — players in existing rooms would see stale values.
 */

const DEFAULT_POLL_INTERVAL_MS = 30_000; // 30 seconds

export type BalancePollerOptions = {
  /** How often to poll the backend (ms).  Defaults to 30 s. */
  intervalMs?: number;
  /** Explicit backend base URL override. */
  baseUrl?: string;
  /** Called when new skill balance data arrives. */
  onSkillBalance?: (data: Record<string, unknown>) => void;
  /** Called when new mob balance data arrives. */
  onMobBalance?: (data: Record<string, unknown>) => void;
  /** Called when new item balance data arrives. */
  onItemBalance?: (data: Record<string, unknown>) => void;
};

export class BalancePoller {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly baseUrl: string;
  private readonly options: BalancePollerOptions;

  constructor(options: BalancePollerOptions = {}) {
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

    // Initial fetch
    void this.poll();

    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async poll() {
    await Promise.allSettled([
      this.fetchEndpoint("/game-configs/skill-balance", this.options.onSkillBalance),
      this.fetchEndpoint("/game-configs/mob-balance", this.options.onMobBalance),
      this.fetchEndpoint("/game-configs/item-balance", this.options.onItemBalance),
    ]);
  }

  private async fetchEndpoint(
    path: string,
    callback: ((data: Record<string, unknown>) => void) | undefined,
  ) {
    if (!callback) {
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as Record<string, unknown>;
      callback(data);
    } catch {
      // Backend may be temporarily unreachable — silently retry
      // on the next poll interval.
    }
  }
}
