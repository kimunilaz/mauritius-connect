import { z } from 'zod';

const requiredName = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(100, 'Must be 100 characters or fewer.');

const optionalPhone = z
  .string()
  .trim()
  .max(30, 'Must be 30 characters or fewer.')
  .regex(
    /^\+?[0-9 ()-]{7,30}$/,
    'Enter a valid phone number using digits and common separators.',
  )
  .optional();

export const registerProfileSchema = z
  .object({
    role: z.enum(['TENANT', 'LANDLORD'], {
      error: 'Role must be TENANT or LANDLORD.',
    }),
    first_name: requiredName,
    last_name: requiredName,
    phone: optionalPhone,
  })
  .strict();
