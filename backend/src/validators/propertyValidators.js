import { z } from 'zod';

export const PROPERTY_TYPES = Object.freeze([
  'APARTMENT',
  'HOUSE',
  'STUDIO',
  'ROOM',
  'TOWNHOUSE',
  'VILLA',
  'OTHER',
]);

const requiredText = (maximum) =>
  z.string().trim().min(1, 'This field is required.').max(maximum);
const optionalText = (maximum) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .transform((value) => (value === '' ? null : value))
    .optional();
const optionalCoordinate = (minimum, maximum) =>
  z.number().min(minimum).max(maximum).nullable().optional();

const propertyFields = {
  property_type: z.enum(PROPERTY_TYPES),
  address_line_1: optionalText(250),
  address_line_2: optionalText(250),
  district: requiredText(100),
  locality: requiredText(150),
  neighbourhood: optionalText(150),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().min(0).max(99.9),
  furnished: z.boolean().optional(),
  parking_spaces: z.number().int().min(0).optional(),
};

export const createPropertySchema = z.object(propertyFields).strict();

export const updatePropertySchema = z
  .object({
    ...propertyFields,
    property_type: propertyFields.property_type.optional(),
    district: propertyFields.district.optional(),
    locality: propertyFields.locality.optional(),
    bedrooms: propertyFields.bedrooms.optional(),
    bathrooms: propertyFields.bathrooms.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const propertyIdParamsSchema = z
  .object({ propertyId: z.uuid('Enter a valid property ID.') })
  .strict();

export const propertyListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    archived: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .strict();
