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
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const variables = result.error.issues
    .map((issue) => issue.path.join('.'))
    .filter(Boolean)
    .join(', ');

  throw new Error(`Invalid environment configuration: ${variables}.`);
}

export const env = Object.freeze({
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  frontendUrl: result.data.FRONTEND_URL,
  supabaseUrl: result.data.SUPABASE_URL,
  supabasePublishableKey: result.data.SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: result.data.SUPABASE_SECRET_KEY,
  databaseUrl: result.data.DATABASE_URL,
});
