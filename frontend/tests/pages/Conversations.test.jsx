import { fireEvent, screen } from '@testing-library/react';
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
const CONVERSATION_ID = 'f0000000-0000-4000-8000-000000000001';
const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function listingDetail() {
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
      locality: 'Moka',
      neighbourhood: null,
      bedrooms: 2,
      bathrooms: 1,
      furnished: true,
      parking_spaces: 1,
      property_information_verified: false,
    },
  };
}

function conversation({ available = true } = {}) {
  return {
    id: CONVERSATION_ID,
    created_at: '2026-08-22T10:00:00.000Z',
    updated_at: '2026-08-22T11:00:00.000Z',
    counterparty: {
      first_name: 'Lina',
      last_name: 'Owner',
      profile_photo_url: null,
    },
    listing_context: {
      listing_id: LISTING_ID,
      availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
      listing: available
        ? {
            id: LISTING_ID,
            title: 'Modern apartment in Moka',
            status: 'ACTIVE',
          }
        : null,
    },
  };
}

function conversationListResponse(records = [conversation()]) {
  return jsonResponse(200, {
    success: true,
    data: records,
    meta: {
      page: 1,
      limit: 20,
      total: records.length,
      total_pages: records.length ? 1 : 0,
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('conversation foundation UX', () => {
  it.each(['/conversations', `/conversations/${CONVERSATION_ID}`])(
    'protects %s from logged-out access',
    async (route) => {
      vi.stubGlobal('fetch', vi.fn());
      renderApp({ route });
      expect(
        await screen.findByRole('heading', { name: 'Welcome back' }),
      ).toBeVisible();
    },
  );

  it('offers logged-out users login to contact the landlord', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { success: true, data: listingDetail() }),
        ),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    expect(
      await screen.findByRole('link', { name: 'Log in to contact landlord' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Contact landlord' }),
    ).not.toBeInTheDocument();
  });

  it('lets a TENANT create/reuse a bearer-authenticated conversation and redirects', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}/application-questions`))
        return jsonResponse(200, { success: true, data: [] });
      if (url.endsWith(`/tenant/saved-listings/${LISTING_ID}/status`))
        return jsonResponse(200, {
          success: true,
          data: { listing_id: LISTING_ID, saved: false },
        });
      if (url.endsWith(`/listings/${LISTING_ID}/conversation`)) {
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe(
          'Bearer verified-access-token',
        );
        return jsonResponse(201, {
          success: true,
          data: conversation(),
          meta: { created_now: true },
        });
      }
      if (url.endsWith(`/conversations/${CONVERSATION_ID}`))
        return jsonResponse(200, { success: true, data: conversation() });
      return jsonResponse(200, { success: true, data: listingDetail() });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Contact landlord' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Lina Owner' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeVisible();
  });

  it('does not show tenant conversation creation to a LANDLORD', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/auth/me')
          ? profileResponse({ ...activeProfile, role: 'LANDLORD' })
          : jsonResponse(200, { success: true, data: listingDetail() }),
      ),
    );
    renderApp({
      route: `/listings/${LISTING_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Modern apartment in Moka' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Contact landlord' }),
    ).not.toBeInTheDocument();
  });

  it('renders conversation list counterparty and rental context', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/auth/me')
          ? profileResponse()
          : conversationListResponse(),
      ),
    );
    renderApp({ route: '/conversations', client: sessionClient() });
    expect(await screen.findByText('Lina Owner')).toBeVisible();
    expect(screen.getByText('Modern apartment in Moka')).toBeVisible();
    expect(screen.getByRole('link', { name: /Lina Owner/i })).toHaveAttribute(
      'href',
      `/conversations/${CONVERSATION_ID}`,
    );
    expect(document.body.textContent).not.toMatch(/unread|last message/i);
  });

  it('renders role-specific empty states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/auth/me')
          ? profileResponse({ ...activeProfile, role: 'LANDLORD' })
          : conversationListResponse([]),
      ),
    );
    renderApp({ route: '/conversations', client: sessionClient() });
    expect(
      await screen.findByRole('heading', {
        name: 'No tenant conversations yet',
      }),
    ).toBeVisible();
  });

  it('shows unavailable context without private fields or message/read UI', async () => {
    const privatePayload = conversation({ available: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/auth/me')
          ? profileResponse()
          : jsonResponse(200, { success: true, data: privatePayload }),
      ),
    );
    renderApp({
      route: `/conversations/${CONVERSATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Rental context' }),
    ).toBeVisible();
    expect(screen.getByText('Rental unavailable')).toBeVisible();
    expect(document.body.textContent).not.toMatch(
      /address|phone|email|unread/i,
    );
    expect(
      screen.getByRole('textbox', { name: 'Message' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Send message' }),
    ).toBeInTheDocument();
  });

  it('handles a privacy-safe conversation 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        return jsonResponse(404, {
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found.',
          },
        });
      }),
    );
    renderApp({
      route: `/conversations/${CONVERSATION_ID}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Conversation unavailable' }),
    ).toBeVisible();
  });
});
