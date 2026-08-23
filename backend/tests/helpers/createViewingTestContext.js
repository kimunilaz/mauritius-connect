import { createApp } from '../../src/app.js';
import { createViewingService } from '../../src/services/viewingService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import { makeApplication } from './createApplicationTestContext.js';
import { makeListing } from './createListingTestContext.js';
import {
  LANDLORD_PROFILE_IDS,
  makeProperty,
} from './createPropertyTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';
import { TENANT_PROFILE_IDS } from './createSavedListingTestContext.js';

export const VIEWING_ID = 'e0000000-0000-4000-8000-000000000001';

export function createViewingTestContext({
  applicationStatus = 'SHORTLISTED',
  viewingStatus,
  startTime = '2099-09-12T10:00:00.000Z',
  applicationProfiles,
  landlordRoleProfiles,
} = {}) {
  const profiles = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      makeProfile(),
      makeProfile({ id: TEST_USERS.other }),
      makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
    ],
    tenantRoleProfiles: [
      { id: TENANT_PROFILE_IDS.a, user_id: TEST_USERS.tenant },
      { id: TENANT_PROFILE_IDS.b, user_id: TEST_USERS.other },
    ],
    landlordRoleProfiles: landlordRoleProfiles ?? [
      { id: LANDLORD_PROFILE_IDS.a, user_id: TEST_USERS.landlord },
    ],
  });
  const application = makeApplication({
    status: applicationStatus,
    submitted_at: '2026-08-22T10:00:00.000Z',
  });
  const listing = makeListing({ status: 'CLOSED' });
  const property = makeProperty();
  const records = viewingStatus
    ? [
        {
          id: VIEWING_ID,
          application_id: application.id,
          start_time: startTime,
          end_time: null,
          status: viewingStatus,
          notes: 'Meet at the entrance.',
          created_at: '2026-08-22T12:00:00.000Z',
          updated_at: '2026-08-22T12:00:00.000Z',
          proposed_by_user_id: TEST_USERS.landlord,
        },
      ]
    : [];
  const history = [];
  const applications = {
    async findByIdAndTenant(id, tenantId) {
      return id === application.id && tenantId === application.tenant_id
        ? application
        : null;
    },
    async findVisibleById(id) {
      return id === application.id && application.status !== 'DRAFT'
        ? application
        : null;
    },
  };
  const listings = {
    async findByIdForLandlord(id, landlordId) {
      return id === listing.id && landlordId === property.landlord_id
        ? listing
        : null;
    },
  };
  const viewings = {
    async listForApplication(id) {
      return records.filter(({ application_id }) => application_id === id);
    },
    async findById(id) {
      return records.find((record) => record.id === id) ?? null;
    },
    async propose({ p_expected_application_status: expected, ...fields }) {
      if (application.status !== expected)
        return { outcome: 'INVALID_APPLICATION_TRANSITION' };
      if (!['SHORTLISTED', 'VIEWING_INVITED'].includes(application.status))
        return { outcome: 'INVALID_APPLICATION_TRANSITION' };
      if (
        records.some(({ status }) => ['PROPOSED', 'CONFIRMED'].includes(status))
      )
        return { outcome: 'OPEN_VIEWING_EXISTS' };
      const previous = application.status;
      if (previous === 'SHORTLISTED') {
        application.status = 'VIEWING_INVITED';
        history.push({
          from_status: previous,
          to_status: application.status,
          changed_by_user_id: fields.p_actor_user_id,
        });
      }
      records.push({
        id: VIEWING_ID,
        application_id: fields.p_application_id,
        start_time: fields.p_start_time,
        end_time: fields.p_end_time,
        notes: fields.p_notes,
        status: 'PROPOSED',
        created_at: '2026-08-22T12:00:00.000Z',
        updated_at: '2026-08-22T12:00:00.000Z',
      });
      return { outcome: 'CREATED', viewing_id: VIEWING_ID };
    },
    async transition({
      p_expected_viewing_status: expected,
      p_action: action,
    }) {
      const viewing = records[0];
      const targets = {
        CONFIRM: 'CONFIRMED',
        DECLINE: 'DECLINED',
        CANCEL: 'CANCELLED',
        COMPLETE: 'COMPLETED',
        NO_SHOW: 'NO_SHOW',
      };
      const target = targets[action];
      if (viewing.status === target)
        return {
          outcome: 'ALREADY_TARGET',
          application_status: application.status,
        };
      if (viewing.status !== expected) return { outcome: 'INVALID_TRANSITION' };
      const allowed =
        (['CONFIRM', 'DECLINE'].includes(action) &&
          viewing.status === 'PROPOSED') ||
        (action === 'CANCEL' &&
          ['PROPOSED', 'CONFIRMED'].includes(viewing.status)) ||
        (['COMPLETE', 'NO_SHOW'].includes(action) &&
          viewing.status === 'CONFIRMED');
      if (!allowed) return { outcome: 'INVALID_TRANSITION' };
      viewing.status = target;
      if (action === 'COMPLETE') {
        application.status = 'VIEWING_COMPLETED';
        history.push({
          from_status: 'VIEWING_INVITED',
          to_status: 'VIEWING_COMPLETED',
          changed_by_user_id: TEST_USERS.landlord,
        });
      }
      return {
        outcome: 'TRANSITIONED',
        application_status: application.status,
      };
    },
  };
  const viewingService = createViewingService({
    applications,
    listings,
    profiles: profiles.profileService,
    viewings,
  });
  return {
    ...profiles,
    app: createApp({
      authService: profiles.authService,
      profileService: profiles.profileService,
      viewingService,
    }),
    application,
    records,
    history,
    viewingService,
    viewings,
  };
}
