import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

const buckets = new Map();
function identity(request) {
  const authorization = request.get('authorization') ?? '';
  const tokenKey = authorization
    ? crypto.createHash('sha256').update(authorization).digest('hex')
    : '';
  return `${request.ip}|${tokenKey}`;
}
export function createRateLimiter({
  limit,
  windowMs = env.rateLimitWindowMs,
  key = identity,
} = {}) {
  return (request, response, next) => {
    const now = Date.now();
    const bucketKey = key(request);
    const current = buckets.get(bucketKey);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);
    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.set('Retry-After', String(retryAfter));
      next(
        new AppError({
          statusCode: 429,
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Try again later.',
        }),
      );
      return;
    }
    next();
  };
}
export function resetRateLimiterForTests() {
  buckets.clear();
}
