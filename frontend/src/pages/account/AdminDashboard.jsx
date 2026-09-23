import { getOverview } from '../../services/overviewService.js';
import { statusLabel } from '../../utils/status.js';
import { Activity, Metrics, Overview, useOverview } from './Overview.jsx';

const requests = {
  queues: (accessToken, signal) => getOverview('admin', accessToken, signal),
};
export default function AdminDashboard() {
  const state = useOverview(requests);
  const data = state.data.queues?.value;
  return (
    <Overview
      state={state}
      description="Here's what needs attention across the platform."
    >
      <Metrics
        loading={state.loading}
        items={[
          ['Pending listings', data?.listings.total, 'awaiting review'],
          ['Open reports', data?.reports.total, 'open or under review'],
          [
            'Pending verifications',
            data?.verifications.total,
            'awaiting a decision',
          ],
          ['Suspended users', data?.users.total, 'currently suspended'],
        ]}
      />
      {data &&
        !data.listings.total &&
        !data.reports.total &&
        !data.verifications.total && (
          <p className="overview-empty">Nothing currently needs review.</p>
        )}
      {(!data || Object.values(data).some((queue) => queue.total > 0)) && (
        <div className="overview-grid">
          <Activity
            title="Listings awaiting review"
            to="/admin/listings"
            empty="No listings awaiting review."
            items={data?.listings.items.map((x) => ({
              ...x,
              to: `/admin/listings/${x.id}`,
            }))}
          />
          <Activity
            title="Reports needing attention"
            to="/admin/reports"
            empty="No open reports."
            items={data?.reports.items.map((x) => ({
              ...x,
              title: statusLabel(x.reason),
              to: `/admin/reports/${x.id}`,
            }))}
          />
          <Activity
            title="Verification requests"
            to="/admin/verifications"
            empty="No pending verification requests."
            items={data?.verifications.items.map((x) => ({
              ...x,
              title: statusLabel(x.verification_type),
              to: `/admin/verifications/${x.id}`,
            }))}
          />
          <Activity
            title="Suspended accounts"
            to="/admin/users"
            empty="No suspended accounts."
            items={data?.users.items.map((x) => ({
              ...x,
              title: `${x.first_name} ${x.last_name}`,
              status: x.account_status,
              to: `/admin/users/${x.id}`,
            }))}
          />
        </div>
      )}
    </Overview>
  );
}
