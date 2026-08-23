import { fireEvent, screen, waitFor } from '@testing-library/react';
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
const QUESTION_ID = '91000000-0000-4000-8000-000000000001';

const application = {
  id: APPLICATION_ID,
  listing_id: LISTING_ID,
  move_in_date: '2026-10-01',
  requested_lease_duration_months: 12,
  number_of_occupants: 2,
  introductory_message: 'A quiet household.',
  status: 'DRAFT',
  created_at: '2026-08-22T08:00:00.000Z',
  updated_at: '2026-08-22T08:00:00.000Z',
};
const question = {
  id: QUESTION_ID,
  question_text: 'Why is this home suitable?',
  question_type: 'TEXT',
  is_required: true,
  display_order: 0,
  options: [],
};

function envelope(data = application) {
  return jsonResponse(200, {
    success: true,
    data,
    meta: { listing_available: true, editable: true },
  });
}

function fetchForSubmission({
  initialApplication = application,
  currentAnswers = [
    {
      question_id: QUESTION_ID,
      answer_text: 'Close to work.',
      updated_at: '2026-08-22T10:00:00.000Z',
    },
  ],
  submitResponse,
  onSubmit,
} = {}) {
  return vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/me')) return profileResponse();
    if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
      return envelope(initialApplication);
    }
    if (url.endsWith(`/listings/${LISTING_ID}/application-questions`)) {
      return jsonResponse(200, { success: true, data: [question] });
    }
    if (
      url.endsWith(`/applications/${APPLICATION_ID}/answers`) &&
      options.method === 'GET'
    ) {
      return jsonResponse(200, { success: true, data: currentAnswers });
    }
    if (
      url.endsWith(`/applications/${APPLICATION_ID}`) &&
      options.method === 'PATCH'
    ) {
      return envelope({ ...application, ...JSON.parse(options.body) });
    }
    if (
      url.endsWith(`/applications/${APPLICATION_ID}/answers`) &&
      options.method === 'PUT'
    ) {
      const answers = JSON.parse(options.body)
        .answers.filter((answer) => answer.answer_text !== null)
        .map((answer) => ({
          ...answer,
          updated_at: '2026-08-22T11:00:00.000Z',
        }));
      return jsonResponse(200, { success: true, data: answers });
    }
    if (url.endsWith(`/applications/${APPLICATION_ID}/submit`)) {
      onSubmit?.(options);
      return (
        submitResponse ??
        jsonResponse(200, {
          success: true,
          data: {
            ...application,
            status: 'SUBMITTED',
            submitted_at: '2026-08-22T12:30:00.000Z',
          },
          meta: { submitted_now: true },
        })
      );
    }
    throw new Error(`Unexpected URL ${url}`);
  });
}

function renderSubmission(fetchMock) {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('scrollTo', vi.fn());
  return renderApp({
    route: `/listings/${LISTING_ID}/apply`,
    client: createFakeSupabaseClient({ session: createSession() }),
  });
}

async function enterReview() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Review application' }),
  );
  return screen.findByRole('heading', { name: 'Review your application' });
}

afterEach(() => vi.unstubAllGlobals());

describe('application submission review flow', () => {
  it('shows a final review with core fields, answers, and an explicit warning', async () => {
    renderSubmission(fetchForSubmission());
    expect(await enterReview()).toBeVisible();
    expect(screen.getByText('2026-10-01')).toBeVisible();
    expect(screen.getByText('12 months')).toBeVisible();
    expect(screen.getByText('Close to work.')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent(/submission is final/i);
    expect(
      screen.getByRole('button', { name: 'Submit application' }),
    ).toBeVisible();
  });

  it('highlights missing core fields and required answers before review', async () => {
    renderSubmission(
      fetchForSubmission({
        initialApplication: {
          ...application,
          move_in_date: null,
          requested_lease_duration_months: null,
        },
        currentAnswers: [],
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Review application' }),
    );
    expect(
      await screen.findByText(/complete these required items/i),
    ).toHaveTextContent(
      /Preferred move-in date.*Requested lease duration.*Why is this home suitable/,
    );
    expect(
      screen.queryByRole('heading', { name: 'Review your application' }),
    ).not.toBeInTheDocument();
  });

  it('submits with the bearer token and displays persistent success state', async () => {
    let submitOptions;
    renderSubmission(
      fetchForSubmission({
        onSubmit(options) {
          submitOptions = options;
        },
      }),
    );
    await enterReview();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(
      await screen.findByRole('heading', { name: 'Application submitted' }),
    ).toBeVisible();
    expect(submitOptions.headers.Authorization).toBe(
      'Bearer verified-access-token',
    );
    expect(screen.getByText(/can no longer be edited/i)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Submit application' }),
    ).not.toBeInTheDocument();
  });

  it('disables submission and prevents a double-click request', async () => {
    let resolveSubmission;
    const pending = new Promise((resolve) => {
      resolveSubmission = resolve;
    });
    const fetchMock = fetchForSubmission({ submitResponse: pending });
    renderSubmission(fetchMock);
    await enterReview();
    const button = screen.getByRole('button', { name: 'Submit application' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(
      screen.getByRole('button', { name: 'Submitting application...' }),
    ).toBeDisabled();
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/submit')),
    ).toHaveLength(1);
    resolveSubmission(
      jsonResponse(200, {
        success: true,
        data: {
          ...application,
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T12:30:00.000Z',
        },
        meta: { submitted_now: true },
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Application submitted' }),
    ).toBeVisible();
  });

  it('returns to editing and highlights answers after a commit-time validation race', async () => {
    renderSubmission(
      fetchForSubmission({
        submitResponse: jsonResponse(422, {
          success: false,
          error: {
            code: 'APPLICATION_INCOMPLETE',
            message: 'Complete required information.',
            fields: {
              missing_fields: [],
              missing_question_ids: [QUESTION_ID],
              invalid_question_ids: [],
            },
          },
        }),
      }),
    );
    await enterReview();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(
      await screen.findByText(/application changed while you were reviewing/i),
    ).toBeVisible();
    expect(
      screen.getByText('Review this answer before submitting.'),
    ).toBeVisible();
  });

  it('preserves the draft and blocks editing when the listing closes at submit time', async () => {
    renderSubmission(
      fetchForSubmission({
        submitResponse: jsonResponse(409, {
          success: false,
          error: {
            code: 'LISTING_NOT_AVAILABLE',
            message: 'No longer available.',
          },
        }),
      }),
    );
    await enterReview();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(
      await screen.findByText(/stopped accepting applications/i),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText('Preferred move-in date')).toBeDisabled();
    });
  });
});
