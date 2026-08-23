import { AppError } from '../middleware/AppError.js';
import {
  applicationRepository,
  ApplicationRepositoryError,
} from '../repositories/applicationRepository.js';
import { applicationAnswerRepository } from '../repositories/applicationAnswerRepository.js';
import {
  serializeApplication,
  serializeTenantApplicationDetail,
  serializeTenantApplicationListItem,
} from '../serializers/applicationSerializer.js';
import { profileService as defaultProfileService } from './profileService.js';
import { publicListingService as defaultPublicListingService } from './publicListingService.js';

const DRAFT_FIELDS = [
  'move_in_date',
  'requested_lease_duration_months',
  'number_of_occupants',
  'introductory_message',
];

function listingNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'LISTING_NOT_FOUND',
    message: 'Listing not found.',
  });
}

function applicationNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'APPLICATION_NOT_FOUND',
    message: 'Application not found.',
  });
}

function applicationAlreadyExists() {
  return new AppError({
    statusCode: 409,
    code: 'APPLICATION_ALREADY_EXISTS',
    message: 'An application already exists for this rental.',
  });
}

function applicationNotEditable() {
  return new AppError({
    statusCode: 409,
    code: 'APPLICATION_NOT_EDITABLE',
    message: 'This application can no longer be edited.',
  });
}

function listingNotAvailable() {
  return new AppError({
    statusCode: 409,
    code: 'LISTING_NOT_AVAILABLE',
    message: 'This rental is no longer accepting application changes.',
  });
}

function draftInput(input) {
  return Object.fromEntries(
    DRAFT_FIELDS.filter((field) => Object.hasOwn(input, field)).map((field) => [
      field,
      input[field],
    ]),
  );
}

function present(application, listingAvailable) {
  return {
    application: serializeApplication(application),
    listingAvailable,
    editable: application.status === 'DRAFT' && listingAvailable,
  };
}

export function createApplicationService({
  applications = applicationRepository,
  answers = applicationAnswerRepository,
  profiles = defaultProfileService,
  publicListings = defaultPublicListingService,
} = {}) {
  async function tenantFor(userId) {
    return profiles.ensureTenantProfile(userId);
  }

  async function ownedApplication(userId, applicationId) {
    const tenant = await tenantFor(userId);
    const application = await applications.findByIdAndTenant(
      applicationId,
      tenant.id,
    );
    if (!application) throw applicationNotFound();
    return { tenant, application };
  }

  async function existingResult(application) {
    if (application.status !== 'DRAFT') throw applicationAlreadyExists();
    return present(
      application,
      await publicListings.isEligible(application.listing_id),
    );
  }

  return Object.freeze({
    async list(userId, query) {
      const tenant = await tenantFor(userId);
      const result = await applications.listForTenant(tenant.id, query);
      return {
        total: result.total,
        applications: await Promise.all(
          result.applications.map(async (application) => {
            const listing = await publicListings.presentCardForId(
              application.listing_id,
            );
            return serializeTenantApplicationListItem(application, listing);
          }),
        ),
      };
    },

    async create(userId, listingId, input) {
      const tenant = await tenantFor(userId);
      const existing = await applications.findByListingAndTenant(
        listingId,
        tenant.id,
      );
      if (existing) {
        return { ...(await existingResult(existing)), created: false };
      }
      if (!(await publicListings.isEligible(listingId))) {
        throw listingNotFound();
      }
      try {
        const application = await applications.createDraft({
          listing_id: listingId,
          tenant_id: tenant.id,
          ...draftInput(input),
        });
        return { ...present(application, true), created: true };
      } catch (error) {
        if (
          !(error instanceof ApplicationRepositoryError) ||
          error.reason !== 'DUPLICATE'
        ) {
          throw error;
        }
        const raced = await applications.findByListingAndTenant(
          listingId,
          tenant.id,
        );
        if (!raced) throw error;
        return { ...(await existingResult(raced)), created: false };
      }
    },

    async get(userId, applicationId) {
      const { application } = await ownedApplication(userId, applicationId);
      const listing = await publicListings.presentCardForId(
        application.listing_id,
      );
      const [answerRecords, history] = await Promise.all([
        answers.listForApplication(application.id),
        applications.listHistory(application.id),
      ]);
      return {
        application: serializeTenantApplicationDetail({
          application,
          listing,
          answers: answerRecords.filter(
            (answer) => answer.question.listing_id === application.listing_id,
          ),
          history,
        }),
        listingAvailable: Boolean(listing),
        editable: application.status === 'DRAFT' && Boolean(listing),
      };
    },

    async update(userId, applicationId, input) {
      const { tenant, application } = await ownedApplication(
        userId,
        applicationId,
      );
      if (application.status !== 'DRAFT' || application.submitted_at) {
        throw applicationNotEditable();
      }
      if (!(await publicListings.isEligible(application.listing_id))) {
        throw listingNotAvailable();
      }
      const updated = await applications.updateOwnedDraft(
        application.id,
        tenant.id,
        draftInput(input),
      );
      if (!updated) throw applicationNotEditable();
      return present(updated, true);
    },
  });
}

export const applicationService = createApplicationService();
