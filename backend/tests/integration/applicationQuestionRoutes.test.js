import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  createApplicationQuestionTestContext,
  makeOption,
  makeQuestion,
  makeQuestionAnswer,
  QUESTION_IDS,
} from '../helpers/createApplicationQuestionTestContext.js';
import {
  LISTING_IDS,
  makeListing,
  otherLandlordProperty,
} from '../helpers/createListingTestContext.js';
import { makeProperty } from '../helpers/createPropertyTestContext.js';

const DRAFT_APPLICATION_ID = 'b0000000-0000-4000-8000-000000000001';

const auth = (builder, token = 'landlord-token') =>
  builder.set('Authorization', `Bearer ${token}`);
const listingPath = `/api/v1/listings/${LISTING_IDS.a}/application-questions`;
const ownedPath = `/api/v1/landlord/listings/${LISTING_IDS.a}/application-questions`;
const validQuestion = {
  question_text: 'When would you like to move in?',
  question_type: 'DATE',
  is_required: true,
  display_order: 0,
};

describe('application question creation and validation', () => {
  it.each(['TEXT', 'NUMBER', 'BOOLEAN', 'DATE'])(
    'creates an owned %s question',
    async (questionType) => {
      const context = createApplicationQuestionTestContext();
      const response = await auth(request(context.app).post(listingPath)).send({
        ...validQuestion,
        question_type: questionType,
      });
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        question_type: questionType,
        options: [],
      });
      expect(context.questionRecords[0].listing_id).toBe(LISTING_IDS.a);
    },
  );

  it('creates SELECT options and returns deterministic option order', async () => {
    const context = createApplicationQuestionTestContext();
    const response = await auth(request(context.app).post(listingPath)).send({
      ...validQuestion,
      question_type: 'SELECT',
      options: [
        { option_text: '12 months', display_order: 2 },
        { option_text: '6 months', display_order: 0 },
      ],
    });
    expect(response.status).toBe(201);
    expect(
      response.body.data.options.map((option) => option.option_text),
    ).toEqual(['6 months', '12 months']);
  });

  it.each([
    [{ ...validQuestion, question_type: 'RANKING' }, 'question_type'],
    [{ ...validQuestion, question_text: ' ' }, 'question_text'],
    [{ ...validQuestion, display_order: -1 }, 'display_order'],
    [{ ...validQuestion, question_type: 'SELECT' }, 'options'],
    [
      {
        ...validQuestion,
        options: [{ option_text: 'Unexpected', display_order: 0 }],
      },
      'options',
    ],
    [
      {
        ...validQuestion,
        question_type: 'SELECT',
        options: [{ option_text: ' ', display_order: 0 }],
      },
      'options.0.option_text',
    ],
  ])('rejects invalid question payload %#', async (body, field) => {
    const context = createApplicationQuestionTestContext();
    const response = await auth(request(context.app).post(listingPath)).send(
      body,
    );
    expect(response.status).toBe(422);
    expect(response.body.error.fields).toHaveProperty(field);
    expect(context.questionRecords).toHaveLength(0);
  });

  it.each(['id', 'listing_id', 'created_at', 'updated_at', 'question_id'])(
    'rejects protected create field %s',
    async (field) => {
      const context = createApplicationQuestionTestContext();
      const response = await auth(request(context.app).post(listingPath)).send({
        ...validQuestion,
        [field]: LISTING_IDS.b,
      });
      expect(response.status).toBe(422);
      expect(context.questionRecords).toHaveLength(0);
    },
  );

  it('compensates question creation when option persistence fails', async () => {
    const context = createApplicationQuestionTestContext({
      failOptionWriteOnce: true,
    });
    const response = await auth(request(context.app).post(listingPath)).send({
      ...validQuestion,
      question_type: 'SELECT',
      options: [{ option_text: '6 months', display_order: 0 }],
    });
    expect(response.status).toBe(500);
    expect(context.questionRecords).toHaveLength(0);
  });
});

describe('application question reads, updates, and deletion', () => {
  it('returns questions and options in deterministic order with explicit fields', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [
        makeQuestion({
          id: QUESTION_IDS.b,
          display_order: 2,
          question_text: 'Second',
        }),
        makeQuestion({
          question_type: 'SELECT',
          question_text: 'First',
          options: [
            makeOption({ id: 'z', option_text: 'Later', display_order: 2 }),
            makeOption({ id: 'a', option_text: 'Earlier', display_order: 0 }),
          ],
        }),
      ],
    });
    const response = await auth(request(context.app).get(ownedPath));
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((question) => question.question_text),
    ).toEqual(['First', 'Second']);
    expect(
      response.body.data[0].options.map((option) => option.option_text),
    ).toEqual(['Earlier', 'Later']);
    expect(response.body.meta).toEqual({
      locked: false,
      editable: true,
      listing_status: 'DRAFT',
    });
    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      'display_order',
      'id',
      'is_required',
      'options',
      'question_text',
      'question_type',
    ]);
  });

  it('partially updates allowlisted question fields', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion()],
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({ question_text: ' Updated question ', display_order: 3 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      question_text: 'Updated question',
      question_type: 'DATE',
      display_order: 3,
    });
  });

  it('changes SELECT to TEXT and removes obsolete options', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [
        makeQuestion({ question_type: 'SELECT', options: [makeOption()] }),
      ],
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({ question_type: 'TEXT' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      question_type: 'TEXT',
      options: [],
    });
    expect(context.questionRecords[0].options).toEqual([]);
  });

  it('requires options when changing a non-SELECT question to SELECT', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion({ question_type: 'TEXT' })],
    });
    const rejected = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({ question_type: 'SELECT' });
    expect(rejected.status).toBe(422);
    const accepted = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({
      question_type: 'SELECT',
      options: [{ option_text: 'Yes', display_order: 0 }],
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.options).toHaveLength(1);
  });

  it('restores question and options if a replacement option write fails', async () => {
    const original = makeQuestion({
      question_type: 'SELECT',
      options: [makeOption()],
    });
    const context = createApplicationQuestionTestContext({
      questionRecords: [original],
      failOptionWriteOnce: true,
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({
      question_text: 'Changed',
      options: [{ option_text: 'New', display_order: 0 }],
    });
    expect(response.status).toBe(500);
    expect(context.questionRecords[0]).toMatchObject({
      question_text: original.question_text,
      question_type: 'SELECT',
    });
    expect(context.questionRecords[0].options[0].option_text).toBe('12 months');
  });

  it('deletes only the owned question and its cascading options', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [
        makeQuestion({ question_type: 'SELECT', options: [makeOption()] }),
        makeQuestion({ id: QUESTION_IDS.b, question_text: 'Keep me' }),
      ],
    });
    const response = await auth(
      request(context.app).delete(`${listingPath}/${QUESTION_IDS.a}`),
    );
    expect(response.status).toBe(204);
    expect(context.questionRecords).toHaveLength(1);
    expect(context.questionRecords[0].id).toBe(QUESTION_IDS.b);
    expect(context.listingRecords).toHaveLength(1);
  });
});

describe('application question ownership, roles, and status', () => {
  it.each([
    ['GET', ownedPath, undefined],
    ['POST', listingPath, validQuestion],
    ['PATCH', `${listingPath}/${QUESTION_IDS.a}`, { is_required: false }],
    ['DELETE', `${listingPath}/${QUESTION_IDS.a}`, undefined],
  ])(
    'requires authentication for %s management',
    async (method, path, body) => {
      const context = createApplicationQuestionTestContext({
        questionRecords: [makeQuestion()],
      });
      const client = request(context.app)[method.toLowerCase()](path);
      const response = body ? await client.send(body) : await client;
      expect(response.status).toBe(401);
    },
  );

  it.each([
    ['POST', listingPath, validQuestion],
    ['PATCH', `${listingPath}/${QUESTION_IDS.a}`, { is_required: false }],
    ['DELETE', `${listingPath}/${QUESTION_IDS.a}`, undefined],
  ])('blocks TENANT %s mutations', async (method, path, body) => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion()],
    });
    const client = request(context.app)[method.toLowerCase()](path);
    client.set('Authorization', 'Bearer tenant-token');
    const response = body ? await client.send(body) : await client;
    expect(response.status).toBe(403);
  });

  it.each(['SUSPENDED', 'DELETED'])(
    'blocks a %s landlord',
    async (accountStatus) => {
      const context = createApplicationQuestionTestContext({
        applicationProfiles: [
          makeProfile(),
          makeProfile({
            id: TEST_USERS.landlord,
            role: 'LANDLORD',
            account_status: accountStatus,
          }),
          makeProfile({ id: TEST_USERS.other, role: 'LANDLORD' }),
        ],
      });
      const response = await auth(request(context.app).post(listingPath)).send(
        validQuestion,
      );
      expect(response.status).toBe(403);
    },
  );

  it('hides another landlord listing and guessed question identifiers', async () => {
    const otherListing = makeListing({
      id: LISTING_IDS.b,
      property_id: otherLandlordProperty().id,
    });
    const context = createApplicationQuestionTestContext({
      propertyRecords: [makeProperty(), otherLandlordProperty()],
      listingRecords: [makeListing(), otherListing],
      questionRecords: [
        makeQuestion({ id: QUESTION_IDS.b, listing_id: LISTING_IDS.b }),
      ],
    });
    const foreignBase = `/api/v1/listings/${LISTING_IDS.b}/application-questions`;
    const reads = await auth(
      request(context.app).get(
        `/api/v1/landlord/listings/${LISTING_IDS.b}/application-questions`,
      ),
    );
    const create = await auth(request(context.app).post(foreignBase)).send(
      validQuestion,
    );
    const update = await auth(
      request(context.app).patch(`${foreignBase}/${QUESTION_IDS.b}`),
    ).send({ is_required: false });
    const remove = await auth(
      request(context.app).delete(`${foreignBase}/${QUESTION_IDS.b}`),
    );
    for (const response of [reads, create, update, remove]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
    }

    const guessedOnOwnedListing = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.b}`),
    ).send({ is_required: false });
    expect(guessedOnOwnedListing.status).toBe(404);
    expect(guessedOnOwnedListing.body.error.code).toBe(
      'APPLICATION_QUESTION_NOT_FOUND',
    );
  });

  it.each(['RENTED', 'CLOSED'])(
    'makes %s listing questions read-only',
    async (status) => {
      const context = createApplicationQuestionTestContext({
        listingRecords: [makeListing({ status })],
        questionRecords: [makeQuestion()],
      });
      const list = await auth(request(context.app).get(ownedPath));
      expect(list.status).toBe(200);
      expect(list.body.meta.editable).toBe(false);
      const create = await auth(request(context.app).post(listingPath)).send(
        validQuestion,
      );
      const update = await auth(
        request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
      ).send({ is_required: false });
      const remove = await auth(
        request(context.app).delete(`${listingPath}/${QUESTION_IDS.a}`),
      );
      for (const response of [create, update, remove]) {
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('LISTING_NOT_EDITABLE');
      }
    },
  );
});

describe('draft-answer cleanup during question mutations', () => {
  function draftApplication() {
    return {
      id: DRAFT_APPLICATION_ID,
      listing_id: LISTING_IDS.a,
      status: 'DRAFT',
      submitted_at: null,
    };
  }

  it('removes an existing DRAFT answer when the question type changes', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion({ question_type: 'DATE' })],
      applicationRecords: [draftApplication()],
      answerRecords: [makeQuestionAnswer()],
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({ question_type: 'TEXT' });
    expect(response.status).toBe(200);
    expect(response.body.data.question_type).toBe('TEXT');
    expect(context.answerRecords).toEqual([]);
  });

  it('removes a SELECT answer when its option is removed', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [
        makeQuestion({
          question_type: 'SELECT',
          options: [makeOption({ option_text: '12 months' })],
        }),
      ],
      applicationRecords: [draftApplication()],
      answerRecords: [makeQuestionAnswer({ answer_text: '12 months' })],
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({
      options: [{ option_text: '24 months', display_order: 0 }],
    });
    expect(response.status).toBe(200);
    expect(context.answerRecords).toEqual([]);
    expect(context.updateCalls).toEqual([]);
  });

  it('preserves a SELECT answer when option reordering leaves it valid', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [
        makeQuestion({
          question_type: 'SELECT',
          options: [
            makeOption({ option_text: '12 months', display_order: 0 }),
            makeOption({
              id: '92000000-0000-4000-8000-000000000002',
              option_text: '24 months',
              display_order: 1,
            }),
          ],
        }),
      ],
      applicationRecords: [draftApplication()],
      answerRecords: [makeQuestionAnswer({ answer_text: '12 months' })],
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({
      options: [
        { option_text: '24 months', display_order: 0 },
        { option_text: '12 months', display_order: 1 },
      ],
    });
    expect(response.status).toBe(200);
    expect(context.answerRecords).toEqual([
      expect.objectContaining({ answer_text: '12 months' }),
    ]);
  });

  it('removes DRAFT answers before deleting a question', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion()],
      applicationRecords: [draftApplication()],
      answerRecords: [makeQuestionAnswer()],
    });
    const response = await auth(
      request(context.app).delete(`${listingPath}/${QUESTION_IDS.a}`),
    );
    expect(response.status).toBe(204);
    expect(context.questionRecords).toEqual([]);
    expect(context.answerRecords).toEqual([]);
  });

  it('preserves valid answers for text, order, and required-only changes', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion()],
      applicationRecords: [draftApplication()],
      answerRecords: [makeQuestionAnswer()],
    });
    for (const body of [
      { question_text: 'Updated wording' },
      { display_order: 7 },
      { is_required: false },
    ]) {
      const response = await auth(
        request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
      ).send(body);
      expect(response.status).toBe(200);
    }
    expect(context.answerRecords).toEqual([
      expect.objectContaining({ answer_text: '2026-11-01' }),
    ]);
  });
});

describe('submitted-application question locking', () => {
  it('honors the transaction-boundary lock when submission wins the race', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion()],
      mutationOutcomeOnce: 'LOCKED',
    });
    const response = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({ question_text: 'Racing mutation' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPLICATION_QUESTIONS_LOCKED');
    expect(context.questionRecords[0].question_text).toBe(
      'When would you like to move in?',
    );
  });

  it('does not lock mutations for a DRAFT application without submitted_at', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [makeQuestion()],
      applicationRecords: [
        { listing_id: LISTING_IDS.a, status: 'DRAFT', submitted_at: null },
      ],
    });
    const create = await auth(request(context.app).post(listingPath)).send({
      ...validQuestion,
      question_text: 'Draft does not lock',
      display_order: 2,
    });
    const update = await auth(
      request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`),
    ).send({ display_order: 4 });
    expect(create.status).toBe(201);
    expect(update.status).toBe(200);
  });

  it('locks create, update, required/type/options/order changes, and delete', async () => {
    const context = createApplicationQuestionTestContext({
      questionRecords: [
        makeQuestion({ question_type: 'SELECT', options: [makeOption()] }),
      ],
      applicationRecords: [
        {
          id: DRAFT_APPLICATION_ID,
          listing_id: LISTING_IDS.a,
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T10:00:00.000Z',
        },
      ],
      answerRecords: [makeQuestionAnswer({ answer_text: '12 months' })],
    });
    const attempts = [
      auth(request(context.app).post(listingPath)).send(validQuestion),
      auth(request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`)).send(
        { question_text: 'Changed' },
      ),
      auth(request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`)).send(
        { is_required: false },
      ),
      auth(request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`)).send(
        { question_type: 'TEXT' },
      ),
      auth(request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`)).send(
        { options: [{ option_text: 'Changed', display_order: 0 }] },
      ),
      auth(request(context.app).patch(`${listingPath}/${QUESTION_IDS.a}`)).send(
        { display_order: 9 },
      ),
      auth(request(context.app).delete(`${listingPath}/${QUESTION_IDS.a}`)),
    ];
    for (const attempt of attempts) {
      const response = await attempt;
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('APPLICATION_QUESTIONS_LOCKED');
    }
    const list = await auth(request(context.app).get(ownedPath));
    expect(list.body.meta).toMatchObject({ locked: true, editable: false });
    expect(context.questionRecords).toHaveLength(1);
    expect(context.questionRecords[0].options[0].option_text).toBe('12 months');
    expect(context.answerRecords).toEqual([
      expect.objectContaining({ answer_text: '12 months' }),
    ]);
  });
});

describe('public application questions', () => {
  it('returns privacy-safe ordered questions anonymously for ACTIVE listings', async () => {
    const context = createApplicationQuestionTestContext({
      listingRecords: [makeListing({ status: 'ACTIVE' })],
      questionRecords: [
        makeQuestion({
          question_type: 'SELECT',
          options: [makeOption()],
        }),
      ],
    });
    const response = await request(context.app).get(listingPath);
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({
      id: QUESTION_IDS.a,
      question_text: 'When would you like to move in?',
      question_type: 'SELECT',
      is_required: true,
      display_order: 0,
      options: [
        {
          id: makeOption().id,
          option_text: '12 months',
          display_order: 0,
        },
      ],
    });
    const serialized = JSON.stringify(response.body);
    for (const forbidden of [
      'listing_id',
      'landlord_id',
      'submitted_at',
      'created_at',
      'updated_at',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'])(
    'hides questions for a %s listing',
    async (status) => {
      const context = createApplicationQuestionTestContext({
        listingRecords: [makeListing({ status })],
        questionRecords: [makeQuestion()],
      });
      const response = await request(context.app).get(listingPath);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
    },
  );

  it('hides archived and unknown listings', async () => {
    const archived = createApplicationQuestionTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-22T00:00:00.000Z' }),
      ],
      listingRecords: [makeListing({ status: 'ACTIVE' })],
      questionRecords: [makeQuestion()],
    });
    const hidden = await request(archived.app).get(listingPath);
    expect(hidden.status).toBe(404);
    const unknown = await request(archived.app).get(
      '/api/v1/listings/80000000-0000-4000-8000-999999999999/application-questions',
    );
    expect(unknown.status).toBe(404);
  });
});
