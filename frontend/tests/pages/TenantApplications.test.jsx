import { fireEvent, screen, waitFor } from '@testing-library/react';
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
const APPLICATION_ID = 'b0000000-0000-4000-8000-000000000001';
const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function listing() {
  return {
    id: LISTING_ID,
    title: 'Safe public Moka apartment',
    monthly_rent: 18000,
    available_from: '2026-10-01',
    minimum_lease_months: 6,
    maximum_occupants: 3,
    pets_allowed: true,
    published_at: '2026-08-20T10:00:00.000Z',
    cover_image_url: 'https://storage.test/signed-cover',
    property: {
      property_type: 'APARTMENT',
      district: 'Moka',
      locality: 'Saint Pierre',
      neighbourhood: null,
      bedrooms: 2,
      bathrooms: 1.5,
      furnished: true,
      parking_spaces: 1,
      property_information_verified: false,
    },
  };
}

function application(overrides = {}) {
  return {
    id: APPLICATION_ID,
    listing_id: LISTING_ID,
    move_in_date: '2026-10-15',
    requested_lease_duration_months: 12,
    number_of_occupants: 2,
    introductory_message: 'My own introduction',
    status: 'DRAFT',
    submitted_at: null,
    withdrawn_at: null,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-22T10:00:00.000Z',
    availability: 'AVAILABLE',
    listing: listing(),
    answers: [],
    history: [],
    ...overrides,
  };
}

function listResponse(applications = [], meta = {}) {
  return jsonResponse(200, {
    success: true,
    data: applications,
    meta: {
      page: 1,
      limit: 20,
      total: applications.length,
      total_pages: applications.length ? 1 : 0,
      ...meta,
    },
  });
}

function detailResponse(record = application(), meta = {}) {
  return jsonResponse(200, {
    success: true,
    data: record,
    meta: {
      listing_available: record.availability === 'AVAILABLE',
      editable:
        record.status === 'DRAFT' && record.availability === 'AVAILABLE',
      ...meta,
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('tenant applications list', () => {
  it('redirects logged-out visitors to login', async () => {
    renderApp({ route: '/tenant/applications' });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
  });

  it('redirects landlords away from the tenant route', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          profileResponse({ ...activeProfile, role: 'LANDLORD' }),
        ),
    );
    renderApp({ route: '/tenant/applications', client: sessionClient() });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeVisible();
    expect(screen.queryByText('My applications')).not.toBeInTheDocument();
  });

  it('renders an available draft with a continuation action and bearer authentication', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.includes('/tenant/applications?'))
        return listResponse([application()]);
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/tenant/applications', client: sessionClient() });

    expect(
      await screen.findByRole('heading', {
        name: 'Safe public Moka apartment',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Continue application' }),
    ).toHaveAttribute('href', `/listings/${LISTING_ID}/apply`);
    const listCall = fetchMock.mock.calls.find(([url]) =>
      url.includes('/tenant/applications?'),
    );
    expect(listCall[1].headers.Authorization).toBe(
      'Bearer verified-access-token',
    );
  });

  it('renders a minimal unavailable item without private former listing data', async () => {
    const privateRecord = application({
      availability: 'UNAVAILABLE',
      listing: null,
      former_title: 'Private former title',
      address_line_1: 'Private street',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return listResponse([privateRecord]);
      }),
    );
    renderApp({ route: '/tenant/applications', client: sessionClient() });
    expect(
      await screen.findByText(/listing is no longer public/i),
    ).toBeVisible();
    expect(screen.queryByText('Private former title')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Private street');
    expect(
      screen.getByRole('link', { name: 'View application' }),
    ).toHaveAttribute('href', `/tenant/applications/${APPLICATION_ID}`);
  });

  it('renders a submitted application card with its submitted date and detail action', async () => {
    const submitted = application({
      status: 'SUBMITTED',
      submitted_at: '2026-08-22T11:00:00.000Z',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return listResponse([submitted]);
      }),
    );
    renderApp({ route: '/tenant/applications', client: sessionClient() });
    expect(await screen.findByText('Status:')).toBeVisible();
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
    expect(screen.getByText(/Submitted 22 Aug 2026/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'View application' }),
    ).toHaveAttribute('href', `/tenant/applications/${APPLICATION_ID}`);
  });

  it('filters by every approved status through the API', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.includes('/tenant/applications?')) return listResponse();
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/tenant/applications', client: sessionClient() });
    await screen.findByText('No applications found');
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'UNDER_REVIEW' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          url.includes('status=UNDER_REVIEW'),
        ),
      ).toBe(true),
    );
  });

  it('supports pagination and an accessible empty state', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.includes('page=2'))
        return listResponse([], { page: 2, total: 21, total_pages: 2 });
      if (url.includes('/tenant/applications?'))
        return listResponse([application()], { total: 21, total_pages: 2 });
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/tenant/applications', client: sessionClient() });
    await screen.findByRole('heading', { name: 'Safe public Moka apartment' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('No applications found')).toBeVisible();
  });

  it('shows loading, safe failure, and retry states', async () => {
    let resolveList;
    const pending = new Promise((resolve) => {
      resolveList = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => {
        if (url.endsWith('/auth/me')) return Promise.resolve(profileResponse());
        if (url.includes('/tenant/applications?')) return pending;
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: '/tenant/applications', client: sessionClient() });
    expect(await screen.findByText('Loading applications...')).toBeVisible();
    resolveList(
      jsonResponse(503, {
        success: false,
        error: {
          code: 'UNAVAILABLE',
          message: 'Applications are temporarily unavailable.',
        },
      }),
    );
    expect(
      await screen.findByText('Applications are temporarily unavailable.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
});

describe('tenant application detail', () => {
  it('shows safe own fields, submitted answers, public listing data, and status history', async () => {
    const record = application({
      status: 'SUBMITTED',
      submitted_at: '2026-08-22T11:00:00.000Z',
      answers: [
        {
          question_id: '90000000-0000-4000-8000-000000000001',
          question_text: 'Why this home?',
          question_type: 'TEXT',
          answer_text: 'My submitted answer',
          updated_at: '2026-08-22T10:59:00.000Z',
        },
      ],
      history: [
        {
          from_status: 'DRAFT',
          to_status: 'SUBMITTED',
          created_at: '2026-08-22T11:00:00.000Z',
          changed_by_user_id: 'must-never-render',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.endsWith(`/applications/${APPLICATION_ID}`))
          return detailResponse(record);
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });

    expect(await screen.findByText('My own introduction')).toBeVisible();
    expect(screen.getByText('Why this home?')).toBeVisible();
    expect(screen.getByText('My submitted answer')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Safe public Moka apartment' }),
    ).toBeVisible();
    expect(screen.getByText('Status timeline')).toBeVisible();
    expect(document.body.textContent).not.toContain('must-never-render');
    expect(
      screen.getByRole('button', { name: 'Withdraw application' }),
    ).toBeVisible();
  });

  it('allows an available DRAFT to continue editing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return detailResponse();
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('link', { name: 'Continue editing' }),
    ).toHaveAttribute('href', `/listings/${LISTING_ID}/apply`);
  });

  it('preserves an unavailable DRAFT as read-only and hides private listing fields', async () => {
    const record = application({
      availability: 'UNAVAILABLE',
      listing: null,
      private_title: 'Hidden private rental',
      answers: [
        {
          question_id: 'q1',
          answer_text: 'Retained own answer',
          updated_at: '2026-08-22',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return detailResponse(record, {
          listing_available: false,
          editable: false,
        });
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText('This application is read-only.'),
    ).toBeVisible();
    expect(screen.getByText('Retained own answer')).toBeVisible();
    expect(screen.queryByText('Hidden private rental')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Continue editing' }),
    ).not.toBeInTheDocument();
  });

  it('keeps submitted applications read-only', async () => {
    const record = application({
      status: 'SUBMITTED',
      submitted_at: '2026-08-22T11:00:00Z',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return detailResponse(record, { editable: false });
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText('This application is read-only.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Continue editing' }),
    ).not.toBeInTheDocument();
  });

  it('confirms withdrawal, authenticates the action, and refreshes terminal state', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    let withdrawn = false;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/${APPLICATION_ID}/withdraw`)) {
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        withdrawn = true;
        return jsonResponse(200, {
          success: true,
          data: { status: 'WITHDRAWN' },
          meta: { transitioned_now: true },
        });
      }
      return detailResponse(
        application({
          status: withdrawn ? 'WITHDRAWN' : 'SUBMITTED',
          submitted_at: '2026-08-22T11:00:00Z',
          withdrawn_at: withdrawn ? '2026-08-22T12:00:00Z' : null,
        }),
        { editable: false },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Withdraw application' }),
    );
    expect(globalThis.confirm).toHaveBeenCalledOnce();
    expect(await screen.findByText('Application withdrawn.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Withdraw application' }),
    ).not.toBeInTheDocument();
  });

  it.each(['DRAFT', 'REJECTED', 'WITHDRAWN'])(
    'does not offer withdrawal for %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => {
          if (url.endsWith('/auth/me')) return profileResponse();
          return detailResponse(application({ status }), { editable: false });
        }),
      );
      renderApp({
        route: `/tenant/applications/${APPLICATION_ID}`,
        client: sessionClient(),
      });
      await screen.findByText('Application details');
      expect(
        screen.queryByRole('button', { name: 'Withdraw application' }),
      ).not.toBeInTheDocument();
    },
  );

  it('renders a safe not-found error for inaccessible applications', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return jsonResponse(404, {
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Application not found.',
          },
        });
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Application not found.',
    );
  });
});
