import { z } from 'zod';

export const APPLICATION_QUESTION_TYPES = Object.freeze([
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'SELECT',
]);

const optionSchema = z
  .object({
    option_text: z.string().trim().min(1, 'Option text is required.').max(200),
    display_order: z.number().int().min(0),
  })
  .strict();

const questionFields = {
  question_text: z
    .string()
    .trim()
    .min(1, 'Question text is required.')
    .max(500),
  question_type: z.enum(APPLICATION_QUESTION_TYPES),
  is_required: z.boolean(),
  display_order: z.number().int().min(0),
  options: z.array(optionSchema).max(100).optional(),
};

function validateOptions(value, context) {
  if (value.question_type === 'SELECT' && !value.options?.length) {
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'SELECT questions require at least one option.',
    });
  }
  if (value.question_type !== 'SELECT' && value.options?.length) {
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'Options are allowed only for SELECT questions.',
    });
  }
}

export const createApplicationQuestionSchema = z
  .object(questionFields)
  .strict()
  .superRefine(validateOptions);

export const updateApplicationQuestionSchema = z
  .object({
    question_text: questionFields.question_text.optional(),
    question_type: questionFields.question_type.optional(),
    is_required: questionFields.is_required.optional(),
    display_order: questionFields.display_order.optional(),
    options: questionFields.options,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one question field to update.',
  });

export const applicationQuestionListingParamsSchema = z
  .object({ listingId: z.uuid('Enter a valid listing ID.') })
  .strict();

export const applicationQuestionParamsSchema = z
  .object({
    listingId: z.uuid('Enter a valid listing ID.'),
    questionId: z.uuid('Enter a valid question ID.'),
  })
  .strict();
