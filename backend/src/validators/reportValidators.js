import { z } from 'zod';

const listingReasons = [
  'FRAUD_OR_SCAM',
  'MISLEADING_INFORMATION',
  'INAPPROPRIATE_CONTENT',
  'DUPLICATE',
  'OTHER',
];
const messageReasons = [
  'HARASSMENT',
  'SPAM',
  'FRAUD_OR_SCAM',
  'INAPPROPRIATE_CONTENT',
  'OTHER',
];

export const reportCreateSchema = z
  .object({
    target_type: z.enum(['LISTING', 'MESSAGE']),
    target_id: z.string().uuid(),
    reason: z.enum([...new Set([...listingReasons, ...messageReasons])]),
    details: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((value) => value || null),
  })
  .strict()
  .superRefine((value, context) => {
    const allowed =
      value.target_type === 'LISTING' ? listingReasons : messageReasons;
    if (!allowed.includes(value.reason)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'This reason is not valid for the selected target.',
      });
    }
  });

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  target_type: z.enum(['LISTING', 'MESSAGE']).optional(),
});

export const reportParamsSchema = z.object({
  reportId: z.string().uuid(),
});

export const moderationActionSchema = z
  .object({ reason: z.string().trim().max(1000).optional() })
  .strict();
