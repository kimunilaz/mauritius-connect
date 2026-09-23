import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { statusLabel } from '../../utils/status.js';
import './tenant-dashboard.css';

export function useOverview(requests) {
  const { session } = useAuth();
  const [data, setData] = useState({});
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData({});
    for (const [key, request] of Object.entries(requests)) {
      Promise.resolve()
        .then(() => {
          if (!controller.signal.aborted)
            return request(session.access_token, controller.signal);
        })
        .then(
          (value) => {
            if (!controller.signal.aborted)
              setData((old) => ({ ...old, [key]: { value } }));
          },
          () => {
            if (!controller.signal.aborted)
              setData((old) => ({ ...old, [key]: { error: true } }));
          },
        );
    }
    return () => controller.abort();
  }, [session.access_token, attempt, requests]);
  return {
    data,
    loading: Object.keys(data).length < Object.keys(requests).length,
    failed: Object.values(data).some((item) => item.error),
    retry: () => retry((n) => n + 1),
  };
}

export function Overview({ children, state, description }) {
  const { profile } = useAuth();
  return (
    <main className="dashboard-shell tenant-dashboard">
      <header className="dashboard-heading">
        <div>
          <h1>Welcome back, {profile.first_name}</h1>
          <p>{description}</p>
        </div>
      </header>
      {state.loading && <p role="status">Loading activity...</p>}
      {state.failed && (
        <div className="dashboard-error" role="alert">
          <p>Some activity couldn't be loaded.</p>
          <button className="secondary-button" onClick={state.retry}>
            Retry overview
          </button>
        </div>
      )}
      {children}
    </main>
  );
}

export function Metrics({ items, loading = false }) {
  return (
    <section className="tenant-metrics" aria-label="Activity summary">
      {items.map(([label, value, hint]) => (
        <article className="tenant-metric" key={label}>
          <span>{label}</span>
          <strong>{value ?? (loading ? 'Loading…' : 'Unavailable')}</strong>
          <small>{hint}</small>
        </article>
      ))}
    </section>
  );
}

export function Activity({ title, items, empty, to, summary }) {
  return (
    <section className="dashboard-panel" aria-label={title}>
      <header className="panel-heading">
        <div>
          <h2>{title}</h2>
          {summary && <p className="overview-summary">{summary}</p>}
        </div>
        {to && <Link to={to}>View all</Link>}
      </header>
      {items?.length ? (
        <ul className="tenant-activity-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <h3>{item.title}</h3>
                {item.detail && <p>{item.detail}</p>}
              </div>
              <span className="status-label" data-status={item.status}>
                {statusLabel(item.status)}
              </span>
              <Link to={item.to}>View details</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="overview-empty">
          {items ? empty : 'Activity unavailable.'}
        </p>
      )}
    </section>
  );
}
