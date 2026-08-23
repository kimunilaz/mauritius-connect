import { z } from 'zod';

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DATE_SCHEMA = z.iso.date();

export function validateApplicationAnswerValue(question, rawValue) {
  const value = rawValue?.trim() ?? '';
  if (!value) return { valid: true, value: null };

  if (question.question_type === 'TEXT') {
    return value.length <= 2000
      ? { valid: true, value }
      : { valid: false, message: 'Answer must be 2,000 characters or fewer.' };
  }

  if (question.question_type === 'NUMBER') {
    const number = Number(value);
    return NUMBER_PATTERN.test(value) && Number.isFinite(number)
      ? { valid: true, value: String(number) }
      : { valid: false, message: 'Enter a valid finite number.' };
  }

  if (question.question_type === 'BOOLEAN') {
    return value === 'true' || value === 'false'
      ? { valid: true, value }
      : { valid: false, message: 'Choose Yes or No.' };
  }

  if (question.question_type === 'DATE') {
    return DATE_SCHEMA.safeParse(value).success
      ? { valid: true, value }
      : { valid: false, message: 'Enter a valid date.' };
  }

  if (question.question_type === 'SELECT') {
    return question.options.some((option) => option.option_text === value)
      ? { valid: true, value }
      : {
          valid: false,
          message: 'Choose a current option for this question.',
        };
  }

  return { valid: false, message: 'Question type is not supported.' };
}
