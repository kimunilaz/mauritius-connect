import { z } from 'zod';

const nullableTrimmedString = (maximum) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .transform((value) => (value === '' ? null : value))
    .optional();

const validDate = z
  .union([
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date in YYYY-MM-DD format.')
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      }, 'Enter a valid date in YYYY-MM-DD format.'),
    z.null(),
  ])
  .optional();

function nonEmptyPatch(schema) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });
}

export const tenantProfilePatchSchema = nonEmptyPatch(
  z
    .object({
      occupation_type: nullableTrimmedString(100),
      employer_or_school: nullableTrimmedString(200),
      income_range: nullableTrimmedString(100),
      preferred_move_date: validDate,
      preferred_lease_duration_months: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional(),
      number_of_occupants: z.number().int().min(1).nullable().optional(),
      has_pets: z.boolean().optional(),
      bio: nullableTrimmedString(1000),
    })
    .strict(),
);

const requiredName = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(100);
const optionalPhone = z
  .union([
    z
      .string()
      .trim()
      .max(30)
      .regex(/^\+?[0-9 ()-]{7,30}$/, 'Enter a valid phone number.'),
    z.null(),
  ])
  .optional();

export const baseProfilePatchSchema = nonEmptyPatch(
  z
    .object({
      first_name: requiredName.optional(),
      last_name: requiredName.optional(),
      phone: optionalPhone,
    })
    .strict(),
);

const locationValue = nullableTrimmedString(100);
export const preferredLocationSchema = z
  .object({
    district: locationValue,
    locality: locationValue,
    neighbourhood: locationValue,
  })
  .strict()
  .refine(
    (location) =>
      Boolean(location.district || location.locality || location.neighbourhood),
    { message: 'Provide at least one location field.' },
  );

export const locationIdParamsSchema = z
  .object({ id: z.uuid('Enter a valid preferred location ID.') })
  .strict();
