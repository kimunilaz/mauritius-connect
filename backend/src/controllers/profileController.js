import { profileService as defaultProfileService } from '../services/profileService.js';

function serializeTenantProfile(profile) {
  return {
    occupation_type: profile.occupation_type ?? null,
    employer_or_school: profile.employer_or_school ?? null,
    income_range: profile.income_range ?? null,
    preferred_move_date: profile.preferred_move_date ?? null,
    preferred_lease_duration_months:
      profile.preferred_lease_duration_months ?? null,
    number_of_occupants: profile.number_of_occupants ?? null,
    has_pets: profile.has_pets,
    bio: profile.bio ?? null,
  };
}

function serializeLocation(location) {
  return {
    id: location.id,
    district: location.district ?? null,
    locality: location.locality ?? null,
    neighbourhood: location.neighbourhood ?? null,
  };
}

function serializeBaseProfile(profile) {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone ?? null,
  };
}

function serializeLandlordProfile({ roleProfile, baseProfile }) {
  return {
    ...serializeBaseProfile(baseProfile),
    verification_status: roleProfile.verification_status,
  };
}

export function createProfileController(service = defaultProfileService) {
  return Object.freeze({
    async getTenantProfile(request, response) {
      const profile = await service.ensureTenantProfile(request.auth.userId);
      response.json({ success: true, data: serializeTenantProfile(profile) });
    },

    async updateTenantProfile(request, response) {
      const profile = await service.updateTenantProfile(
        request.auth.userId,
        request.body,
      );
      response.json({ success: true, data: serializeTenantProfile(profile) });
    },

    async updateBaseProfile(request, response) {
      const profile = await service.updateBaseProfile(
        request.auth.userId,
        request.body,
      );
      response.json({ success: true, data: serializeBaseProfile(profile) });
    },

    async listPreferredLocations(request, response) {
      const locations = await service.listPreferredLocations(
        request.auth.userId,
      );
      response.json({ success: true, data: locations.map(serializeLocation) });
    },

    async addPreferredLocation(request, response) {
      const location = await service.addPreferredLocation(
        request.auth.userId,
        request.body,
      );
      response
        .status(201)
        .json({ success: true, data: serializeLocation(location) });
    },

    async deletePreferredLocation(request, response) {
      await service.deletePreferredLocation(
        request.auth.userId,
        request.params.id,
      );
      response.status(204).send();
    },

    async getLandlordProfile(request, response) {
      const profile = await service.getLandlordProfile(request.auth.userId);
      response.json({ success: true, data: serializeLandlordProfile(profile) });
    },

    async updateLandlordProfile(request, response) {
      const profile = await service.updateLandlordProfile(
        request.auth.userId,
        request.body,
      );
      response.json({ success: true, data: serializeLandlordProfile(profile) });
    },
  });
}
