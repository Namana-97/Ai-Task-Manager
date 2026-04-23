export class RateLimitExceededError extends Error {
  constructor(readonly resetInMs: number, message = 'AI is busy. Please try again shortly.') {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}
