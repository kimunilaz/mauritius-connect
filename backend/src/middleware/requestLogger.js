import { performance } from 'node:perf_hooks';
import { env } from '../config/env.js';

export function requestLogger(request, response, next) {
  if (env.nodeEnv === 'test') {
    next();
    return;
  }

  const startedAt = performance.now();

  response.on('finish', () => {
    const duration = Math.round(performance.now() - startedAt);
    console.log(
      `${request.method} ${request.path} ${response.statusCode} ${duration}ms`,
    );
  });

  next();
}
