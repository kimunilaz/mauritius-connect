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

const APPLICATION_ID = 'b0000000-0000-4000-8000-000000000001';
const LISTING_ID = '80000000-0000-4000-8000-000000000001';
const VIEWING_ID = 'e0000000-0000-4000-8000-000000000001';
const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function landlordApplication(status = 'SHORTLISTED') {
  return {
    id: APPLICATION_ID,
    status,
    move_in_date: '2026-12-01',
    requested_lease_duration_months: 12,
    number_of_occupants: 2,
    introductory_message: 'Introduction',
    submitted_at: '2026-08-22T10:00:00Z',
    tenant: {
      first_name: 'Jane',
      last_name: 'Applicant',
      profile_photo_url: null,
    },
    listing: {
      id: LISTING_ID,
      title: 'Moka home',
      status: 'CLOSED',
      property: {
        property_type: 'APARTMENT',
        district: 'Moka',
        locality: 'Moka',
        bedrooms: 2,
        bathrooms: 1,
      },
    },
    answers: [],
    history: [],
  };
}

function tenantApplication(status = 'VIEWING_INVITED') {
  return {
    id: APPLICATION_ID,
    listing_id: LISTING_ID,
    status,
    availability: 'UNAVAILABLE',
    listing: null,
    move_in_date: '2026-12-01',
    requested_lease_duration_months: 12,
    number_of_occupants: 2,
    introductory_message: 'Introduction',
    submitted_at: '2026-08-22T10:00:00Z',
    withdrawn_at: null,
    updated_at: '2026-08-22T10:00:00Z',
    answers: [],
    history: [],
  };
}

function viewing(status = 'PROPOSED', start = '2099-09-12T10:00:00Z') {
  return {
    id: VIEWING_ID,
    start_time: start,
    end_time: null,
    status,
    notes: 'Meet at the entrance.',
    created_at: '2026-08-22T10:00:00Z',
    updated_at: '2026-08-22T10:00:00Z',
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('viewing UX', () => {
  it('lets a landlord propose a future viewing with bearer authentication', async () => {
    let viewings = [];
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me'))
        return profileResponse({ ...activeProfile, role: 'LANDLORD' });
      if (
        url.endsWith(`/applications/${APPLICATION_ID}/viewings`) &&
        options.method !== 'POST'
      )
        return jsonResponse(200, { success: true, data: viewings });
      if (url.endsWith(`/landlord/applications/${APPLICATION_ID}/viewings`)) {
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        viewings = [viewing()];
        return jsonResponse(201, { success: true, data: viewings[0] });
      }
      return jsonResponse(200, {
        success: true,
        data: landlordApplication(
          viewings.length ? 'VIEWING_INVITED' : 'SHORTLISTED',
        ),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Propose viewing' }),
    );
    fireEvent.change(screen.getByLabelText('Start time *'), {
      target: { value: '2099-09-12T14:00' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send viewing proposal' }),
    );
    expect(await screen.findByText('Viewing proposed.')).toBeVisible();
    expect(screen.getByText('Meet at the entrance.')).toBeVisible();
  });

  it('shows tenant confirm, decline, cancel, and local date/time presentation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.endsWith(`/applications/${APPLICATION_ID}/viewings`))
          return jsonResponse(200, { success: true, data: [viewing()] });
        return jsonResponse(200, {
          success: true,
          data: tenantApplication(),
          meta: { editable: false, listing_available: false },
        });
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('button', { name: 'Confirm viewing' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Decline viewing' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Cancel viewing' }),
    ).toBeVisible();
    expect(screen.getByText(/12 Sept 2099/)).toBeVisible();
  });

  it.each([
    ['Confirm viewing', 'confirm'],
    ['Decline viewing', 'decline'],
  ])('executes tenant %s action', async (button, endpoint) => {
    let current = [viewing()];
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/${VIEWING_ID}/${endpoint}`)) {
        current = [viewing(endpoint === 'confirm' ? 'CONFIRMED' : 'DECLINED')];
        return jsonResponse(200, { success: true, data: current[0], meta: {} });
      }
      if (url.endsWith(`/applications/${APPLICATION_ID}/viewings`))
        return jsonResponse(200, { success: true, data: current });
      return jsonResponse(200, {
        success: true,
        data: tenantApplication(),
        meta: { editable: false },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(await screen.findByRole('button', { name: button }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          url.endsWith(`/${VIEWING_ID}/${endpoint}`),
        ),
      ).toBe(true),
    );
  });

  it('shows landlord complete/no-show/cancel after the confirmed start', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me'))
          return profileResponse({ ...activeProfile, role: 'LANDLORD' });
        if (url.endsWith(`/applications/${APPLICATION_ID}/viewings`))
          return jsonResponse(200, {
            success: true,
            data: [viewing('CONFIRMED', '2020-09-12T10:00:00Z')],
          });
        return jsonResponse(200, {
          success: true,
          data: landlordApplication('VIEWING_INVITED'),
        });
      }),
    );
    renderApp({
      route: `/landlord/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('button', { name: 'Complete viewing' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark no-show' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Cancel viewing' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /accept/i }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/message tenant|reminder/i);
  });

  it('renders historical viewings read-only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.endsWith(`/applications/${APPLICATION_ID}/viewings`))
          return jsonResponse(200, {
            success: true,
            data: [viewing('DECLINED')],
          });
        return jsonResponse(200, {
          success: true,
          data: tenantApplication(),
          meta: { editable: false },
        });
      }),
    );
    renderApp({
      route: `/tenant/applications/${APPLICATION_ID}`,
      client: sessionClient(),
    });
    expect(await screen.findByText('Declined')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /viewing/i }),
    ).not.toBeInTheDocument();
  });
});
