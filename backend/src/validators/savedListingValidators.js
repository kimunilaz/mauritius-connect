import { z } from 'zod';

export const savedListingIdParamsSchema = z
  .object({ listingId: z.uuid('Enter a valid listing ID.') })
  .strict();

export const savedListingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const emptySavedListingBodySchema = z.object({}).strict().default({});
