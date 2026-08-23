import { z } from 'zod';

export const propertyImageParamsSchema = z
  .object({
    propertyId: z.uuid('Enter a valid property ID.'),
    imageId: z.uuid('Enter a valid property image ID.').optional(),
  })
  .strict();

export const updatePropertyImageSchema = z
  .object({
    is_cover: z.literal(true).optional(),
    display_order: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Set the cover image or provide a display order.',
  });
