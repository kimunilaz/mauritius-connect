import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  operationalOverview,
  ownerOperations,
} from '../../../e2e/workspace-fixtures.js';
import {
  activeProfile,
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

afterEach(() => vi.unstubAllGlobals());
function setup(role, empty = false, fail = false) {
  let failing = fail;
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = new globalThis.URL(input);
      calls.push(url);
      if (url.pathname.endsWith('/auth/me'))
        return profileResponse({ ...activeProfile, role });
      if (
        url.pathname.includes('/overview/') ||
        url.pathname.endsWith('/operations/summary')
      ) {
        if (failing)
          return jsonResponse(503, {
            success: false,
            error: { message: 'Unavailable' },
          });
        return jsonResponse(200, {
          success: true,
          data:
            role === 'LANDLORD'
              ? ownerOperations(empty)
              : operationalOverview(role, empty),
        });
      }
      let data = [];
      if (!empty && url.pathname.endsWith('/listings'))
        data = [
          {
            id: 'owned-listing-' + url.searchParams.get('status'),
            title: 'Owned apartment',
            status: url.searchParams.get('status'),
          },
        ];
      if (!empty && url.pathname.endsWith('/verifications'))
        data = [
          {
            id: 'verification',
            type: 'LANDLORD_IDENTITY',
            status: 'UNDER_REVIEW',
            evidence_path: 'PRIVATE EVIDENCE',
          },
        ];
      if (!empty && url.pathname.endsWith('/conversations'))
        data = [
          {
            id: 'conversation',
            unread_count: 4,
            last_message: { content: 'PRIVATE MESSAGE' },
          },
        ];
      return jsonResponse(200, {
        success: true,
        data,
        meta: { total: empty ? 0 : 8, total_pages: empty ? 0 : 1, page: 1 },
      });
    }),
  );
  renderApp({
    route: '/account',
    client: createFakeSupabaseClient({ session: createSession() }),
  });
  return {
    calls,
    recover: () => {
      failing = false;
    },
  };
}

it.each(['LANDLORD', 'ADMIN'])(
  'shows a practical empty overview for %s',
  async (role) => {
    setup(role, true);
    await screen.findByText(
      role === 'ADMIN'
        ? 'Nothing currently needs review.'
        : /Add your first property/,
    );
    expect(screen.getByRole('main')).not.toHaveTextContent(
      /personal workspace|next chapter|Account status|Your platform/,
    );
    expect(
      screen.getByRole('main').querySelector('.primary-link-button'),
    ).toBeNull();
  },
);

it('shows owner operations with one bounded summary request and no leasing dependency', async () => {
  const { calls } = setup('LANDLORD');
  await screen.findByText('Rent overdue');
  expect(screen.getByText('Routine inspection')).toBeInTheDocument();
  expect(screen.getByText('Jamie Tenant')).toBeInTheDocument();
  expect(
    screen.queryByText(/PRIVATE MESSAGE|PRIVATE EVIDENCE/),
  ).not.toBeInTheDocument();
  expect(
    calls.filter((u) => u.pathname.endsWith('/operations/summary')),
  ).toHaveLength(1);
  expect(calls.filter((u) => u.pathname.endsWith('/listings'))).toHaveLength(0);
  expect(screen.getByRole('link', { name: 'Rent overdue' })).toHaveAttribute(
    'href',
    expect.stringContaining('tab=rent'),
  );
});

it('shows admin queue totals and links without requesting private content', async () => {
  const { calls } = setup('ADMIN');
  await screen.findByText('Apartment awaiting approval');
  expect(screen.getByText('Incorrect information')).toBeInTheDocument();
  expect(screen.getByText('Sam Example')).toBeInTheDocument();
  expect(screen.getByText('Under review')).toBeInTheDocument();
  expect(calls.map((url) => url.pathname)).toEqual([
    '/api/v1/auth/me',
    '/api/v1/overview/admin',
  ]);
  expect(
    within(
      screen.getByRole('navigation', { name: 'Admin navigation' }),
    ).queryByText('Messages'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('main').querySelector('.primary-link-button'),
  ).toBeNull();
});

it.each(['LANDLORD', 'ADMIN'])(
  'recovers %s summaries without claiming failed queues are empty',
  async (role) => {
    const { recover } = setup(role, false, true);
    await screen.findByRole('alert');
    expect(
      screen.queryByText('Nothing currently needs review.'),
    ).not.toBeInTheDocument();
    if (role === 'ADMIN')
      expect(
        within(
          screen.getByRole('region', { name: 'Activity summary' }),
        ).getAllByText('Unavailable').length,
      ).toBeGreaterThan(0);
    recover();
    fireEvent.click(
      screen.getByRole('button', {
        name: role === 'ADMIN' ? 'Retry overview' : 'Try again',
      }),
    );
    await screen.findByText(
      role === 'ADMIN' ? 'Apartment awaiting approval' : 'Rent overdue',
    );
  },
);
