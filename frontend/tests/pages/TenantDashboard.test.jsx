import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

afterEach(() => vi.unstubAllGlobals());

function setup({ empty = false, fail = false } = {}) {
  let failing = fail;
  const fetchMock = vi.fn(async (input) => {
    const url = new globalThis.URL(input);
    if (url.pathname.endsWith('/auth/me')) return profileResponse();
    if (failing && url.pathname.endsWith('/saved-listings'))
      return jsonResponse(503, {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Unavailable' },
      });
    let data = [];
    let total = 0;
    let pages = 0;
    if (url.pathname.endsWith('/unread-count'))
      data = { unread_count: empty ? 0 : 4 };
    else if (!empty) {
      total = 7;
      pages = 1;
      if (url.pathname.endsWith('/saved-listings'))
        data = [
          {
            id: 'save',
            availability: 'UNAVAILABLE',
            listing: { title: 'Private home' },
          },
        ];
      if (url.pathname.endsWith('/applications'))
        data = [
          {
            id: url.searchParams.has('status') ? 'invited' : 'recent',
            status: url.searchParams.has('status')
              ? 'VIEWING_INVITED'
              : 'SUBMITTED',
            availability: 'UNAVAILABLE',
            listing: { title: 'Private application' },
          },
        ];
      if (url.pathname.endsWith('/conversations')) {
        pages = 2;
        data = [
          {
            unread_count: Number(url.searchParams.get('page')),
            last_message: { content: 'Private message' },
          },
        ];
      }
    }
    return jsonResponse(200, {
      success: true,
      data,
      meta: {
        total,
        total_pages: pages,
        page: Number(url.searchParams.get('page') ?? 1),
      },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  renderApp({
    route: '/account',
    client: createFakeSupabaseClient({ session: createSession() }),
  });
  return {
    recover: () => {
      failing = false;
    },
  };
}

it('offers one concise primary action only when all activity is empty', async () => {
  setup({ empty: true });
  await screen.findByRole('heading', { name: 'Welcome, Jane' });
  const main = within(screen.getByRole('main'));
  expect(main.getAllByRole('link')).toHaveLength(1);
  expect(main.getByRole('link', { name: 'Browse rentals' })).toHaveAttribute(
    'href',
    '/listings',
  );
  expect(
    main.queryByRole('region', { name: 'Rental activity' }),
  ).not.toBeInTheDocument();
});

it('uses totals and bounded recent conversations, prioritizes invitations, and hides private content', async () => {
  setup();
  const metrics = await screen.findByRole('region', {
    name: 'Rental activity',
  });
  expect(
    await within(metrics).findByRole('link', {
      name: 'Messages 1 unread in the 3 most recent conversations',
    }),
  ).toBeInTheDocument();
  expect(
    within(metrics).getByRole('link', { name: 'Saved homes 7 homes saved' }),
  ).toBeInTheDocument();
  expect(
    within(metrics).getByRole('link', {
      name: 'Notifications 4 unread notifications',
    }),
  ).toBeInTheDocument();
  const applications = screen.getByRole('region', { name: 'Applications' });
  expect(within(applications).getAllByRole('listitem')[0]).toHaveTextContent(
    'Viewing proposed',
  );
  expect(
    screen.queryByText(/Private home|Private application|Private message/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('main').querySelector('.primary-link-button'),
  ).toBeNull();
});

it('preserves successful activity during partial failure and supports retry', async () => {
  const { recover } = setup({ fail: true });
  await screen.findByRole('alert');
  expect(
    await screen.findByRole('link', {
      name: 'Saved homes Unavailable homes saved',
    }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('link', {
      name: 'Messages 1 unread in the 3 most recent conversations',
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Welcome, Jane' }),
  ).not.toBeInTheDocument();
  recover();
  fireEvent.click(screen.getByRole('button', { name: 'Retry overview' }));
  expect(
    await screen.findByRole('link', { name: 'Saved homes 7 homes saved' }),
  ).toBeInTheDocument();
});
