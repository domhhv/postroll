/**
 * Spaces out calls to stay under a requests-per-second budget, across all
 * concurrent callers in this process. The concurrency setting only caps how
 * many sends are in flight, and fast responses would otherwise burst past
 * Resend's limit (2 requests per second per team by default) and turn into
 * 429 retries.
 */
export class SendPacer {
  private nextSlot = 0;

  private readonly intervalMs: number;

  constructor(requestsPerSecond: number) {
    this.intervalMs = 1000 / requestsPerSecond;
  }

  /** Resolves when the caller may send. Returns how long it waited, in milliseconds. */
  async wait(): Promise<number> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.intervalMs;
    const waitMs = slot - now;

    if (waitMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }

    return waitMs;
  }
}
