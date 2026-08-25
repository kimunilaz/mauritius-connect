import { z } from 'zod';

export const messageListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const messageBodySchema = z
  .object({ body: z.string().trim().min(1).max(4000) })
  .strict();

export const emptyReadBodySchema = z.object({}).strict().default({});
