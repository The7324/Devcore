interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly buckets = new Map<number, Bucket>();

  constructor(
    private readonly maxTokens: number,
    private readonly windowMs: number,
  ) {}

  check(userId: number, cost = 1): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - cost, lastRefill: now };
      this.buckets.set(userId, bucket);
      return { allowed: true };
    }

    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor(elapsed / this.windowMs) * this.maxTokens;
    if (refill > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < cost) {
      const msUntilRefill = bucket.tokens < this.maxTokens
        ? this.windowMs - (elapsed % this.windowMs)
        : 0;
      return { allowed: false, retryAfterMs: msUntilRefill };
    }

    bucket.tokens -= cost;
    return { allowed: true };
  }

  reset(userId: number): void {
    this.buckets.delete(userId);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, bucket] of this.buckets) {
      if (now - bucket.lastRefill > this.windowMs * 2) {
        this.buckets.delete(id);
      }
    }
  }

  get activeUsers(): number {
    this.cleanup();
    return this.buckets.size;
  }
}
