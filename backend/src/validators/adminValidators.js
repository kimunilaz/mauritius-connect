import { z } from 'zod';
const uuid = z.string().uuid();
export const adminPage = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();
export const adminId = z.object({ id: uuid }).strict();
export const returnReason = z
  .object({ reason: z.string().trim().min(1).max(1000) })
  .strict();
