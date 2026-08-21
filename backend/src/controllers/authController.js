import { authService as defaultAuthService } from '../services/authService.js';

function serializeProfile(profile) {
  return {
    id: profile.id,
    role: profile.role,
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone ?? null,
    profile_photo_url: profile.profile_photo_url ?? null,
    phone_verified: profile.phone_verified,
    account_status: profile.account_status,
  };
}

export function createAuthController(authService = defaultAuthService) {
  return Object.freeze({
    async registerProfile(request, response) {
      const profile = await authService.registerProfile(
        request.auth.userId,
        request.body,
      );

      response.status(201).json({
        success: true,
        data: serializeProfile(profile),
      });
    },

    getCurrentUser(request, response) {
      response.status(200).json({
        success: true,
        data: serializeProfile(request.profile),
      });
    },
  });
}

export const authController = createAuthController();
