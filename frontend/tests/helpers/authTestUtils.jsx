import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../../src/App.jsx';
import { AuthProvider } from '../../src/context/AuthContext.jsx';

export const activeProfile = Object.freeze({
  id: '00000000-0000-0000-0000-000000000001',
  role: 'TENANT',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: null,
  profile_photo_url: null,
  phone_verified: false,
  account_status: 'ACTIVE',
});

export function createSession(overrides = {}) {
  return {
    access_token: 'verified-access-token',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'jane@example.test',
    },
    ...overrides,
  };
}

export function createFakeSupabaseClient({ session = null } = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: { unsubscribe: vi.fn() },
        },
      }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn(),
    },
  };
}

export function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

export function profileResponse(profile = activeProfile) {
  return jsonResponse(200, { success: true, data: profile });
}

export function onboardingResponse() {
  return jsonResponse(403, {
    success: false,
    error: {
      code: 'ONBOARDING_REQUIRED',
      message: 'Complete application profile onboarding to continue.',
    },
  });
}

export function renderApp({ route = '/', client } = {}) {
  const authClient = client ?? createFakeSupabaseClient();
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider client={authClient}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

  return { ...result, client: authClient };
}
