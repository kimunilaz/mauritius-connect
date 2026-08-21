import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeProfile,
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  onboardingResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registration and login', () => {
  it('validates password confirmation before Supabase registration', async () => {
    const client = createFakeSupabaseClient();
    renderApp({ route: '/register', client });

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'jane@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password-one' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password-two' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument();
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('uses Supabase signup and handles email-confirmation mode', async () => {
    const client = createFakeSupabaseClient();
    client.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'new-user' } },
      error: null,
    });
    renderApp({ route: '/register', client });

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'jane@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Check your email to confirm your account.'),
    ).toBeInTheDocument();
    expect(client.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.test',
        password: 'long-enough-password',
      }),
    );
  });

  it('logs in, resolves /auth/me, and opens the account page', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({ route: '/login', client });

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'jane@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer verified-access-token',
        }),
      }),
    );
  });

  it('routes a valid Supabase login without a profile to onboarding', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(onboardingResponse()));
    renderApp({ route: '/login', client });

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByRole('heading', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
  });
});

describe('recovery flows', () => {
  it('shows neutral forgot-password confirmation', async () => {
    const client = createFakeSupabaseClient();
    client.auth.resetPasswordForEmail.mockResolvedValue({
      error: new Error('Unknown email'),
    });
    renderApp({ route: '/forgot-password', client });

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'unknown@example.test' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send reset instructions' }),
    );

    expect(
      await screen.findByText(
        'If an account is associated with that email, check your inbox for password reset instructions.',
      ),
    ).toBeInTheDocument();
  });

  it('exchanges a PKCE callback code and routes an unonboarded user', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient();
    client.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(onboardingResponse()));
    renderApp({ route: '/auth/callback?code=safe-code', client });

    expect(
      await screen.findByRole('heading', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      'safe-code',
    );
  });

  it('accepts an automatically restored implicit callback session', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient({ session });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(onboardingResponse()));
    renderApp({ route: '/auth/callback', client });

    expect(
      await screen.findByRole('heading', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
    expect(client.auth.getSession).toHaveBeenCalled();
    expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('updates a password through the authenticated recovery session', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient({ session });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({ route: '/reset-password', client });

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'new-secure-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(client.auth.updateUser).toHaveBeenCalledWith({
        password: 'new-secure-password',
      });
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeInTheDocument();
  });
});

describe('onboarding and protected routes', () => {
  it('redirects unauthenticated account access to login', async () => {
    renderApp({ route: '/account' });

    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Authenticated account')).not.toBeInTheDocument();
  });

  it('never offers ADMIN and submits onboarding with a bearer token', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient({ session });
    let meRequests = 0;
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) {
        meRequests += 1;
        return meRequests === 1 ? onboardingResponse() : profileResponse();
      }

      if (url.endsWith('/auth/register-profile')) {
        return jsonResponse(201, { success: true, data: activeProfile });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/onboarding', client });

    expect(await screen.findByLabelText('Tenant')).toBeInTheDocument();
    expect(screen.getByLabelText('Landlord')).toBeInTheDocument();
    expect(screen.queryByLabelText('Admin')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Doe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeInTheDocument();
    const registrationCall = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/auth/register-profile'),
    );
    expect(registrationCall[1].headers.Authorization).toBe(
      'Bearer verified-access-token',
    );
    expect(JSON.parse(registrationCall[1].body)).toEqual({
      role: 'TENANT',
      first_name: 'Jane',
      last_name: 'Doe',
    });
  });

  it('allows an ACTIVE onboarded user to access account and logout', async () => {
    const session = createSession();
    const client = createFakeSupabaseClient({ session });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({ route: '/account', client });

    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument();
    expect(client.auth.signOut).toHaveBeenCalledOnce();
    expect(screen.queryByText('Authenticated account')).not.toBeInTheDocument();
  });
});
