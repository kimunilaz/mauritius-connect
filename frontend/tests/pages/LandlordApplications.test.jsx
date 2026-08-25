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
const landlordProfile = { ...activeProfile, role: 'LANDLORD' };
const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function applicant(overrides = {}) {
  return {
    application_id: APPLICATION_ID,
    status: 'SUBMITTED',
    submitted_at: '2026-08-22T10:00:00.000Z',
    move_in_date: '2026-12-01',
    requested_lease_duration_months: 12,
    number_of_occupants: 2,
    updated_at: '2026-08-22T10:00:00.000Z',
    tenant: {
      first_name: 'Jane',
      last_name: 'Applicant',
      profile_photo_url: null,
    },
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
      listing: {
        id: LISTING_ID,
        title: 'Owned Moka listing',
        status: 'ACTIVE',
      },
      ...meta,
    },
  });
}

function detail(overrides = {}) {
  return {
    id: APPLICATION_ID,
    status: 'SUBMITTED',
    move_in_date: '2026-12-01',
    requested_lease_duration_months: 12,
    number_of_occupants: 2,
    introductory_message: 'Submitted tenant introduction',
    submitted_at: '2026-08-22T10:00:00.000Z',
    created_at: '2026-08-21T10:00:00.000Z',
    updated_at: '2026-08-22T10:00:00.000Z',
    tenant: {
      first_name: 'Jane',
      last_name: 'Applicant',
      profile_photo_url: null,
    },
    listing: {
      id: LISTING_ID,
      title: 'Owned Moka listing',
      status: 'CLOSED',
      property: {
        property_type: 'APARTMENT',
        district: 'Moka',
        locality: 'Saint Pierre',
        bedrooms: 2,
        bathrooms: 1.5,
        furnished: true,
        parking_spaces: 1,
      },
    },
    answers: [
      {
        question_text: 'Why this rental?',
        question_type: 'TEXT',
        answer_text: 'Submitted answer',
      },
    ],
    history: [
      {
        from_status: 'DRAFT',
        to_status: 'SUBMITTED',
        created_at: '2026-08-22T10:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('landlord applicant pipeline', () => {
  it('protects the route from logged-out users', async () => {
    renderApp({ route: `/landlord/listings/${LISTING_ID}/applications` });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
  });

  it('blocks TENANT users from the landlord pipeline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({
      route: `/landlord/listings/${LISTING_ID}/applications`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeVisible();
    expect(screen.queryByText('Applicant pipeline')).not.toBeInTheDocument();
  });

  it('shows the safe empty state without a DRAFT count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        return listResponse();
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}/applications`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText('No submitted applications yet'),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/draft count/i);
  });

  it('renders a submitted applicant card and a bearer-authenticated detail action', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return listResponse([applicant()]);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${LISTING_ID}/applications`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Applicant' }),
    ).toBeVisible();
    expect(screen.getByText('12 months')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'View application' }),
    ).toHaveAttribute('href', `/landlord/applications/${APPLICATION_ID}`);
    const call = fetchMock.mock.calls.find(([url]) =>
      url.includes(`/landlord/listings/${LISTING_ID}/applications?`),
    );
    expect(call[1].headers.Authorization).toBe('Bearer verified-access-token');
  });

  it('provides read-only status filters including both viewing stages', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return listResponse();
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${LISTING_ID}/applications`,
      client: sessionClient(),
    });
    await screen.findByText('No submitted applications yet');
    expect(
      screen.getByRole('button', { name: 'Viewing invited' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Viewing completed' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Shortlisted' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          url.includes('status=SHORTLISTED'),
        ),
      ).toBe(true),
    );
  });

  it('supports pagination with mobile-safe vertical applicant cards', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('page=2'))
        return listResponse([], { page: 2, total: 21, total_pages: 2 });
      return listResponse([applicant()], { total: 21, total_pages: 2 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderApp({
      route: `/landlord/listings/${LISTING_ID}/applications`,
      client: sessionClient(),
    });
    await screen.findByText('Jane Applicant');
    expect(container.querySelector('.applicant-card-grid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('No submitted applications yet'),
    ).toBeVisible();
  });

  it('does not render injected DRAFT or private tenant data', async () => {
    const record = applicant({
      status: 'SUBMITTED',
      draft_count: 99,
      tenant: {
        ...applicant().tenant,
        email: 'private@example.test',
        phone: '+23050000000',
        income_range: 'PRIVATE INCOME',
        employer_or_school: 'PRIVATE EMPLOYER',
        bio: 'PRIVATE BIO',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        return listResponse([record]);
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}/applications`,
      client: sessionClient(),
    });
    await screen.findByText('Jane Applicant');
    for (const privateValue of [
      'private@example.test',
      '+23050000000',
      'PRIVATE INCOME',
      'PRIVATE EMPLOYER',
      'PRIVATE BIO',
      '99',
    ])
      expect(document.body.textContent).not.toContain(privateValue);
  });
});

describe('landlord application detail', () => {
  it('shows submitted fields, answers, and timeline for a historical listing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        return jsonResponse(200, { success: true, data: detail() });
      }),
    );
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Applicant' }),
    ).toBeVisible();
    expect(screen.getByText('Submitted tenant introduction')).toBeVisible();
    expect(screen.getByText('Why this rental?')).toBeVisible();
    expect(screen.getByText('Submitted answer')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Status timeline' }),
    ).toBeVisible();
    expect(screen.getByText('Status: Closed')).toBeVisible();
  });

  it('renders only approved tenant identity fields and no actor IDs', async () => {
    const record = detail({
      tenant: {
        ...detail().tenant,
        email: 'private@example.test',
        phone: '+23050000000',
        bio: 'PRIVATE BIO',
      },
      history: [
        {
          from_status: 'DRAFT',
          to_status: 'SUBMITTED',
          created_at: '2026-08-22T10:00:00.000Z',
          changed_by_user_id: 'private-actor-id',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        return jsonResponse(200, { success: true, data: record });
      }),
    );
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    await screen.findByText('Submitted tenant introduction');
    for (const privateValue of [
      'private@example.test',
      '+23050000000',
      'PRIVATE BIO',
      'private-actor-id',
    ])
      expect(document.body.textContent).not.toContain(privateValue);
  });

  it('offers only the approved SUBMITTED actions and refreshes the timeline after review', async () => {
    let current = detail();
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.endsWith(`/${APPLICATION_ID}/review`)) {
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        current = detail({
          status: 'UNDER_REVIEW',
          history: [
            ...current.history,
            {
              from_status: 'SUBMITTED',
              to_status: 'UNDER_REVIEW',
              created_at: '2026-08-22T12:00:00.000Z',
            },
          ],
        });
        return jsonResponse(200, {
          success: true,
          data: { status: 'UNDER_REVIEW' },
          meta: { transitioned_now: true },
        });
      }
      return jsonResponse(200, { success: true, data: current });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mark under review' }),
    );
    expect(
      await screen.findByText('Application marked under review.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Shortlist' })).toBeVisible();
    expect(screen.getAllByText('Under Review').length).toBeGreaterThan(0);
    for (const action of [
      /accept/i,
      /viewing invite/i,
      /message/i,
      /score/i,
      /rank/i,
    ])
      expect(
        screen.queryByRole('button', { name: action }),
      ).not.toBeInTheDocument();
  });

  it.each([
    ['SUBMITTED', ['Mark under review', 'Reject application']],
    ['UNDER_REVIEW', ['Shortlist', 'Reject application']],
    ['SHORTLISTED', ['Reject application']],
  ])('shows the exact %s action set', async (status, actions) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        return jsonResponse(200, {
          success: true,
          data: detail({ status }),
        });
      }),
    );
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    await screen.findByText('Submitted tenant introduction');
    for (const action of actions)
      expect(screen.getByRole('button', { name: action })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Accept application' }),
    ).not.toBeInTheDocument();
  });

  it('accepts only a viewing-completed application after confirmation', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    let accepted = false;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.endsWith(`/${APPLICATION_ID}/accept`)) {
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        accepted = true;
        return jsonResponse(200, {
          success: true,
          data: { application_status: 'ACCEPTED', listing_status: 'RENTED' },
          meta: { transitioned_now: true },
        });
      }
      return jsonResponse(200, {
        success: true,
        data: detail({
          status: accepted ? 'ACCEPTED' : 'VIEWING_COMPLETED',
          listing: {
            ...detail().listing,
            status: accepted ? 'RENTED' : 'ACTIVE',
          },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Accept application' }),
    );
    expect(globalThis.confirm).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        'Application accepted and listing marked rented.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Status: Rented')).toBeVisible();
    expect(
      screen.getByText('No further review actions are available.'),
    ).toBeVisible();
  });

  it('requires confirmation before rejection and shows terminal state after success', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    let rejected = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        if (url.endsWith(`/${APPLICATION_ID}/reject`)) {
          rejected = true;
          return jsonResponse(200, {
            success: true,
            data: { status: 'REJECTED' },
            meta: { transitioned_now: true },
          });
        }
        return jsonResponse(200, {
          success: true,
          data: detail({ status: rejected ? 'REJECTED' : 'SUBMITTED' }),
        });
      }),
    );
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reject application' }),
    );
    expect(globalThis.confirm).toHaveBeenCalledOnce();
    expect(await screen.findByText('Application rejected.')).toBeVisible();
    expect(
      screen.getByText('No further review actions are available.'),
    ).toBeVisible();
  });

  it('shows a safe not-found state for inaccessible or DRAFT application IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
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
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Application unavailable' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Application not found.',
    );
  });
});

describe('landlord listing integration', () => {
  it('always exposes a read-only View applications action', async () => {
    const listing = {
      id: LISTING_ID,
      property_id: '50000000-0000-4000-8000-000000000001',
      title: 'Owned Moka listing',
      description: 'Listing description',
      monthly_rent: 18000,
      deposit_amount: 18000,
      available_from: '2026-12-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: false,
      status: 'CLOSED',
      images: [],
      property: {
        archived_at: null,
        locality: 'Moka',
        district: 'Moka',
        bedrooms: 2,
        bathrooms: 1,
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        if (url.endsWith(`/landlord/listings/${LISTING_ID}`)) {
          return jsonResponse(200, { success: true, data: listing });
        }
        if (
          url.endsWith(`/landlord/listings/${LISTING_ID}/application-questions`)
        ) {
          return jsonResponse(200, {
            success: true,
            data: [],
            meta: { editable: false, questions_locked: false },
          });
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({
      route: `/landlord/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('link', { name: 'View applications' }),
    ).toHaveAttribute('href', `/landlord/listings/${LISTING_ID}/applications`);
  });
});
