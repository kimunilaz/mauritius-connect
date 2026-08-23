import { AppError } from '../middleware/AppError.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { applicationTransitionRepository } from '../repositories/applicationTransitionRepository.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { profileService as defaultProfileService } from './profileService.js';

function applicationNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'APPLICATION_NOT_FOUND',
    message: 'Application not found.',
  });
}

function invalidTransition() {
  return new AppError({
    statusCode: 409,
    code: 'INVALID_APPLICATION_TRANSITION',
    message: 'This application action is not allowed from its current status.',
  });
}

function mapOutcome(result) {
  if (result.outcome === 'NOT_FOUND') throw applicationNotFound();
  if (result.outcome === 'INVALID_TRANSITION') throw invalidTransition();
  if (result.outcome === 'INTEGRITY_ERROR') {
    throw new Error('Application transition history integrity failed.');
  }
  if (!['TRANSITIONED', 'ALREADY_TARGET'].includes(result.outcome)) {
    throw new Error('Unexpected application transition outcome.');
  }
  return {
    status: result.current_status,
    transitioned: result.outcome === 'TRANSITIONED',
  };
}

export function createApplicationTransitionService({
  applications = applicationRepository,
  listings = listingRepository,
  profiles = defaultProfileService,
  transitions = applicationTransitionRepository,
} = {}) {
  async function landlordTransition(userId, applicationId, targetStatus) {
    const landlord = await profiles.ensureLandlordProfile(userId);
    const application = await applications.findVisibleById(applicationId);
    if (!application) throw applicationNotFound();
    const expectedStatus = application.status;
    const listing = await listings.findByIdForLandlord(
      application.listing_id,
      landlord.id,
    );
    if (!listing) throw applicationNotFound();
    return mapOutcome(
      await transitions.transition({
        applicationId,
        actorUserId: userId,
        actorRole: 'LANDLORD',
        expectedStatus,
        targetStatus,
      }),
    );
  }

  return Object.freeze({
    review(userId, applicationId) {
      return landlordTransition(userId, applicationId, 'UNDER_REVIEW');
    },
    shortlist(userId, applicationId) {
      return landlordTransition(userId, applicationId, 'SHORTLISTED');
    },
    reject(userId, applicationId) {
      return landlordTransition(userId, applicationId, 'REJECTED');
    },
    async withdraw(userId, applicationId) {
      const tenant = await profiles.ensureTenantProfile(userId);
      const application = await applications.findByIdAndTenant(
        applicationId,
        tenant.id,
      );
      if (!application) throw applicationNotFound();
      const expectedStatus = application.status;
      return mapOutcome(
        await transitions.transition({
          applicationId,
          actorUserId: userId,
          actorRole: 'TENANT',
          expectedStatus,
          targetStatus: 'WITHDRAWN',
        }),
      );
    },
  });
}

export const applicationTransitionService =
  createApplicationTransitionService();
