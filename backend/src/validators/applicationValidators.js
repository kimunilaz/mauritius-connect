import { z } from 'zod';

export const APPLICATION_STATUSES = Object.freeze([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'VIEWING_INVITED',
  'VIEWING_COMPLETED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
]);

export const LANDLORD_VISIBLE_APPLICATION_STATUSES = Object.freeze(
  APPLICATION_STATUSES.filter((status) => status !== 'DRAFT'),
);

const optionalDate = z.iso.date('Enter a valid date.').nullable().optional();
const optionalPositiveInteger = z
  .number()
  .int('Enter a whole number.')
  .positive('Enter a positive number.')
  .nullable()
  .optional();

const draftFields = {
  move_in_date: optionalDate,
  requested_lease_duration_months: optionalPositiveInteger,
  number_of_occupants: optionalPositiveInteger,
  introductory_message: z.string().trim().max(2000).nullable().optional(),
};

export const createApplicationDraftSchema = z.object(draftFields).strict();

export const updateApplicationDraftSchema = z
  .object(draftFields)
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one draft field to update.',
  });

export const applicationListingParamsSchema = z
  .object({ listingId: z.uuid('Enter a valid listing ID.') })
  .strict();

export const applicationParamsSchema = z
  .object({ applicationId: z.uuid('Enter a valid application ID.') })
  .strict();

export const tenantApplicationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(APPLICATION_STATUSES).optional(),
  })
  .strict();

export const landlordApplicationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(LANDLORD_VISIBLE_APPLICATION_STATUSES).optional(),
  })
  .strict();
