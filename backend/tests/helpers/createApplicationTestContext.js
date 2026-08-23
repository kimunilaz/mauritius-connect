import { createApp } from '../../src/app.js';
import { ApplicationRepositoryError } from '../../src/repositories/applicationRepository.js';
import { createApplicationService } from '../../src/services/applicationService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import { makeListing } from './createListingTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';
import { createPublicListingTestContext } from './createPublicListingTestContext.js';
import { TENANT_PROFILE_IDS } from './createSavedListingTestContext.js';

export const APPLICATION_IDS = Object.freeze({
  a: 'b0000000-0000-4000-8000-000000000001',
  b: 'b0000000-0000-4000-8000-000000000002',
});

export function makeApplication(overrides = {}) {
  return {
    id: APPLICATION_IDS.a,
    listing_id: '80000000-0000-4000-8000-000000000001',
    tenant_id: TENANT_PROFILE_IDS.a,
    move_in_date: null,
    requested_lease_duration_months: null,
    number_of_occupants: null,
    introductory_message: null,
    status: 'DRAFT',
    submitted_at: null,
    withdrawn_at: null,
    created_at: '2026-08-22T08:00:00.000Z',
    updated_at: '2026-08-22T08:00:00.000Z',
    ...overrides,
  };
}

export function createApplicationTestContext({
  listingRecords = [makeListing({ status: 'ACTIVE' })],
  propertyRecords,
  imageRecords,
  applicationRecords: inputRecords = [],
  applicationProfiles,
  failConcurrentCreate = false,
  answerRecords = [],
  historyRecords = [],
} = {}) {
  const profiles = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      makeProfile(),
      makeProfile({ id: TEST_USERS.other, first_name: 'Other' }),
      makeProfile({
        id: TEST_USERS.landlord,
        role: 'LANDLORD',
        first_name: 'Landlord',
      }),
    ],
    tenantRoleProfiles: [
      { id: TENANT_PROFILE_IDS.a, user_id: TEST_USERS.tenant },
      { id: TENANT_PROFILE_IDS.b, user_id: TEST_USERS.other },
    ],
  });
  const publicContext = createPublicListingTestContext({
    listingRecords,
    propertyRecords,
    imageRecords,
  });
  const applicationRecords = inputRecords.map((record) =>
    makeApplication(record),
  );

  function byListingAndTenant(listingId, tenantId) {
    return applicationRecords.find(
      (application) =>
        application.listing_id === listingId &&
        application.tenant_id === tenantId,
    );
  }

  const applications = {
    async listForTenant(tenantId, { page, limit, status }) {
      const matches = applicationRecords
        .filter(
          (application) =>
            application.tenant_id === tenantId &&
            (!status || application.status === status),
        )
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            right.id.localeCompare(left.id),
        );
      const first = (page - 1) * limit;
      return {
        applications: matches.slice(first, first + limit),
        total: matches.length,
      };
    },

    async findByListingAndTenant(listingId, tenantId) {
      return byListingAndTenant(listingId, tenantId) ?? null;
    },

    async findByIdAndTenant(applicationId, tenantId) {
      return (
        applicationRecords.find(
          (application) =>
            application.id === applicationId &&
            application.tenant_id === tenantId,
        ) ?? null
      );
    },

    async createDraft(fields) {
      if (byListingAndTenant(fields.listing_id, fields.tenant_id)) {
        throw new ApplicationRepositoryError('DUPLICATE');
      }
      const created = makeApplication({
        id:
          applicationRecords.length === 0
            ? APPLICATION_IDS.a
            : APPLICATION_IDS.b,
        ...fields,
        status: 'DRAFT',
        submitted_at: null,
        withdrawn_at: null,
      });
      applicationRecords.push(created);
      if (failConcurrentCreate) {
        throw new ApplicationRepositoryError('DUPLICATE');
      }
      return created;
    },

    async updateOwnedDraft(applicationId, tenantId, fields) {
      const application = applicationRecords.find(
        (candidate) =>
          candidate.id === applicationId &&
          candidate.tenant_id === tenantId &&
          candidate.status === 'DRAFT' &&
          candidate.submitted_at === null,
      );
      if (!application) return null;
      Object.assign(application, fields, {
        updated_at: '2026-08-22T09:00:00.000Z',
      });
      return application;
    },

    async listHistory(applicationId) {
      return historyRecords
        .filter((history) => history.application_id === applicationId)
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.id.localeCompare(right.id),
        )
        .map(({ from_status, to_status, created_at, changed_by_user_id }) => ({
          from_status,
          to_status,
          created_at,
          changed_by_user_id,
        }));
    },
  };
  const answers = {
    async listForApplication(applicationId) {
      return answerRecords.filter(
        (answer) => answer.application_id === applicationId,
      );
    },
  };
  const applicationService = createApplicationService({
    applications,
    answers,
    profiles: profiles.profileService,
    publicListings: publicContext.publicListingService,
  });

  return {
    ...profiles,
    ...publicContext,
    app: createApp({
      authService: profiles.authService,
      profileService: profiles.profileService,
      publicListingService: publicContext.publicListingService,
      applicationService,
    }),
    applications,
    applicationRecords,
    answerRecords,
    historyRecords,
    applicationService,
  };
}
