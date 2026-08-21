import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('backend/.env');

const integrationEnvironmentPath = 'backend/.env.integration';

if (existsSync(integrationEnvironmentPath)) {
  process.loadEnvFile(integrationEnvironmentPath);
}

const requiredVariables = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_TEST_TENANT_EMAIL',
  'SUPABASE_TEST_TENANT_PASSWORD',
  'SUPABASE_TEST_LANDLORD_EMAIL',
  'SUPABASE_TEST_LANDLORD_PASSWORD',
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  console.error(
    `Hosted authentication verification requires: ${missingVariables.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function createPublicClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function safeFailure(message) {
  return new Error(message);
}

async function run() {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  const apiBaseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  const privilegedClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const checks = [];

  async function check(name, callback) {
    await callback();
    checks.push(name);
  }

  async function apiRequest(path, { token, method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await globalThis.fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();

    return { status: response.status, payload };
  }

  async function signIn(client, email, password, label) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session?.access_token || !data.user?.id) {
      throw safeFailure(
        `${label} sign-in failed. Confirm the account email and integration password, then retry.`,
      );
    }

    return data;
  }

  async function ensureProfile({ session, user, role, firstName }) {
    const token = session.access_token;
    const current = await apiRequest('/auth/me', { token });

    if (current.status === 200) {
      assert.equal(
        current.payload.data.role,
        role,
        `${role} account already has a different application role.`,
      );
      assert.equal(
        current.payload.data.id,
        user.id,
        'Profile identity mismatch.',
      );
      return current.payload.data;
    }

    assert.equal(
      current.payload.error?.code,
      'ONBOARDING_REQUIRED',
      'Unprofiled auth identity did not receive ONBOARDING_REQUIRED.',
    );

    const created = await apiRequest('/auth/register-profile', {
      method: 'POST',
      token,
      body: {
        role,
        first_name: firstName,
        last_name: 'Integration',
      },
    });
    assert.equal(created.status, 201, `${role} onboarding did not return 201.`);
    assert.equal(
      created.payload.data.id,
      user.id,
      'Created profile identity mismatch.',
    );
    assert.equal(
      created.payload.data.role,
      role,
      'Created profile role mismatch.',
    );
    assert.equal(created.payload.data.account_status, 'ACTIVE');
    assert.equal(created.payload.data.phone_verified, false);

    const refreshed = await apiRequest('/auth/me', { token });
    assert.equal(refreshed.status, 200, '/auth/me failed after onboarding.');
    return refreshed.payload.data;
  }

  try {
    const tenantClient = createPublicClient();
    const tenant = await signIn(
      tenantClient,
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'TENANT',
    );

    await check(
      'real Supabase JWT is accepted and resolves the auth user',
      async () => {
        const response = await apiRequest('/auth/me', {
          token: tenant.session.access_token,
        });
        assert.ok(
          response.status === 200 ||
            response.payload.error?.code === 'ONBOARDING_REQUIRED',
          'Real access token was not accepted by backend verification.',
        );
      },
    );

    await check('fake JWT remains rejected', async () => {
      const response = await apiRequest('/auth/me', {
        token:
          'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDAifQ.',
      });
      assert.equal(response.status, 401);
      assert.equal(response.payload.error?.code, 'INVALID_TOKEN');
    });

    await check(
      'ADMIN and protected-field onboarding payloads are rejected',
      async () => {
        const adminResponse = await apiRequest('/auth/register-profile', {
          method: 'POST',
          token: tenant.session.access_token,
          body: {
            role: 'ADMIN',
            first_name: 'Escalation',
            last_name: 'Attempt',
          },
        });
        assert.equal(adminResponse.status, 422);
        assert.equal(adminResponse.payload.error?.code, 'VALIDATION_ERROR');

        const ownershipResponse = await apiRequest('/auth/register-profile', {
          method: 'POST',
          token: tenant.session.access_token,
          body: {
            role: 'TENANT',
            first_name: 'Ownership',
            last_name: 'Attempt',
            user_id: randomUUID(),
            account_status: 'SUSPENDED',
            phone_verified: true,
          },
        });
        assert.equal(ownershipResponse.status, 422);
        assert.equal(ownershipResponse.payload.error?.code, 'VALIDATION_ERROR');
      },
    );

    let tenantProfile;
    await check('TENANT profile onboarding and /auth/me succeed', async () => {
      tenantProfile = await ensureProfile({
        session: tenant.session,
        user: tenant.user,
        role: 'TENANT',
        firstName: 'Tenant',
      });
      assert.deepEqual(Object.keys(tenantProfile).sort(), [
        'account_status',
        'first_name',
        'id',
        'last_name',
        'phone',
        'phone_verified',
        'profile_photo_url',
        'role',
      ]);
    });

    await check(
      'duplicate onboarding cannot change the TENANT role',
      async () => {
        const response = await apiRequest('/auth/register-profile', {
          method: 'POST',
          token: tenant.session.access_token,
          body: {
            role: 'LANDLORD',
            first_name: 'Role',
            last_name: 'Change',
          },
        });
        assert.equal(response.status, 409);
        assert.equal(response.payload.error?.code, 'PROFILE_ALREADY_EXISTS');

        const current = await apiRequest('/auth/me', {
          token: tenant.session.access_token,
        });
        assert.equal(current.payload.data.role, 'TENANT');
      },
    );

    await check(
      'user metadata cannot override the application role',
      async () => {
        const { data: metadataData, error: metadataError } =
          await tenantClient.auth.updateUser({ data: { role: 'ADMIN' } });
        if (metadataError) {
          throw safeFailure('Temporary metadata update failed.');
        }
        assert.equal(metadataData.user.user_metadata.role, 'ADMIN');

        let metadataRestoreError;
        try {
          const { data: currentSession } = await tenantClient.auth.getSession();
          const current = await apiRequest('/auth/me', {
            token: currentSession.session.access_token,
          });
          assert.equal(current.status, 200);
          assert.equal(current.payload.data.role, 'TENANT');
        } finally {
          ({ error: metadataRestoreError } = await tenantClient.auth.updateUser(
            { data: { role: null } },
          ));
        }
        assert.equal(
          metadataRestoreError,
          null,
          'Temporary metadata could not be cleared.',
        );
      },
    );

    await check(
      'publishable and user clients cannot read or write profiles',
      async () => {
        const anonymousClient = createPublicClient();
        const anonymousRead = await anonymousClient
          .from('profiles')
          .select('id')
          .eq('id', tenant.user.id);
        assert.equal(anonymousRead.error, null);
        assert.deepEqual(anonymousRead.data, []);

        const userRead = await tenantClient
          .from('profiles')
          .select('id')
          .eq('id', tenant.user.id);
        assert.equal(userRead.error, null);
        assert.deepEqual(userRead.data, []);

        const userWrite = await tenantClient
          .from('profiles')
          .update({ first_name: 'RLS bypass attempt' })
          .eq('id', tenant.user.id)
          .select('id');
        assert.equal(userWrite.error, null);
        assert.deepEqual(userWrite.data, []);

        const current = await apiRequest('/auth/me', {
          token: tenant.session.access_token,
        });
        assert.equal(current.payload.data.first_name, tenantProfile.first_name);
      },
    );

    await check(
      'SUSPENDED profile is blocked and restored afterward',
      async () => {
        const { error: suspendError } = await privilegedClient
          .from('profiles')
          .update({ account_status: 'SUSPENDED' })
          .eq('id', tenant.user.id);
        if (suspendError) {
          throw safeFailure('Could not suspend the controlled TENANT profile.');
        }

        let accountRestoreError;
        try {
          const suspended = await apiRequest('/auth/me', {
            token: tenant.session.access_token,
          });
          assert.equal(suspended.status, 403);
          assert.equal(suspended.payload.error?.code, 'ACCOUNT_SUSPENDED');
        } finally {
          ({ error: accountRestoreError } = await privilegedClient
            .from('profiles')
            .update({ account_status: 'ACTIVE' })
            .eq('id', tenant.user.id));
        }
        assert.equal(
          accountRestoreError,
          null,
          'Controlled TENANT profile could not be restored.',
        );
      },
    );

    await check(
      'logout clears the session and login restores /auth/me',
      async () => {
        const { error: signOutError } = await tenantClient.auth.signOut();
        if (signOutError) {
          throw safeFailure('TENANT logout failed.');
        }
        const { data: cleared } = await tenantClient.auth.getSession();
        assert.equal(cleared.session, null);

        const signedInAgain = await signIn(
          tenantClient,
          process.env.SUPABASE_TEST_TENANT_EMAIL,
          process.env.SUPABASE_TEST_TENANT_PASSWORD,
          'TENANT',
        );
        const current = await apiRequest('/auth/me', {
          token: signedInAgain.session.access_token,
        });
        assert.equal(current.status, 200);
        assert.equal(current.payload.data.role, 'TENANT');
      },
    );

    const landlordClient = createPublicClient();
    const landlord = await signIn(
      landlordClient,
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'LANDLORD',
    );
    await check(
      'LANDLORD profile onboarding and /auth/me succeed',
      async () => {
        const profile = await ensureProfile({
          session: landlord.session,
          user: landlord.user,
          role: 'LANDLORD',
          firstName: 'Landlord',
        });
        assert.equal(profile.role, 'LANDLORD');
        assert.equal(profile.account_status, 'ACTIVE');
        assert.equal(profile.phone_verified, false);
      },
    );

    console.log(
      `Hosted authentication verification passed: ${checks.length} real integration checks.`,
    );
    for (const name of checks) {
      console.log(`  PASS ${name}`);
    }
  } catch (error) {
    console.error(
      `Hosted authentication verification failed: ${error.message || 'unknown safe failure'}`,
    );
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
