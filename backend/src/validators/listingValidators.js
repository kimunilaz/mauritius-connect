import { z } from 'zod';

export const LISTING_STATUSES = Object.freeze([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
  'RENTED',
  'CLOSED',
]);

const requiredText = (maximum) =>
  z.string().trim().min(1, 'This field is required.').max(maximum);
const optionalMoney = z.number().min(0).max(9_999_999_999.99).nullable();
const optionalPositiveInteger = z.number().int().min(1).nullable();

const editableListingFields = {
  title: requiredText(200),
  description: requiredText(5000),
  monthly_rent: z.number().positive().max(9_999_999_999.99),
  deposit_amount: optionalMoney.optional(),
  available_from: z.iso.date(),
  minimum_lease_months: optionalPositiveInteger.optional(),
  maximum_occupants: optionalPositiveInteger.optional(),
  pets_allowed: z.boolean().optional(),
};

export const createListingSchema = z
  .object({
    property_id: z.uuid('Enter a valid property ID.'),
    ...editableListingFields,
  })
  .strict();

export const updateListingSchema = z
  .object({
    title: editableListingFields.title.optional(),
    description: editableListingFields.description.optional(),
    monthly_rent: editableListingFields.monthly_rent.optional(),
    deposit_amount: editableListingFields.deposit_amount,
    available_from: editableListingFields.available_from.optional(),
    minimum_lease_months: editableListingFields.minimum_lease_months,
    maximum_occupants: editableListingFields.maximum_occupants,
    pets_allowed: editableListingFields.pets_allowed,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one listing field to update.',
  });

export const listingIdParamsSchema = z
  .object({ listingId: z.uuid('Enter a valid listing ID.') })
  .strict();

export const listingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(LISTING_STATUSES).optional(),
  })
  .strict();
