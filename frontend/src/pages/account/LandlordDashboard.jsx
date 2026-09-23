import { Link } from 'react-router-dom';
import { listLandlordProperties } from '../../services/propertyService.js';
import { listLandlordListings } from '../../services/listingService.js';
import { listConversations } from '../../services/conversationService.js';
import { listVerifications } from '../../services/verificationService.js';
import { checkedList, getOverview } from '../../services/overviewService.js';
import { statusLabel } from '../../utils/status.js';
import { Activity, Metrics, Overview, useOverview } from './Overview.jsx';

const requests = {
  properties: (token, signal) =>
    listLandlordProperties(token, { limit: 1, signal }),
  active: (token, signal) =>
    listLandlordListings(token, { limit: 1, status: 'ACTIVE', signal }),
  pending: (token, signal) =>
    listLandlordListings(token, { limit: 3, status: 'PENDING_REVIEW', signal }),
  drafts: (token, signal) =>
    listLandlordListings(token, { limit: 3, status: 'DRAFT', signal }),
  paused: (token, signal) =>
    listLandlordListings(token, { limit: 3, status: 'PAUSED', signal }),
  operations: (accessToken, signal) =>
    getOverview('landlord', accessToken, signal),
  messages: (token, signal) => listConversations(token, { limit: 3, signal }),
  verification: async (token, signal) => {
    const lists = await Promise.all(
      ['PENDING', 'UNDER_REVIEW'].map((status) =>
        listVerifications(token, `?limit=3&status=${status}`, { signal }),
      ),
    );
    if (!lists.every(Array.isArray))
      throw new Error('Invalid overview response');
    return [
      ...new Map(lists.flat().map((item) => [item.id, item])).values(),
    ].slice(0, 3);
  },
};
for (const key of [
  'properties',
  'active',
  'pending',
  'drafts',
  'paused',
  'messages',
]) {
  const request = requests[key];
  requests[key] = async (...args) =>
    checkedList(
      await request(...args),
      key === 'properties'
        ? 'properties'
        : key === 'messages'
          ? 'conversations'
          : 'listings',
    );
}
export default function LandlordDashboard() {
  const state = useOverview(requests);
  const value = (key) => state.data[key]?.value;
  const operations = value('operations');
  const messages = value('messages');
  const verification = value('verification');
  const isNew =
    !state.loading &&
    !state.failed &&
    value('properties')?.meta.total === 0 &&
    operations?.applications.total === 0 &&
    operations?.viewings.total === 0 &&
    messages?.meta.total === 0 &&
    verification?.length === 0 &&
    ['active', 'pending', 'drafts', 'paused'].every(
      (key) => value(key)?.meta.total === 0,
    );
  return (
    <Overview
      state={state}
      description="Here's what's happening with your properties and applications."
    >
      <Metrics
        loading={state.loading}
        items={[
          ['Properties', value('properties')?.meta.total, 'property records'],
          ['Active listings', value('active')?.meta.total, 'published rentals'],
          [
            'Applications',
            operations?.applications.total,
            operations
              ? `${operations.applications.waiting} awaiting review`
              : 'awaiting review',
          ],
          [
            'Unread messages',
            messages?.conversations.reduce(
              (sum, item) => sum + item.unread_count,
              0,
            ),
            'in the 3 most recent conversations',
          ],
        ]}
      />
      {value('properties')?.meta.total === 0 && (
        <p className="overview-empty">
          No properties yet.{' '}
          <Link to="/landlord/properties/new">Add your first property</Link> to
          create a listing.
        </p>
      )}
      {!isNew && (
        <div className="overview-grid">
          <div className="overview-stack">
            <Activity
              title="Listings needing attention"
              to="/landlord/listings"
              summary={`${value('pending')?.meta.total ?? 'Unavailable'} pending review · ${value('drafts')?.meta.total ?? 'Unavailable'} draft · ${value('paused')?.meta.total ?? 'Unavailable'} paused`}
              empty="No draft, paused or pending listings."
              items={
                ['pending', 'drafts', 'paused'].every((key) => value(key))
                  ? [
                      ...new Map(
                        ['pending', 'drafts', 'paused']
                          .flatMap((key) => value(key).listings)
                          .map((listing) => [listing.id, listing]),
                      ).values(),
                    ]
                      .slice(0, 3)
                      .map((x) => ({ ...x, to: `/landlord/listings/${x.id}` }))
                  : undefined
              }
            />
            <Activity
              title="Upcoming viewings"
              summary={operations && `${operations.viewings.total} upcoming`}
              empty="No proposed or confirmed upcoming viewings."
              items={operations?.viewings.items.map((x) => ({
                ...x,
                detail: new Date(x.start_time).toLocaleString('en-MU'),
                to: `/landlord/applications/${x.application_id}`,
              }))}
            />
          </div>
          <div className="overview-stack">
            <Activity
              title="Recent applications"
              empty="No submitted applications yet."
              items={operations?.applications.items
                .filter((x) => x.status !== 'DRAFT')
                .map((x) => ({ ...x, to: `/landlord/applications/${x.id}` }))}
            />
            <Activity
              title="Recent messages"
              to="/conversations"
              empty="No conversations yet."
              items={messages?.conversations.map((x) => ({
                id: x.id,
                title:
                  [x.counterparty?.first_name, x.counterparty?.last_name]
                    .filter(Boolean)
                    .join(' ') || 'Rental conversation',
                detail: `${x.unread_count} unread messages`,
                status: x.unread_count ? 'UNREAD' : 'READ',
                to: `/conversations/${x.id}`,
              }))}
            />
            <Activity
              title="Pending verification requests"
              to="/landlord/verifications"
              empty="No verification requests awaiting review."
              items={verification?.map((x) => ({
                id: x.id,
                title: statusLabel(x.type),
                status: x.status,
                to: '/landlord/verifications',
              }))}
            />
          </div>
        </div>
      )}
    </Overview>
  );
}
