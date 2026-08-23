import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

const LISTING_ID = '80000000-0000-4000-8000-000000000001';
const APPLICATION_ID = 'b0000000-0000-4000-8000-000000000001';
const QUESTION_IDS = {
  text: '91000000-0000-4000-8000-000000000001',
  number: '91000000-0000-4000-8000-000000000002',
  boolean: '91000000-0000-4000-8000-000000000003',
  date: '91000000-0000-4000-8000-000000000004',
  select: '91000000-0000-4000-8000-000000000005',
};

const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function draftEnvelope() {
  return jsonResponse(200, {
    success: true,
    data: {
      id: APPLICATION_ID,
      listing_id: LISTING_ID,
      move_in_date: null,
      requested_lease_duration_months: null,
      number_of_occupants: null,
      introductory_message: null,
      status: 'DRAFT',
      created_at: '2026-08-22T08:00:00.000Z',
      updated_at: '2026-08-22T08:00:00.000Z',
    },
    meta: { listing_available: true, editable: true },
  });
}

function questions() {
  return [
    {
      id: QUESTION_IDS.text,
      question_text: 'Tell us about your household.',
      question_type: 'TEXT',
      is_required: true,
      display_order: 0,
      options: [],
    },
    {
      id: QUESTION_IDS.number,
      question_text: 'Years at your current address?',
      question_type: 'NUMBER',
      is_required: false,
      display_order: 1,
      options: [],
    },
    {
      id: QUESTION_IDS.boolean,
      question_text: 'Can you provide references?',
      question_type: 'BOOLEAN',
      is_required: false,
      display_order: 2,
      options: [],
    },
    {
      id: QUESTION_IDS.date,
      question_text: 'When can you visit?',
      question_type: 'DATE',
      is_required: false,
      display_order: 3,
      options: [],
    },
    {
      id: QUESTION_IDS.select,
      question_text: 'Choose a lease term.',
      question_type: 'SELECT',
      is_required: true,
      display_order: 4,
      options: [
        {
          id: '92000000-0000-4000-8000-000000000001',
          option_text: '12 months',
          display_order: 0,
        },
        {
          id: '92000000-0000-4000-8000-000000000002',
          option_text: '24 months',
          display_order: 1,
        },
      ],
    },
  ];
}

function answerResponse(answers = []) {
  return jsonResponse(200, { success: true, data: answers });
}

function createFetch({
  currentQuestions = questions(),
  currentAnswers = [],
  onPut,
} = {}) {
  return vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/me')) return profileResponse();
    if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
      return draftEnvelope();
    }
    if (url.endsWith(`/listings/${LISTING_ID}/application-questions`)) {
      return jsonResponse(200, { success: true, data: currentQuestions });
    }
    if (
      url.endsWith(`/applications/${APPLICATION_ID}/answers`) &&
      options.method === 'GET'
    ) {
      return answerResponse(currentAnswers);
    }
    if (
      url.endsWith(`/applications/${APPLICATION_ID}`) &&
      options.method === 'PATCH'
    ) {
      return draftEnvelope();
    }
    if (
      url.endsWith(`/applications/${APPLICATION_ID}/answers`) &&
      options.method === 'PUT'
    ) {
      return onPut
        ? onPut(JSON.parse(options.body), options)
        : answerResponse();
    }
    throw new Error(`Unexpected URL ${url}`);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('draft application question controls', () => {
  it('renders every current question type and reloads existing answers', async () => {
    vi.stubGlobal(
      'fetch',
      createFetch({
        currentAnswers: [
          {
            question_id: QUESTION_IDS.text,
            answer_text: 'Existing household',
            updated_at: '2026-08-22T10:00:00.000Z',
          },
          {
            question_id: QUESTION_IDS.boolean,
            answer_text: 'false',
            updated_at: '2026-08-22T10:00:00.000Z',
          },
          {
            question_id: QUESTION_IDS.select,
            answer_text: '24 months',
            updated_at: '2026-08-22T10:00:00.000Z',
          },
        ],
      }),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Application questions' }),
    ).toBeVisible();
    expect(screen.getByLabelText(/Tell us about your household/)).toHaveValue(
      'Existing household',
    );
    expect(
      screen.getByLabelText(/Years at your current address/),
    ).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText(/Can you provide references/)).toHaveValue(
      'false',
    );
    expect(screen.getByLabelText(/When can you visit/)).toHaveAttribute(
      'type',
      'date',
    );
    expect(screen.getByLabelText(/Choose a lease term/)).toHaveValue(
      '24 months',
    );
    expect(screen.getAllByText('Required')).toHaveLength(2);
    expect(
      screen.getByText(/save your answers and finish later/i),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /submit/i }),
    ).not.toBeInTheDocument();
  });

  it('saves updates and explicit clearing in one answer request', async () => {
    let putBody;
    const fetchMock = createFetch({
      currentAnswers: [
        {
          question_id: QUESTION_IDS.text,
          answer_text: 'Old text',
          updated_at: '2026-08-22T10:00:00.000Z',
        },
        {
          question_id: QUESTION_IDS.number,
          answer_text: '2',
          updated_at: '2026-08-22T10:00:00.000Z',
        },
      ],
      onPut(body) {
        putBody = body;
        return answerResponse(
          body.answers
            .filter((answer) => answer.answer_text !== null)
            .map((answer) => ({
              ...answer,
              updated_at: '2026-08-22T11:00:00.000Z',
            })),
        );
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    fireEvent.change(
      await screen.findByLabelText(/Tell us about your household/),
      { target: { value: 'Updated text' } },
    );
    fireEvent.change(screen.getByLabelText(/Years at your current address/), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText(
        'Draft and answers saved. They have not been submitted.',
      ),
    ).toBeVisible();
    expect(putBody.answers).toEqual(
      expect.arrayContaining([
        {
          question_id: QUESTION_IDS.text,
          answer_text: 'Updated text',
        },
        { question_id: QUESTION_IDS.number, answer_text: null },
      ]),
    );
    expect(
      fetchMock.mock.calls.find(
        ([url, options]) =>
          url.endsWith('/answers') && options.method === 'PUT',
      )[1].headers.Authorization,
    ).toBe('Bearer verified-access-token');
  });

  it('allows required questions to remain empty when saving a DRAFT', async () => {
    let putBody;
    vi.stubGlobal(
      'fetch',
      createFetch({
        currentQuestions: [questions()[0]],
        onPut(body) {
          putBody = body;
          return answerResponse();
        },
      }),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/answers saved/i)).toBeVisible();
    expect(putBody).toEqual({
      answers: [{ question_id: QUESTION_IDS.text, answer_text: null }],
    });
  });

  it('shows answer validation before making a PUT request', async () => {
    const fetchMock = createFetch({ currentQuestions: [questions()[0]] });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    fireEvent.change(
      await screen.findByLabelText(/Tell us about your household/),
      {
        target: { value: 'x'.repeat(2001) },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('Answer must be 2,000 characters or fewer.'),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url.endsWith('/answers') && options.method === 'PUT',
      ),
    ).toBe(false);
  });

  it('does not resurrect an invalidated answer after current questions reload', async () => {
    const changedSelect = {
      ...questions()[4],
      options: [
        {
          id: '92000000-0000-4000-8000-000000000003',
          option_text: '36 months',
          display_order: 0,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      createFetch({ currentQuestions: [changedSelect], currentAnswers: [] }),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    const select = await screen.findByLabelText(/Choose a lease term/);
    expect(select).toHaveValue('');
    expect(screen.queryByText('24 months')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '36 months' })).toBeVisible();
  });

  it('reports partial save failure without claiming answers were saved', async () => {
    vi.stubGlobal(
      'fetch',
      createFetch({
        onPut() {
          return jsonResponse(503, {
            success: false,
            error: { code: 'UNAVAILABLE', message: 'Answers unavailable.' },
          });
        },
      }),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText(
        'Your basic details were saved, but application answers were not saved. Try again.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/answers saved/i)).not.toBeInTheDocument();
  });
});
