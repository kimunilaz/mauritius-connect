import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeProfile,
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

const LISTING_ID = '80000000-0000-4000-8000-000000000001';
const QUESTION_ID = '91000000-0000-4000-8000-000000000001';
const landlordProfile = { ...activeProfile, role: 'LANDLORD' };
const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

const property = {
  id: '50000000-0000-4000-8000-000000000001',
  property_type: 'APARTMENT',
  district: 'Moka',
  locality: 'Moka',
  bedrooms: 2,
  bathrooms: 1,
  furnished: true,
  parking_spaces: 1,
  verification_status: 'UNVERIFIED',
  archived_at: null,
};
const listing = {
  id: LISTING_ID,
  property_id: property.id,
  title: 'Modern apartment in Moka',
  description: 'Bright and comfortable home.',
  monthly_rent: 18000,
  deposit_amount: 18000,
  available_from: '2026-10-01',
  minimum_lease_months: 6,
  maximum_occupants: 3,
  pets_allowed: false,
  status: 'DRAFT',
  published_at: null,
  closed_at: null,
  property,
  images: [],
};
const question = {
  id: QUESTION_ID,
  question_text: 'When would you like to move in?',
  question_type: 'DATE',
  is_required: true,
  display_order: 0,
  options: [],
};

function questionListResponse(
  questions = [],
  meta = { locked: false, editable: true, listing_status: 'DRAFT' },
) {
  return jsonResponse(200, { success: true, data: questions, meta });
}

function landlordFetch({ questions = [], meta, mutate } = {}) {
  return vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
    if (url.endsWith(`/landlord/listings/${LISTING_ID}`)) {
      return jsonResponse(200, { success: true, data: listing });
    }
    if (
      url.endsWith(`/landlord/listings/${LISTING_ID}/application-questions`)
    ) {
      return questionListResponse(questions, meta);
    }
    if (url.includes(`/listings/${LISTING_ID}/application-questions`)) {
      if (mutate) return mutate(url, options);
      throw new Error(`Unexpected mutation ${options.method}`);
    }
    throw new Error(`Unexpected URL ${url}`);
  });
}

function publicDetailResponse() {
  return jsonResponse(200, {
    success: true,
    data: {
      id: LISTING_ID,
      title: listing.title,
      description: listing.description,
      monthly_rent: 18000,
      deposit_amount: 18000,
      available_from: '2026-10-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: false,
      published_at: '2026-08-22T00:00:00.000Z',
      images: [],
      property: {
        property_type: 'APARTMENT',
        district: 'Moka',
        locality: 'Moka',
        neighbourhood: null,
        bedrooms: 2,
        bathrooms: 1,
        furnished: true,
        parking_spaces: 1,
        property_information_verified: false,
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('landlord application question management', () => {
  it('shows the empty state and add action', async () => {
    vi.stubGlobal('fetch', landlordFetch());
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText('No application questions yet.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add question' })).toBeVisible();
  });

  it('renders an ordered landlord question list', async () => {
    vi.stubGlobal('fetch', landlordFetch({ questions: [question] }));
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(await screen.findByText(question.question_text)).toBeVisible();
    expect(screen.getByText('DATE · Order 0 · Required')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  it('creates a TEXT question through the bearer API', async () => {
    let reads = 0;
    const fetchMock = landlordFetch({
      mutate: (_url, options) => {
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        expect(JSON.parse(options.body)).toMatchObject({
          question_text: 'Tell us about your move',
          question_type: 'TEXT',
        });
        reads += 1;
        return jsonResponse(201, { success: true, data: question });
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add question' }),
    );
    fireEvent.change(screen.getByLabelText('Question'), {
      target: { value: 'Tell us about your move' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
    await waitFor(() => expect(reads).toBe(1));
  });

  it('creates a SELECT question with valid option structures', async () => {
    let payload;
    vi.stubGlobal(
      'fetch',
      landlordFetch({
        mutate: (_url, options) => {
          payload = JSON.parse(options.body);
          return jsonResponse(201, { success: true, data: question });
        },
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add question' }),
    );
    fireEvent.change(screen.getByLabelText('Question'), {
      target: { value: 'Preferred lease?' },
    });
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'SELECT' },
    });
    fireEvent.change(screen.getByLabelText('Option 1'), {
      target: { value: '12 months' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
    fireEvent.change(screen.getByLabelText('Option 2'), {
      target: { value: '24 months' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
    await waitFor(() =>
      expect(payload?.options).toEqual([
        { option_text: '12 months', display_order: 0 },
        { option_text: '24 months', display_order: 1 },
      ]),
    );
  });

  it('shows field validation without sending an invalid question', async () => {
    const fetchMock = landlordFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add question' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
    expect(await screen.findByText('Enter the question.')).toBeVisible();
    expect(
      fetchMock.mock.calls.some((call) => call[1]?.method === 'POST'),
    ).toBe(false);
  });

  it('edits an existing question', async () => {
    let payload;
    vi.stubGlobal(
      'fetch',
      landlordFetch({
        questions: [question],
        mutate: (_url, options) => {
          payload = JSON.parse(options.body);
          return jsonResponse(200, { success: true, data: question });
        },
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Question'), {
      target: { value: 'Updated move date?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }));
    await waitFor(() =>
      expect(payload?.question_text).toBe('Updated move date?'),
    );
  });

  it('confirms and deletes a question', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    let method;
    vi.stubGlobal(
      'fetch',
      landlordFetch({
        questions: [question],
        mutate: (_url, options) => {
          method = options.method;
          return jsonResponse(204, null);
        },
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(method).toBe('DELETE'));
    expect(globalThis.confirm).toHaveBeenCalledWith(
      `Delete “${question.question_text}”?`,
    );
  });

  it('renders submitted-question lock as read-only', async () => {
    vi.stubGlobal(
      'fetch',
      landlordFetch({
        questions: [question],
        meta: {
          locked: true,
          editable: false,
          listing_status: 'ACTIVE',
        },
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText(
        'Application questions are locked because applications have already been submitted.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Add question' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
  });

  it('protects question management from TENANT navigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeVisible();
    expect(screen.queryByText('Application questions')).not.toBeInTheDocument();
  });
});

describe('public application question presentation', () => {
  it('renders ACTIVE listing questions read-only without an application form', async () => {
    const selectQuestion = {
      ...question,
      question_type: 'SELECT',
      options: [
        {
          id: '92000000-0000-4000-8000-000000000001',
          option_text: '12 months',
          display_order: 0,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith(`/listings/${LISTING_ID}/application-questions`)) {
          return jsonResponse(200, { success: true, data: [selectQuestion] });
        }
        if (url.endsWith(`/listings/${LISTING_ID}`))
          return publicDetailResponse();
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    const section = await screen.findByRole('heading', {
      name: 'Application questions',
    });
    const region = section.closest('section');
    expect(within(region).getByText(question.question_text)).toBeVisible();
    expect(within(region).getByText('12 months')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /apply|submit/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/answer/i)).not.toBeInTheDocument();
  });

  it('omits the public section when no questions exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/application-questions')
          ? jsonResponse(200, { success: true, data: [] })
          : publicDetailResponse(),
      ),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    await screen.findByRole('heading', { name: listing.title });
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Application questions' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('does not expose questions when the public endpoint becomes unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/application-questions')
          ? jsonResponse(404, {
              success: false,
              error: {
                code: 'LISTING_NOT_FOUND',
                message: 'Listing not found.',
              },
            })
          : publicDetailResponse(),
      ),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    await screen.findByRole('heading', { name: listing.title });
    await waitFor(() =>
      expect(
        screen.queryByText(question.question_text),
      ).not.toBeInTheDocument(),
    );
  });
});
