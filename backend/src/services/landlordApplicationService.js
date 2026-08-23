import { AppError } from '../middleware/AppError.js';
import { applicantIdentityRepository } from '../repositories/applicantIdentityRepository.js';
import { applicationAnswerRepository } from '../repositories/applicationAnswerRepository.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { listingRepository } from '../repositories/listingRepository.js';
import {
  serializeLandlordApplicantListItem,
  serializeLandlordApplicationDetail,
} from '../serializers/landlordApplicationSerializer.js';
import { profileService } from './profileService.js';

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

function requireIdentity(identities, tenantId) {
  const identity = identities.get(tenantId);
  if (!identity) throw applicationNotFound();
  return identity;
}

export function createLandlordApplicationService({
  applications = applicationRepository,
  answers = applicationAnswerRepository,
  identities = applicantIdentityRepository,
  listings = listingRepository,
  profiles = profileService,
} = {}) {
  async function ownedListing(userId, listingId) {
    const landlord = await profiles.ensureLandlordProfile(userId);
    const listing = await listings.findByIdForLandlord(listingId, landlord.id);
    if (!listing) throw listingNotFound();
    return listing;
  }

  return Object.freeze({
    async list(userId, listingId, query) {
      const listing = await ownedListing(userId, listingId);
      const result = await applications.listForLandlordListing(
        listing.id,
        query,
      );
      const applicantIdentities = await identities.findForTenantIds(
        result.applications.map(({ tenant_id }) => tenant_id),
      );
      return {
        listing: {
          id: listing.id,
          title: listing.title,
          status: listing.status,
        },
        applications: result.applications.map((application) =>
          serializeLandlordApplicantListItem(
            application,
            requireIdentity(applicantIdentities, application.tenant_id),
          ),
        ),
        total: result.total,
      };
    },

    async get(userId, applicationId) {
      const landlord = await profiles.ensureLandlordProfile(userId);
      const application = await applications.findVisibleById(applicationId);
      if (!application) throw applicationNotFound();
      const listing = await listings.findByIdForLandlord(
        application.listing_id,
        landlord.id,
      );
      if (!listing) throw applicationNotFound();
      const [applicantIdentities, answerRecords, history] = await Promise.all([
        identities.findForTenantIds([application.tenant_id]),
        answers.listForApplication(application.id),
        applications.listHistory(application.id),
      ]);
      return serializeLandlordApplicationDetail({
        application,
        identity: requireIdentity(applicantIdentities, application.tenant_id),
        listing,
        answers: answerRecords.filter(
          (answer) => answer.question.listing_id === listing.id,
        ),
        history,
      });
    },
  });
}

export const landlordApplicationService = createLandlordApplicationService();
