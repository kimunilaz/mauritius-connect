import { z } from 'zod';

export const viewingParamsSchema = z
  .object({ viewingId: z.uuid('Enter a valid viewing ID.') })
  .strict();

export const proposeViewingSchema = z
  .object({
    start_time: z.iso.datetime({ offset: true }),
    end_time: z.iso.datetime({ offset: true }).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine(
    ({ start_time, end_time }) =>
      !end_time || new Date(end_time) > new Date(start_time),
    { path: ['end_time'], message: 'End time must be after start time.' },
  );
