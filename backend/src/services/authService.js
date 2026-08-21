import { z } from 'zod';
import { getAuthVerificationSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/AppError.js';
import {
  profileRepository,
  ProfileRepositoryError,
} from '../repositories/profileRepository.js';

const userIdSchema = z.uuid();
const publicProfileRoles = new Set(['TENANT', 'LANDLORD']);

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('The access token is invalid.');
    this.name = 'InvalidAccessTokenError';
  }
}

export async function verifySupabaseAccessToken(
  accessToken,
  client = getAuthVerificationSupabaseClient(),
) {
  const { data, error } = await client.auth.getClaims(accessToken);
  const userId = data?.claims?.sub;

  if (error || !userIdSchema.safeParse(userId).success) {
    throw new InvalidAccessTokenError();
  }

  return Object.freeze({ userId });
}

function profileConflictError() {
  return new AppError({
    statusCode: 409,
    code: 'PROFILE_ALREADY_EXISTS',
    message: 'An application profile already exists for this account.',
  });
}

export function createAuthService({
  tokenVerifier = verifySupabaseAccessToken,
  profiles = profileRepository,
} = {}) {
  return Object.freeze({
    authenticateAccessToken(accessToken) {
      return tokenVerifier(accessToken);
    },

    loadProfile(userId) {
      return profiles.findByUserId(userId);
    },

    async registerProfile(userId, input) {
      if (!publicProfileRoles.has(input.role)) {
        throw new AppError({
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          fields: { role: 'Role must be TENANT or LANDLORD.' },
        });
      }

      const existingProfile = await profiles.findByUserId(userId);

      if (existingProfile) {
        throw profileConflictError();
      }

      try {
        return await profiles.create({
          id: userId,
          role: input.role,
          first_name: input.first_name,
          last_name: input.last_name,
          phone: input.phone ?? null,
          phone_verified: false,
          account_status: 'ACTIVE',
        });
      } catch (error) {
        if (
          error instanceof ProfileRepositoryError &&
          error.reason === 'DUPLICATE'
        ) {
          throw profileConflictError();
        }

        throw error;
      }
    },
  });
}

export const authService = createAuthService();
