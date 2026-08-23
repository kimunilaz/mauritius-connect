import { createApp } from '../../src/app.js';
import { createApplicationAnswerService } from '../../src/services/applicationAnswerService.js';
import {
  APPLICATION_IDS,
  createApplicationTestContext,
  makeApplication,
} from './createApplicationTestContext.js';
import { LISTING_IDS } from './createListingTestContext.js';
import {
  makeOption,
  makeQuestion,
  QUESTION_IDS,
} from './createApplicationQuestionTestContext.js';

export const ANSWER_IDS = Object.freeze({
  a: '93000000-0000-4000-8000-000000000001',
  b: '93000000-0000-4000-8000-000000000002',
});

export const ANSWER_QUESTION_IDS = Object.freeze({
  text: QUESTION_IDS.a,
  number: QUESTION_IDS.b,
  boolean: '91000000-0000-4000-8000-000000000003',
  date: '91000000-0000-4000-8000-000000000004',
  select: '91000000-0000-4000-8000-000000000005',
  otherListing: '91000000-0000-4000-8000-000000000006',
});

export function makeAnswer(overrides = {}) {
  return {
    id: ANSWER_IDS.a,
    application_id: APPLICATION_IDS.a,
    question_id: ANSWER_QUESTION_IDS.text,
    answer_text: 'Existing answer',
    created_at: '2026-08-22T10:00:00.000Z',
    updated_at: '2026-08-22T10:00:00.000Z',
    ...overrides,
  };
}

export function makeAnswerQuestions() {
  return [
    makeQuestion({
      id: ANSWER_QUESTION_IDS.text,
      question_type: 'TEXT',
      question_text: 'Tell us about your household.',
      display_order: 0,
    }),
    makeQuestion({
      id: ANSWER_QUESTION_IDS.number,
      question_type: 'NUMBER',
      question_text: 'How many years at your current address?',
      is_required: false,
      display_order: 1,
    }),
    makeQuestion({
      id: ANSWER_QUESTION_IDS.boolean,
      question_type: 'BOOLEAN',
      question_text: 'Can you provide references?',
      display_order: 2,
    }),
    makeQuestion({
      id: ANSWER_QUESTION_IDS.date,
      question_type: 'DATE',
      question_text: 'When can you visit?',
      display_order: 3,
    }),
    makeQuestion({
      id: ANSWER_QUESTION_IDS.select,
      question_type: 'SELECT',
      question_text: 'Choose a lease term.',
      display_order: 4,
      options: [
        makeOption({
          id: '92000000-0000-4000-8000-000000000010',
          question_id: ANSWER_QUESTION_IDS.select,
          option_text: '12 months',
          display_order: 0,
        }),
        makeOption({
          id: '92000000-0000-4000-8000-000000000011',
          question_id: ANSWER_QUESTION_IDS.select,
          option_text: '24 months',
          display_order: 1,
        }),
      ],
    }),
    makeQuestion({
      id: ANSWER_QUESTION_IDS.otherListing,
      listing_id: LISTING_IDS.b,
      question_type: 'SELECT',
      question_text: 'Private other listing question.',
      options: [
        makeOption({
          id: '92000000-0000-4000-8000-000000000012',
          question_id: ANSWER_QUESTION_IDS.otherListing,
          option_text: 'Other option',
        }),
      ],
    }),
  ];
}

export function createApplicationAnswerTestContext({
  applicationRecords = [makeApplication()],
  questionRecords: inputQuestions = makeAnswerQuestions(),
  answerRecords: inputAnswers = [],
  listingRecords,
  propertyRecords,
  applicationProfiles,
  failDeleteOnce = false,
} = {}) {
  const base = createApplicationTestContext({
    applicationRecords,
    listingRecords,
    propertyRecords,
    applicationProfiles,
  });
  const questionRecords = inputQuestions.map((question) => ({
    ...question,
    options: (question.options ?? []).map((option) => ({ ...option })),
  }));
  const answerRecords = inputAnswers.map((answer) => makeAnswer(answer));
  let answerSequence = 10;
  let shouldFailDelete = failDeleteOnce;

  function questionFor(questionId) {
    return questionRecords.find((question) => question.id === questionId);
  }

  function complete(answer) {
    return answer
      ? { ...answer, question: { ...questionFor(answer.question_id) } }
      : null;
  }

  const questions = {
    async listForListing(listingId) {
      return questionRecords
        .filter((question) => question.listing_id === listingId)
        .map((question) => ({
          ...question,
          options: question.options.map((option) => ({ ...option })),
        }));
    },
  };

  const answers = {
    async listForApplication(applicationId) {
      return answerRecords
        .filter((answer) => answer.application_id === applicationId)
        .map(complete);
    },

    async upsertForApplication(applicationId, records) {
      return records.map((record) => {
        let answer = answerRecords.find(
          (candidate) =>
            candidate.application_id === applicationId &&
            candidate.question_id === record.question_id,
        );
        if (answer) {
          Object.assign(answer, record, {
            updated_at: '2026-08-22T11:00:00.000Z',
          });
        } else {
          answer = makeAnswer({
            id: `93000000-0000-4000-8000-${String(answerSequence++).padStart(12, '0')}`,
            application_id: applicationId,
            ...record,
            created_at: '2026-08-22T11:00:00.000Z',
            updated_at: '2026-08-22T11:00:00.000Z',
          });
          answerRecords.push(answer);
        }
        return { ...answer };
      });
    },

    async deleteForApplicationQuestions(applicationId, questionIds) {
      if (shouldFailDelete) {
        shouldFailDelete = false;
        throw new Error('Delete failed.');
      }
      for (let index = answerRecords.length - 1; index >= 0; index -= 1) {
        if (
          answerRecords[index].application_id === applicationId &&
          questionIds.includes(answerRecords[index].question_id)
        ) {
          answerRecords.splice(index, 1);
        }
      }
    },

    async restore(records) {
      for (const record of records) {
        const existing = answerRecords.find(
          (answer) =>
            answer.application_id === record.application_id &&
            answer.question_id === record.question_id,
        );
        const clean = { ...record };
        delete clean.question;
        if (existing) Object.assign(existing, clean);
        else answerRecords.push(clean);
      }
    },
  };

  const applicationAnswerService = createApplicationAnswerService({
    answers,
    applications: base.applications,
    questions,
    profiles: base.profileService,
    publicListings: base.publicListingService,
  });

  return {
    ...base,
    app: createApp({
      authService: base.authService,
      profileService: base.profileService,
      publicListingService: base.publicListingService,
      applicationService: base.applicationService,
      applicationAnswerService,
    }),
    answers,
    applicationAnswerService,
    answerRecords,
    questionRecords,
  };
}
