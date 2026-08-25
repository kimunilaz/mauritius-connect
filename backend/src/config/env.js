import 'dotenv/config';
import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.url().optional(),
);

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SECRET_KEY: optionalString,
  DATABASE_URL: optionalUrl,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_GLOBAL: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_SENSITIVE: z.coerce.number().int().positive().default(60),
});

const productionRequiredVariables = [
  'FRONTEND_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
];

function isHttpsUrl(value) {
  return new globalThis.URL(value).protocol === 'https:';
}

function isOriginOnly(value) {
  const url = new globalThis.URL(value);

  return (
    url.origin === value.replace(/\/$/, '') &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}

export function parseEnvironment(source) {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const variables = result.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean)
      .join(', ');

    throw new Error(`Invalid environment configuration: ${variables}.`);
  }

  if (result.data.NODE_ENV === 'production') {
    const missing = productionRequiredVariables.filter(
      (name) =>
        result.data[name] === undefined ||
        source[name] === undefined ||
        source[name] === '',
    );

    if (missing.length > 0) {
      throw new Error(
        `Production environment configuration is missing: ${missing.join(', ')}.`,
      );
    }

    if (!isHttpsUrl(result.data.FRONTEND_URL)) {
      throw new Error('FRONTEND_URL must use HTTPS in production.');
    }

    if (!isOriginOnly(result.data.FRONTEND_URL)) {
      throw new Error(
        'FRONTEND_URL must be one exact origin without a path, query, or fragment.',
      );
    }

    if (!isHttpsUrl(result.data.SUPABASE_URL)) {
      throw new Error('SUPABASE_URL must use HTTPS in production.');
    }
  }

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    frontendUrl: result.data.FRONTEND_URL.replace(/\/$/, ''),
    supabaseUrl: result.data.SUPABASE_URL,
    supabasePublishableKey: result.data.SUPABASE_PUBLISHABLE_KEY,
    supabaseSecretKey: result.data.SUPABASE_SECRET_KEY,
    databaseUrl: result.data.DATABASE_URL,
    rateLimitWindowMs: result.data.RATE_LIMIT_WINDOW_MS,
    rateLimitGlobal: result.data.RATE_LIMIT_GLOBAL,
    rateLimitSensitive: result.data.RATE_LIMIT_SENSITIVE,
  });
}

export const env = parseEnvironment(process.env);
