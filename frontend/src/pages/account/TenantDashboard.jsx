import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import { listSavedListings } from '../../services/savedListingService.js';
import { listTenantApplications } from '../../services/applicationService.js';
import { listConversations } from '../../services/conversationService.js';
import { getUnreadNotificationCount } from '../../services/notificationService.js';
import {
  applicationDate,
  applicationStatusLabel,
} from '../../utils/application.js';
import { publicLocation } from '../../utils/listing.js';
import './tenant-dashboard.css';

function count(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error('Invalid count');
  return value;
}

// Keep the overview bounded; this is explicitly a recent-conversation count.
async function messageSummary(token, signal) {
  const result = await listConversations(token, { limit: 3, signal });
  return {
    total: count(result.meta.total),
    unread: result.conversations.reduce(
      (sum, item) => sum + count(item.unread_count),
      0,
    ),
  };
}

export default function TenantDashboard() {
  const { profile, session } = useAuth();
  const [data, setData] = useState({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const token = session.access_token;
    setData({});
    const requests = {
      saved: async () => {
        const result = await listSavedListings(token, { limit: 3, signal });
        count(result.meta.total);
        if (!Array.isArray(result.saves)) throw new Error('Invalid saves');
        return result;
      },
      applications: async () => {
        const [recent, invited] = await Promise.all([
          listTenantApplications(token, { limit: 3, signal }),
          listTenantApplications(token, {
            status: 'VIEWING_INVITED',
            limit: 3,
            signal,
          }),
        ]);
        count(recent.meta.total);
        const applications = [
          ...new Map(
            [...invited.applications, ...recent.applications].map((item) => [
              item.id,
              item,
            ]),
          ).values(),
        ].slice(0, 3);
        return { ...recent, applications };
      },
      messages: () => messageSummary(token, signal),
      notifications: async () =>
        count(
          (await getUnreadNotificationCount(token, { signal })).unread_count,
        ),
    };
    for (const [key, request] of Object.entries(requests)) {
      request().then(
        (value) => {
          if (!signal.aborted)
            setData((current) => ({ ...current, [key]: { value } }));
        },
        () => {
          if (!signal.aborted)
            setData((current) => ({ ...current, [key]: { error: true } }));
        },
      );
    }
    return () => controller.abort();
  }, [session.access_token, attempt]);

  const saved = data.saved?.value;
  const applications = data.applications?.value;
  const messages = data.messages?.value;
  const isNew =
    saved?.meta.total === 0 &&
    applications?.meta.total === 0 &&
    messages?.total === 0 &&
    data.notifications?.value === 0;
  const failed = Object.values(data).some((item) => item.error);
  const loading = Object.keys(data).length < 4;
  const metrics = [
    [
      'Saved homes',
      saved?.meta.total,
      '/tenant/saved-listings',
      'saved',
      'homes saved',
    ],
    [
      'Applications',
      applications?.meta.total,
      '/tenant/applications',
      'applications',
      'applications',
    ],
    [
      'Messages',
      messages?.unread,
      '/conversations',
      'messages',
      'unread in the 3 most recent conversations',
    ],
    [
      'Notifications',
      data.notifications?.value,
      '/notifications',
      'notifications',
      'unread notifications',
    ],
  ];

  return (
    <main className="dashboard-shell tenant-dashboard">
      <header className="dashboard-heading">
        <div>
          <h1>
            {isNew ? 'Welcome' : 'Welcome back'}, {profile.first_name}
          </h1>
          <p>
            {isNew
              ? 'Start by exploring homes currently available across Mauritius.'
              : "Here's what's happening with your rentals."}
          </p>
        </div>
      </header>
      {failed && (
        <div className="dashboard-error" role="alert">
          <p>
            Some activity couldn't be loaded. You can still use the sidebar to
            open your pages.
          </p>
          <button
            className="secondary-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry overview
          </button>
        </div>
      )}
      {loading && <p role="status">Loading your rental activity...</p>}
      {isNew ? (
        <Link className="primary-link-button" to="/listings">
          Browse rentals
        </Link>
      ) : (
        <>
          <section
            className="tenant-metrics"
            aria-label="Rental activity"
            aria-busy={loading}
          >
            {metrics.map(([label, value, to, key, hint]) => (
              <Link
                className="tenant-metric"
                to={to}
                key={key}
                aria-label={`${label} ${value ?? (data[key]?.error ? 'Unavailable' : 'Loading')} ${hint}`}
              >
                <span>{label}</span>
                <strong>
                  {value ?? (data[key]?.error ? 'Unavailable' : '…')}
                </strong>
                <small>{hint}</small>
              </Link>
            ))}
          </section>
          {applications?.applications.length > 0 && (
            <section
              className="dashboard-panel"
              aria-labelledby="tenant-applications-title"
            >
              <header className="panel-heading">
                <h2 id="tenant-applications-title">Applications</h2>
                <Link to="/tenant/applications">View all applications</Link>
              </header>
              <ul className="tenant-activity-list">
                {applications.applications.map((application) => {
                  const listing =
                    application.availability === 'AVAILABLE'
                      ? application.listing
                      : null;
                  const date =
                    application.updated_at ?? application.submitted_at;
                  return (
                    <li key={application.id}>
                      <div>
                        <h3>{listing?.title ?? 'Unavailable rental'}</h3>
                        {listing?.property && (
                          <p>{publicLocation(listing.property)}</p>
                        )}
                        {date && <small>Updated {applicationDate(date)}</small>}
                      </div>
                      <span
                        className="status-label"
                        data-status={application.status}
                      >
                        {applicationStatusLabel(application.status)}
                      </span>
                      <Link to={`/tenant/applications/${application.id}`}>
                        View application
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {saved?.saves.length > 0 && (
            <section
              className="dashboard-panel"
              aria-labelledby="tenant-saved-title"
            >
              <header className="panel-heading">
                <h2 id="tenant-saved-title">Recently saved</h2>
                <Link to="/tenant/saved-listings">View all saved homes</Link>
              </header>
              <ul className="tenant-saved-grid">
                {saved.saves.map((save) => (
                  <li key={save.id ?? save.listing_id}>
                    {save.availability === 'AVAILABLE' && save.listing ? (
                      <PublicListingCard listing={save.listing} compact />
                    ) : (
                      <article className="unavailable-saved-card">
                        <span className="status-label">Unavailable</span>
                        <h3>This home is no longer available</h3>
                      </article>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
