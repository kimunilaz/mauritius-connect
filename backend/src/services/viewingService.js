import { AppError } from '../middleware/AppError.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { viewingRepository } from '../repositories/viewingRepository.js';
import { notificationRepository as defaultNotificationRepository } from '../repositories/notificationRepository.js';
import { serializeViewing } from '../serializers/viewingSerializer.js';
import { profileService as defaultProfileService } from './profileService.js';

function error(statusCode, code, message) {
  return new AppError({ statusCode, code, message });
}

function notFound() {
  return error(404, 'VIEWING_NOT_FOUND', 'Viewing not found.');
}

function applicationNotFound() {
  return error(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
}

function mapOutcome(result) {
  if (!result || result.outcome === 'NOT_FOUND') throw notFound();
  if (result.outcome === 'OPEN_VIEWING_EXISTS') {
    throw error(
      409,
      'OPEN_VIEWING_EXISTS',
      'This application already has an open viewing.',
    );
  }
  if (result.outcome === 'INVALID_APPLICATION_TRANSITION') {
    throw error(
      409,
      'INVALID_APPLICATION_TRANSITION',
      'A viewing cannot be proposed for this application state.',
    );
  }
  if (result.outcome === 'INVALID_SCHEDULE') {
    throw error(422, 'VALIDATION_ERROR', 'Enter a valid future viewing time.');
  }
  if (result.outcome === 'TOO_EARLY') {
    throw error(
      409,
      'VIEWING_TOO_EARLY',
      'This action is not available before the viewing start time.',
    );
  }
  if (result.outcome === 'INVALID_TRANSITION') {
    throw error(
      409,
      'INVALID_VIEWING_TRANSITION',
      'This viewing action is not allowed from its current status.',
    );
  }
  if (result.outcome === 'INTEGRITY_ERROR') {
    throw new Error('Viewing history integrity failed.');
  }
  return result;
}

export function createViewingService({
  applications = applicationRepository,
  listings = listingRepository,
  profiles = defaultProfileService,
  viewings = viewingRepository,
  notifications = null,
} = {}) {
  async function authorizeApplication(userId, role, applicationId) {
    if (role === 'TENANT') {
      const tenant = await profiles.ensureTenantProfile(userId);
      const application = await applications.findByIdAndTenant(
        applicationId,
        tenant.id,
      );
      if (!application) throw applicationNotFound();
      return application;
    }
    const landlord = await profiles.ensureLandlordProfile(userId);
    const application = await applications.findVisibleById(applicationId);
    if (!application) throw applicationNotFound();
    if (
      !(await listings.findByIdForLandlord(application.listing_id, landlord.id))
    )
      throw applicationNotFound();
    return application;
  }

  async function authorizeViewing(userId, role, viewingId) {
    const viewing = await viewings.findById(viewingId);
    if (!viewing) throw notFound();
    try {
      await authorizeApplication(userId, role, viewing.application_id);
    } catch {
      throw notFound();
    }
    return viewing;
  }

  async function transition(userId, role, viewingId, action) {
    const viewing = await authorizeViewing(userId, role, viewingId);
    const result = mapOutcome(
      await viewings.transition({
        p_viewing_id: viewingId,
        p_actor_user_id: userId,
        p_actor_role: role,
        p_expected_viewing_status: viewing.status,
        p_action: action,
      }),
    );
    const current = await viewings.findById(viewingId);
    if (!current) throw notFound();
    if (
      action === 'CANCEL' &&
      result.outcome === 'TRANSITIONED' &&
      notifications
    ) {
      await notifications.createViewingCancel(viewingId, userId);
    }
    return {
      viewing: serializeViewing(current),
      transitioned: result.outcome === 'TRANSITIONED',
      applicationStatus: result.application_status,
    };
  }

  return Object.freeze({
    async propose(userId, applicationId, input) {
      const application = await authorizeApplication(
        userId,
        'LANDLORD',
        applicationId,
      );
      if (new Date(input.start_time) <= new Date()) {
        throw error(
          422,
          'VALIDATION_ERROR',
          'Viewing start time must be in the future.',
        );
      }
      const result = mapOutcome(
        await viewings.propose({
          p_application_id: applicationId,
          p_actor_user_id: userId,
          p_expected_application_status: application.status,
          p_start_time: input.start_time,
          p_end_time: input.end_time ?? null,
          p_notes: input.notes ?? null,
        }),
      );
      const viewing = await viewings.findById(result.viewing_id);
      if (!viewing) throw new Error('Created viewing could not be read.');
      return serializeViewing(viewing);
    },

    async list(userId, role, applicationId) {
      await authorizeApplication(userId, role, applicationId);
      return (await viewings.listForApplication(applicationId)).map(
        serializeViewing,
      );
    },

    async get(userId, role, viewingId) {
      return serializeViewing(await authorizeViewing(userId, role, viewingId));
    },

    confirm(userId, viewingId) {
      return transition(userId, 'TENANT', viewingId, 'CONFIRM');
    },
    decline(userId, viewingId) {
      return transition(userId, 'TENANT', viewingId, 'DECLINE');
    },
    cancel(userId, role, viewingId) {
      return transition(userId, role, viewingId, 'CANCEL');
    },
    complete(userId, viewingId) {
      return transition(userId, 'LANDLORD', viewingId, 'COMPLETE');
    },
    noShow(userId, viewingId) {
      return transition(userId, 'LANDLORD', viewingId, 'NO_SHOW');
    },
  });
}

export const viewingService = createViewingService({
  notifications: defaultNotificationRepository,
});
