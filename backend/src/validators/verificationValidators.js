import { z } from 'zod';
const uuid = z.string().uuid();
export const verificationCreateSchema = z
  .object({
    type: z.enum(['LANDLORD_IDENTITY', 'PROPERTY_AUTHORITY']),
    property_id: uuid.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type === 'PROPERTY_AUTHORITY' && !v.property_id)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['property_id'],
        message: 'property_id is required.',
      });
    if (v.type === 'LANDLORD_IDENTITY' && v.property_id)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['property_id'],
        message: 'property_id is not allowed.',
      });
  });
export const verificationParamsSchema = z
  .object({ verificationId: uuid })
  .strict();
export const verificationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']).optional(),
    type: z.enum(['LANDLORD_IDENTITY', 'PROPERTY_AUTHORITY']).optional(),
  })
  .strict();
export const verificationRejectSchema = z
  .object({ reason: z.string().trim().max(1000).optional() })
  .strict();
