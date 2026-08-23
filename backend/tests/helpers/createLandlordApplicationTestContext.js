import { createApp } from '../../src/app.js';
import { createLandlordApplicationService } from '../../src/services/landlordApplicationService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import {
  APPLICATION_IDS,
  makeApplication,
} from './createApplicationTestContext.js';
import {
  makeListing,
  LISTING_IDS,
  otherLandlordProperty,
} from './createListingTestContext.js';
import {
  LANDLORD_PROFILE_IDS,
  makeProperty,
} from './createPropertyTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';
import { TENANT_PROFILE_IDS } from './createSavedListingTestContext.js';

export const LANDLORD_APPLICATION_IDS = Object.freeze({
  submitted: APPLICATION_IDS.a,
  draft: APPLICATION_IDS.b,
  otherListing: 'b0000000-0000-4000-8000-000000000003',
});

export function makeApplicantIdentity(overrides = {}) {
  return {
    first_name: 'Jane',
    last_name: 'Applicant',
    profile_photo_url: null,
    email: 'private@example.test',
    phone: '+23050000000',
    account_status: 'ACTIVE',
    income_range: 'PRIVATE',
    employer_or_school: 'PRIVATE',
    occupation_type: 'PRIVATE',
    bio: 'PRIVATE',
    preferred_locations: ['PRIVATE'],
    ...overrides,
  };
}

export function createLandlordApplicationTestContext({
  applicationRecords: inputApplications,
  listingRecords: inputListings,
  propertyRecords: inputProperties,
  applicantIdentities,
  answerRecords = [],
  historyRecords = [],
  applicationProfiles,
} = {}) {
  const profileContext = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      makeProfile(),
      makeProfile({
        id: TEST_USERS.landlord,
        role: 'LANDLORD',
        first_name: 'Landlord',
      }),
      makeProfile({
        id: TEST_USERS.other,
        role: 'LANDLORD',
        first_name: 'Other',
      }),
    ],
    tenantRoleProfiles: [
      { id: TENANT_PROFILE_IDS.a, user_id: TEST_USERS.tenant },
    ],
    landlordRoleProfiles: [
      { id: LANDLORD_PROFILE_IDS.a, user_id: TEST_USERS.landlord },
      { id: LANDLORD_PROFILE_IDS.b, user_id: TEST_USERS.other },
    ],
  });
  const properties = (
    inputProperties ?? [makeProperty(), otherLandlordProperty()]
  ).map((property) => makeProperty(property));
  const listingRecords = (
    inputListings ?? [
      makeListing({ status: 'ACTIVE' }),
      makeListing({
        id: LISTING_IDS.b,
        property_id: otherLandlordProperty().id,
        title: 'Other landlord listing',
        status: 'ACTIVE',
      }),
    ]
  ).map((listing) => makeListing(listing));
  const applicationRecords = (
    inputApplications ?? [
      makeApplication({
        id: LANDLORD_APPLICATION_IDS.submitted,
        status: 'SUBMITTED',
        submitted_at: '2026-08-22T10:00:00.000Z',
        updated_at: '2026-08-22T10:00:00.000Z',
      }),
      makeApplication({
        id: LANDLORD_APPLICATION_IDS.draft,
        status: 'DRAFT',
        submitted_at: null,
        updated_at: '2026-08-22T11:00:00.000Z',
      }),
      makeApplication({
        id: LANDLORD_APPLICATION_IDS.otherListing,
        listing_id: LISTING_IDS.b,
        status: 'SUBMITTED',
        submitted_at: '2026-08-22T09:00:00.000Z',
      }),
    ]
  ).map((application) => makeApplication(application));
  const identityRecords = new Map(
    applicantIdentities ?? [
      [TENANT_PROFILE_IDS.a, makeApplicantIdentity()],
      [TENANT_PROFILE_IDS.b, makeApplicantIdentity({ first_name: 'Other' })],
    ],
  );

  function withProperty(listing) {
    if (!listing) return null;
    const property = properties.find(
      (candidate) => candidate.id === listing.property_id,
    );
    return property ? { ...listing, property: { ...property } } : null;
  }

  const listings = {
    async findByIdForLandlord(listingId, landlordId) {
      const listing = listingRecords.find(({ id }) => id === listingId);
      const property = properties.find(({ id }) => id === listing?.property_id);
      return property?.landlord_id === landlordId
        ? withProperty(listing)
        : null;
    },
  };
  const applications = {
    async listForLandlordListing(listingId, { page, limit, status }) {
      const visible = applicationRecords
        .filter(
          (application) =>
            application.listing_id === listingId &&
            application.status !== 'DRAFT' &&
            (!status || application.status === status),
        )
        .sort(
          (left, right) =>
            right.submitted_at.localeCompare(left.submitted_at) ||
            right.id.localeCompare(left.id),
        );
      const first = (page - 1) * limit;
      return {
        applications: visible.slice(first, first + limit),
        total: visible.length,
      };
    },
    async findVisibleById(applicationId) {
      return (
        applicationRecords.find(
          (application) =>
            application.id === applicationId && application.status !== 'DRAFT',
        ) ?? null
      );
    },
    async listHistory(applicationId) {
      return historyRecords.filter(
        (history) => history.application_id === applicationId,
      );
    },
  };
  const identities = {
    async findForTenantIds(tenantIds) {
      return new Map(
        tenantIds
          .map((tenantId) => [tenantId, identityRecords.get(tenantId)])
          .filter(([, identity]) => identity),
      );
    },
  };
  const answers = {
    async listForApplication(applicationId) {
      return answerRecords.filter(
        (answer) => answer.application_id === applicationId,
      );
    },
  };
  const landlordApplicationService = createLandlordApplicationService({
    applications,
    answers,
    identities,
    listings,
    profiles: profileContext.profileService,
  });

  return {
    ...profileContext,
    app: createApp({
      authService: profileContext.authService,
      profileService: profileContext.profileService,
      landlordApplicationService,
    }),
    applicationRecords,
    listingRecords,
    properties,
    identities: identityRecords,
    landlordApplicationService,
  };
}
