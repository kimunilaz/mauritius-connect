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

function draft(overrides = {}) {
  return {
    id: APPLICATION_ID,
    listing_id: LISTING_ID,
    move_in_date: null,
    requested_lease_duration_months: null,
    number_of_occupants: null,
    introductory_message: null,
    status: 'DRAFT',
    created_at: '2026-08-22T08:00:00.000Z',
    updated_at: '2026-08-22T08:00:00.000Z',
    ...overrides,
  };
}

function draftResponse(application = draft(), meta = {}) {
  return jsonResponse(200, {
    success: true,
    data: application,
    meta: {
      listing_available: true,
      editable: true,
      ...meta,
    },
  });
}

function emptyQuestionsResponse() {
  return jsonResponse(200, { success: true, data: [] });
}

function emptyAnswersResponse() {
  return jsonResponse(200, { success: true, data: [] });
}

function publicDetail() {
  return {
    id: LISTING_ID,
    title: 'Modern apartment in Moka',
    description: 'A bright and comfortable home.',
    monthly_rent: 18000,
    deposit_amount: 18000,
    available_from: '2026-10-01',
    minimum_lease_months: 6,
    maximum_occupants: 3,
    pets_allowed: true,
    published_at: '2026-08-20T10:00:00.000Z',
    images: [],
    property: {
      property_type: 'APARTMENT',
      district: 'Moka',
      locality: 'Saint Pierre',
      neighbourhood: 'Helvetia',
      bedrooms: 2,
      bathrooms: 1.5,
      furnished: true,
      parking_spaces: 1,
      property_information_verified: false,
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('application draft protected route', () => {
  it('redirects a logged-out visitor to login', async () => {
    renderApp({ route: `/listings/${LISTING_ID}/apply` });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
  });

  it('redirects a LANDLORD away from the tenant draft route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        profileResponse({
          ...activeProfile,
          role: 'LANDLORD',
        }),
      ),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Rental application' }),
    ).not.toBeInTheDocument();
  });

  it('creates or restores the tenant draft with a bearer-authenticated POST', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        expect(JSON.parse(options.body)).toEqual({});
        return draftResponse();
      }
      if (url.endsWith('/application-questions')) {
        return emptyQuestionsResponse();
      }
      if (url.endsWith(`/applications/${APPLICATION_ID}/answers`)) {
        return emptyAnswersResponse();
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Rental application' }),
    ).toBeVisible();
    expect(screen.getByText('Draft')).toBeVisible();
    expect(screen.getByText(/is not submitted/i)).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Save draft' }),
    ).toBeEnabled();
  });

  it('edits and saves only the four draft fields', async () => {
    let updateBody;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
        return draftResponse();
      }
      if (url.endsWith('/application-questions')) {
        return emptyQuestionsResponse();
      }
      if (
        url.endsWith(`/applications/${APPLICATION_ID}/answers`) &&
        options.method === 'GET'
      ) {
        return emptyAnswersResponse();
      }
      if (
        url.endsWith(`/applications/${APPLICATION_ID}`) &&
        options.method === 'PATCH'
      ) {
        updateBody = JSON.parse(options.body);
        return draftResponse(draft({ ...updateBody }));
      }
      if (
        url.endsWith(`/applications/${APPLICATION_ID}/answers`) &&
        options.method === 'PUT'
      ) {
        return emptyAnswersResponse();
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    fireEvent.change(await screen.findByLabelText('Preferred move-in date'), {
      target: { value: '2026-12-01' },
    });
    fireEvent.change(
      screen.getByLabelText('Requested lease duration (months)'),
      { target: { value: '12' } },
    );
    fireEvent.change(screen.getByLabelText('Number of occupants'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Brief introduction'), {
      target: { value: '  A quiet household.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText(
        'Draft and answers saved. They have not been submitted.',
      ),
    ).toBeVisible();
    expect(updateBody).toEqual({
      move_in_date: '2026-12-01',
      requested_lease_duration_months: 12,
      number_of_occupants: 2,
      introductory_message: 'A quiet household.',
    });
    expect(Object.keys(updateBody)).not.toContain('status');
  });

  it('shows preserved unavailable state and disables all editing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
          return draftResponse(
            draft({ introductory_message: 'Preserved tenant text' }),
            { listing_available: false, editable: false },
          );
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    expect(await screen.findByText('Editing unavailable')).toBeVisible();
    expect(screen.getByText(/draft has been preserved/i)).toBeVisible();
    expect(screen.getByLabelText('Brief introduction')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save draft' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /submit/i }),
    ).not.toBeInTheDocument();
  });

  it('shows a safe unavailable state when no new draft can be created', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
          return jsonResponse(404, {
            success: false,
            error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found.' },
          });
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    expect(await screen.findByText('Draft unavailable')).toBeVisible();
    expect(screen.getByText(/no new draft can be created/i)).toBeVisible();
  });

  it('handles an edit-time listing availability race safely', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}/applications`)) {
        return draftResponse();
      }
      if (url.endsWith('/application-questions')) {
        return emptyQuestionsResponse();
      }
      if (url.endsWith(`/applications/${APPLICATION_ID}/answers`)) {
        return emptyAnswersResponse();
      }
      if (options.method === 'PATCH') {
        return jsonResponse(409, {
          success: false,
          error: {
            code: 'LISTING_NOT_AVAILABLE',
            message: 'This rental is no longer accepting changes.',
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}/apply`,
      client: sessionClient(),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Editing unavailable')).toBeVisible();
    expect(screen.getByLabelText('Brief introduction')).toBeDisabled();
  });
});

describe('public listing application affordance', () => {
  it('offers logged-out visitors login with the application destination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith(`/listings/${LISTING_ID}`)) {
          return jsonResponse(200, { success: true, data: publicDetail() });
        }
        if (url.endsWith('/application-questions')) {
          return jsonResponse(200, { success: true, data: [] });
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    expect(
      await screen.findByRole('link', { name: 'Log in to apply' }),
    ).toHaveAttribute('href', '/login');
  });

  it('offers authenticated tenants start-or-continue without creating on view', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}`)) {
        return jsonResponse(200, { success: true, data: publicDetail() });
      }
      if (url.endsWith('/application-questions')) {
        return jsonResponse(200, { success: true, data: [] });
      }
      if (url.endsWith(`/tenant/saved-listings/${LISTING_ID}/status`)) {
        return jsonResponse(200, {
          success: true,
          data: { listing_id: LISTING_ID, saved: false },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('link', {
        name: 'Start or continue application',
      }),
    ).toHaveAttribute('href', `/listings/${LISTING_ID}/apply`);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith('/applications')),
      ).toBe(false),
    );
  });

  it('does not offer LANDLORD application actions', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) {
        return profileResponse({ ...activeProfile, role: 'LANDLORD' });
      }
      if (url.endsWith(`/listings/${LISTING_ID}`)) {
        return jsonResponse(200, { success: true, data: publicDetail() });
      }
      if (url.endsWith('/application-questions')) {
        return jsonResponse(200, { success: true, data: [] });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Modern apartment in Moka' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /apply/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /application/i }),
    ).not.toBeInTheDocument();
  });
});
