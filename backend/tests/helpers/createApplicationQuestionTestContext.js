import { createApp } from '../../src/app.js';
import { ApplicationQuestionRepositoryError } from '../../src/repositories/applicationQuestionRepository.js';
import { createApplicationQuestionService } from '../../src/services/applicationQuestionService.js';
import {
  createListingTestContext,
  LISTING_IDS,
  makeListing,
} from './createListingTestContext.js';
import { makeProperty } from './createPropertyTestContext.js';

export const QUESTION_IDS = Object.freeze({
  a: '91000000-0000-4000-8000-000000000001',
  b: '91000000-0000-4000-8000-000000000002',
});

export function makeQuestion(overrides = {}) {
  return {
    id: QUESTION_IDS.a,
    listing_id: LISTING_IDS.a,
    question_text: 'When would you like to move in?',
    question_type: 'DATE',
    is_required: true,
    display_order: 0,
    created_at: '2026-08-22T00:00:00.000Z',
    updated_at: '2026-08-22T00:00:00.000Z',
    options: [],
    ...overrides,
  };
}

export function makeOption(overrides = {}) {
  return {
    id: '92000000-0000-4000-8000-000000000001',
    question_id: QUESTION_IDS.a,
    option_text: '12 months',
    display_order: 0,
    ...overrides,
  };
}

export function makeQuestionAnswer(overrides = {}) {
  return {
    id: '93000000-0000-4000-8000-000000000001',
    application_id: 'b0000000-0000-4000-8000-000000000001',
    question_id: QUESTION_IDS.a,
    answer_text: '2026-11-01',
    created_at: '2026-08-22T01:00:00.000Z',
    updated_at: '2026-08-22T01:00:00.000Z',
    ...overrides,
  };
}

export function createApplicationQuestionTestContext({
  listingRecords: initialListings = [makeListing({ status: 'DRAFT' })],
  propertyRecords = [makeProperty()],
  questionRecords: initialQuestions = [],
  applicationRecords = [],
  answerRecords: initialAnswers = [],
  applicationProfiles,
  failOptionWriteOnce = false,
  mutationOutcomeOnce,
} = {}) {
  const base = createListingTestContext({
    listingRecords: initialListings,
    propertyRecords,
    applicationProfiles,
  });
  const questionRecords = initialQuestions.map((question) =>
    makeQuestion({
      ...question,
      options: (question.options ?? []).map((option) => ({ ...option })),
    }),
  );
  let questionSequence = 10;
  let optionSequence = 10;
  let shouldFailOptionWrite = failOptionWriteOnce;
  let nextMutationOutcome = mutationOutcomeOnce;
  const updateCalls = [];
  const answerRecords = initialAnswers.map((answer) =>
    makeQuestionAnswer(answer),
  );

  function copy(question) {
    return question
      ? {
          ...question,
          options: question.options.map((option) => ({ ...option })),
        }
      : null;
  }

  const questions = {
    async mutateQuestion({ operation, listingId, questionId, payload = {} }) {
      if (nextMutationOutcome) {
        const outcome = nextMutationOutcome;
        nextMutationOutcome = null;
        return { outcome, question_id: questionId };
      }
      if (shouldFailOptionWrite && Object.hasOwn(payload, 'options')) {
        shouldFailOptionWrite = false;
        throw new ApplicationQuestionRepositoryError('WRITE_FAILED');
      }

      if (operation === 'CREATE') {
        const created = makeQuestion({
          ...payload,
          id: `91000000-0000-4000-8000-${String(questionSequence++).padStart(12, '0')}`,
          listing_id: listingId,
          options: (payload.options ?? []).map((option) => ({
            ...option,
            id: `92000000-0000-4000-8000-${String(optionSequence++).padStart(12, '0')}`,
            question_id: null,
          })),
        });
        created.options.forEach((option) => {
          option.question_id = created.id;
        });
        questionRecords.push(created);
        return { outcome: 'OK', question_id: created.id };
      }

      const index = questionRecords.findIndex(
        (question) =>
          question.listing_id === listingId && question.id === questionId,
      );
      if (index < 0) {
        return { outcome: 'QUESTION_NOT_FOUND', question_id: questionId };
      }
      const question = questionRecords[index];

      const removeDraftAnswers = (predicate = () => true) => {
        for (
          let answerIndex = answerRecords.length - 1;
          answerIndex >= 0;
          answerIndex -= 1
        ) {
          const answer = answerRecords[answerIndex];
          const application = applicationRecords.find(
            (candidate) => candidate.id === answer.application_id,
          );
          if (
            answer.question_id === questionId &&
            application &&
            (application.status ?? 'DRAFT') === 'DRAFT' &&
            !application.submitted_at &&
            predicate(answer)
          ) {
            answerRecords.splice(answerIndex, 1);
          }
        }
      };

      if (operation === 'DELETE') {
        removeDraftAnswers();
        questionRecords.splice(index, 1);
        return { outcome: 'OK', question_id: questionId };
      }

      const targetType = payload.question_type ?? question.question_type;
      if (targetType !== question.question_type) {
        removeDraftAnswers();
      } else if (Object.hasOwn(payload, 'options')) {
        const valid = new Set(
          payload.options.map((option) => option.option_text),
        );
        removeDraftAnswers((answer) => !valid.has(answer.answer_text));
      }
      for (const field of [
        'question_text',
        'question_type',
        'is_required',
        'display_order',
      ]) {
        if (Object.hasOwn(payload, field)) question[field] = payload[field];
      }
      if (targetType !== 'SELECT' || Object.hasOwn(payload, 'options')) {
        question.options =
          targetType === 'SELECT'
            ? payload.options.map((option) => ({
                ...option,
                id: `92000000-0000-4000-8000-${String(optionSequence++).padStart(12, '0')}`,
                question_id: questionId,
              }))
            : [];
      }
      question.updated_at = '2026-08-22T12:00:00.000Z';
      return { outcome: 'OK', question_id: questionId };
    },

    async listForListing(listingId) {
      return questionRecords
        .filter((q) => q.listing_id === listingId)
        .map(copy);
    },
    async findForListing(listingId, questionId) {
      return copy(
        questionRecords.find(
          (question) =>
            question.listing_id === listingId && question.id === questionId,
        ),
      );
    },
    async hasSubmittedApplication(listingId) {
      return applicationRecords.some(
        (application) =>
          application.listing_id === listingId && application.submitted_at,
      );
    },
    async createQuestion(fields) {
      const question = makeQuestion({
        ...fields,
        id: `91000000-0000-4000-8000-${String(questionSequence++).padStart(12, '0')}`,
        options: [],
      });
      questionRecords.push(question);
      return copy(question);
    },
    async updateQuestion(listingId, questionId, fields) {
      updateCalls.push({ listingId, questionId, fields: { ...fields } });
      const question = questionRecords.find(
        (candidate) =>
          candidate.listing_id === listingId && candidate.id === questionId,
      );
      if (!question) return null;
      Object.assign(question, fields, {
        updated_at: '2026-08-22T12:00:00.000Z',
      });
      return copy(question);
    },
    async deleteQuestion(listingId, questionId) {
      const index = questionRecords.findIndex(
        (candidate) =>
          candidate.listing_id === listingId && candidate.id === questionId,
      );
      if (index < 0) return false;
      questionRecords.splice(index, 1);
      return true;
    },
    async createOptions(questionId, options) {
      if (shouldFailOptionWrite) {
        shouldFailOptionWrite = false;
        throw new ApplicationQuestionRepositoryError('WRITE_FAILED');
      }
      const question = questionRecords.find(
        (candidate) => candidate.id === questionId,
      );
      const created = options.map((option) => ({
        ...option,
        id: `92000000-0000-4000-8000-${String(optionSequence++).padStart(12, '0')}`,
        question_id: questionId,
      }));
      question.options.push(...created);
      return created.map((option) => ({ ...option }));
    },
    async deleteOptions(questionId) {
      const question = questionRecords.find(
        (candidate) => candidate.id === questionId,
      );
      if (question) question.options = [];
    },
  };

  const answers = {
    async listDraftForQuestion(questionId) {
      return answerRecords
        .filter((answer) => {
          const application = applicationRecords.find(
            (candidate) => candidate.id === answer.application_id,
          );
          return (
            answer.question_id === questionId &&
            application &&
            (application.status ?? 'DRAFT') === 'DRAFT' &&
            !application.submitted_at
          );
        })
        .map((answer) => ({ ...answer }));
    },
    async deleteByIds(answerIds) {
      for (let index = answerRecords.length - 1; index >= 0; index -= 1) {
        if (answerIds.includes(answerRecords[index].id)) {
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
        if (existing) Object.assign(existing, record);
        else answerRecords.push({ ...record });
      }
    },
  };

  const publicListings = {
    async isEligible(listingId) {
      const listing = base.listingRecords.find(
        (candidate) => candidate.id === listingId,
      );
      const property = listing
        ? propertyRecords.find(
            (candidate) => candidate.id === listing.property_id,
          )
        : null;
      return Boolean(
        listing?.status === 'ACTIVE' && property && !property.archived_at,
      );
    },
  };
  const applicationQuestionService = createApplicationQuestionService({
    questions,
    answers,
    listings: base.listingService,
    publicListings,
  });

  return {
    ...base,
    app: createApp({
      authService: base.authService,
      profileService: base.profileService,
      listingService: base.listingService,
      applicationQuestionService,
    }),
    applicationQuestionService,
    applicationRecords,
    questionRecords,
    answerRecords,
    updateCalls,
    questions,
  };
}
