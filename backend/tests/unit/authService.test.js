import { describe, expect, it, vi } from 'vitest';
import {
  createAuthService,
  InvalidAccessTokenError,
  verifySupabaseAccessToken,
} from '../../src/services/authService.js';

describe('verifySupabaseAccessToken', () => {
  it('uses getClaims and returns only the verified subject UUID', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const getClaims = vi.fn().mockResolvedValue({
      data: {
        claims: {
          sub: userId,
          user_metadata: { role: 'ADMIN' },
        },
      },
      error: null,
    });

    const identity = await verifySupabaseAccessToken('verified-token', {
      auth: { getClaims },
    });

    expect(getClaims).toHaveBeenCalledWith('verified-token');
    expect(identity).toEqual({ userId });
    expect(identity).not.toHaveProperty('user_metadata');
  });

  it.each([
    ['Supabase verification error', null, new Error('invalid token')],
    ['missing subject', { claims: {} }, null],
    ['non-UUID subject', { claims: { sub: 'attacker' } }, null],
  ])('rejects %s', async (_case, data, error) => {
    const client = {
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data, error }),
      },
    };

    await expect(
      verifySupabaseAccessToken('untrusted-token', client),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});

describe('application profile registration service', () => {
  it('rejects ADMIN even if a caller bypasses route validation', async () => {
    const profiles = {
      findByUserId: vi.fn(),
      create: vi.fn(),
    };
    const service = createAuthService({ profiles });

    await expect(
      service.registerProfile('verified-user-id', {
        role: 'ADMIN',
        first_name: 'Attack',
        last_name: 'Attempt',
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
    expect(profiles.findByUserId).not.toHaveBeenCalled();
    expect(profiles.create).not.toHaveBeenCalled();
  });
});
