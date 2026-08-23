import { z } from 'zod';

export const conversationParamsSchema = z
  .object({ conversationId: z.uuid('Enter a valid conversation ID.') })
  .strict();

export const conversationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const emptyConversationBodySchema = z.object({}).strict().default({});
