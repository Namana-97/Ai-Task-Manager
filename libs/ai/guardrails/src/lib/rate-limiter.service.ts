import { Injectable } from '@nestjs/common';
import { RateLimitResult } from './types';

interface InMemoryWindowStore {
  [userId: string]: number[];
}

@Injectable()
export class SlidingWindowRateLimiter {
  private readonly maxRequests = Number(process.env.MAX_CHAT_REQUESTS_PER_MINUTE ?? 20);
  private readonly windowMs = 60_000;
  private readonly store: InMemoryWindowStore = {};

  checkRateLimit(userId: string): RateLimitResult {
    const now = Date.now();
    const window = (this.store[userId] ?? []).filter((entry) => now - entry < this.windowMs);

    if (window.length >= this.maxRequests) {
      const resetInMs = this.windowMs - (now - window[0]);
      this.store[userId] = window;
      return {
        allowed: false,
        remainingRequests: 0,
        resetInMs
      };
    }

    window.push(now);
    this.store[userId] = window;
    return {
      allowed: true,
      remainingRequests: this.maxRequests - window.length,
      resetInMs: window.length ? this.windowMs - (now - window[0]) : this.windowMs
    };
  }
}
