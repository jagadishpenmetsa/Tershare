export class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly maxPerSecond: number,
    private readonly windowMs = 1000,
  ) {}

  allow(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
    if (this.timestamps.length >= this.maxPerSecond) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  reset(): void {
    this.timestamps.length = 0;
  }
}
