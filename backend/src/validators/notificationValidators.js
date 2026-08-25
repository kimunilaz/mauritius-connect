import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread_only: z
    .union([z.boolean(), z.string().transform((value) => value === 'true')])
    .default(false),
});

export const notificationParamsSchema = z.object({
  notificationId: z.string().uuid(),
});
