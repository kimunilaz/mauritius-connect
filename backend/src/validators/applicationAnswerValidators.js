import { z } from 'zod';

const answerSchema = z
  .object({
    question_id: z.uuid('Enter a valid question ID.'),
    answer_text: z.string().max(2000).nullable(),
  })
  .strict();

export const putApplicationAnswersSchema = z
  .object({ answers: z.array(answerSchema).max(100) })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set();
    value.answers.forEach((answer, index) => {
      if (seen.has(answer.question_id)) {
        context.addIssue({
          code: 'custom',
          path: ['answers', index, 'question_id'],
          message: 'Each question may appear only once.',
        });
      }
      seen.add(answer.question_id);
    });
  });
