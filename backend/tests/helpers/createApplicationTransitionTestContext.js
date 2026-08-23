import { createApp } from '../../src/app.js';
import { createApplicationTransitionService } from '../../src/services/applicationTransitionService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import {
  APPLICATION_IDS,
  makeApplication,
} from './createApplicationTestContext.js';
import {
  LISTING_IDS,
  makeListing,
  otherLandlordProperty,
} from './createListingTestContext.js';
import {
  LANDLORD_PROFILE_IDS,
  makeProperty,
} from './createPropertyTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';
import { TENANT_PROFILE_IDS } from './createSavedListingTestContext.js';

export function createApplicationTransitionTestContext({
  initialStatus = 'SUBMITTED',
  listingStatus = 'ACTIVE',
  applicationProfiles,
  applicationOverrides = {},
} = {}) {
  const profileContext = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      makeProfile(),
      makeProfile({
        id: TEST_USERS.other,
        role: 'LANDLORD',
        first_name: 'Other',
      }),
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
    landlordRoleProfiles: [
      { id: LANDLORD_PROFILE_IDS.a, user_id: TEST_USERS.landlord },
      { id: LANDLORD_PROFILE_IDS.b, user_id: TEST_USERS.other },
    ],
  });
  const properties = [makeProperty(), otherLandlordProperty()];
  const listingRecords = [
    makeListing({ status: listingStatus }),
    makeListing({
      id: LISTING_IDS.b,
      property_id: otherLandlordProperty().id,
      status: 'ACTIVE',
    }),
  ];
  const applicationRecords = [
    makeApplication({
      status: initialStatus,
      submitted_at:
        initialStatus === 'DRAFT' ? null : '2026-08-22T10:00:00.000Z',
      withdrawn_at:
        initialStatus === 'WITHDRAWN' ? '2026-08-22T11:00:00.000Z' : null,
      ...applicationOverrides,
    }),
  ];
  const historyRecords = [];
  const transitionCalls = [];

  const applications = {
    async findVisibleById(applicationId) {
      return (
        applicationRecords.find(
          ({ id, status }) => id === applicationId && status !== 'DRAFT',
        ) ?? null
      );
    },
    async findByIdAndTenant(applicationId, tenantId) {
      return (
        applicationRecords.find(
          ({ id, tenant_id }) => id === applicationId && tenant_id === tenantId,
        ) ?? null
      );
    },
  };
  const listings = {
    async findByIdForLandlord(listingId, landlordId) {
      const listing = listingRecords.find(({ id }) => id === listingId);
      const property = properties.find(({ id }) => id === listing?.property_id);
      return property?.landlord_id === landlordId ? listing : null;
    },
  };
  const transitions = {
    async transition(request) {
      transitionCalls.push({ ...request });
      const application = applicationRecords.find(
        ({ id }) => id === request.applicationId,
      );
      if (!application) return { outcome: 'NOT_FOUND' };
      if (application.status === request.targetStatus) {
        return {
          outcome: 'ALREADY_TARGET',
          current_status: application.status,
        };
      }
      if (application.status !== request.expectedStatus) {
        return {
          outcome: 'INVALID_TRANSITION',
          current_status: application.status,
        };
      }
      const allowed =
        (request.actorRole === 'LANDLORD' &&
          request.targetStatus === 'UNDER_REVIEW' &&
          application.status === 'SUBMITTED') ||
        (request.actorRole === 'LANDLORD' &&
          request.targetStatus === 'SHORTLISTED' &&
          application.status === 'UNDER_REVIEW') ||
        (request.actorRole === 'LANDLORD' &&
          request.targetStatus === 'REJECTED' &&
          ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'].includes(
            application.status,
          )) ||
        (request.actorRole === 'TENANT' &&
          request.targetStatus === 'WITHDRAWN' &&
          ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'].includes(
            application.status,
          ));
      if (!allowed) return { outcome: 'INVALID_TRANSITION' };
      const previous = application.status;
      application.status = request.targetStatus;
      if (request.targetStatus === 'WITHDRAWN') {
        application.withdrawn_at = '2026-08-22T12:00:00.000Z';
      }
      historyRecords.push({
        application_id: application.id,
        from_status: previous,
        to_status: request.targetStatus,
        changed_by_user_id: request.actorUserId,
      });
      return {
        outcome: 'TRANSITIONED',
        previous_status: previous,
        current_status: request.targetStatus,
      };
    },
  };
  const transitionService = createApplicationTransitionService({
    applications,
    listings,
    profiles: profileContext.profileService,
    transitions,
  });

  return {
    ...profileContext,
    app: createApp({
      authService: profileContext.authService,
      profileService: profileContext.profileService,
      applicationTransitionService: transitionService,
    }),
    applicationRecords,
    historyRecords,
    transitionCalls,
    transitions,
    transitionService,
  };
}

export { APPLICATION_IDS };
