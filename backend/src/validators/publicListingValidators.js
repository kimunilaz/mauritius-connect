import { z } from 'zod';

export const PUBLIC_PROPERTY_TYPES = Object.freeze([
  'APARTMENT',
  'HOUSE',
  'STUDIO',
  'ROOM',
  'TOWNHOUSE',
  'VILLA',
  'OTHER',
]);

export const PUBLIC_LISTING_SORTS = Object.freeze([
  'newest',
  'rent_low',
  'rent_high',
  'available_soon',
]);

const optionalNumber = (schema) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );

const location = z.string().trim().min(1).max(100).optional();
const strictBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const publicListingSearchQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    district: location,
    locality: location,
    neighbourhood: location,
    property_type: z.enum(PUBLIC_PROPERTY_TYPES).optional(),
    min_rent: optionalNumber(z.coerce.number().min(0).max(9_999_999_999.99)),
    max_rent: optionalNumber(z.coerce.number().min(0).max(9_999_999_999.99)),
    bedrooms: optionalNumber(z.coerce.number().int().min(0).max(100)),
    bathrooms: optionalNumber(
      z.coerce
        .number()
        .min(0)
        .max(99.9)
        .refine((value) => Number.isInteger(value * 10), {
          message: 'Bathrooms may use at most one decimal place.',
        }),
    ),
    furnished: strictBoolean,
    pets_allowed: strictBoolean,
    available_from: z.iso.date().optional(),
    sort: z.enum(PUBLIC_LISTING_SORTS).default('newest'),
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.min_rent !== undefined &&
      query.max_rent !== undefined &&
      query.min_rent > query.max_rent
    ) {
      context.addIssue({
        code: 'custom',
        path: ['max_rent'],
        message: 'Maximum rent must be greater than or equal to minimum rent.',
      });
    }
  });

export const publicListingIdParamsSchema = z
  .object({ listingId: z.uuid('Enter a valid listing ID.') })
  .strict();
