import OwnerSelector from '../agent/OwnerSelector.jsx';
import PropertyListPage from '../property/PropertyListPage.jsx';
import { ApiError } from '../../services/apiClient.js';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  operationRequest,
  queryString,
} from '../../services/operationService.js';
import { configurations, label, money } from './operationConfig.js';
import OperationPanel from './OperationPanel.jsx';
import './operations.css';
export function useOwnerSummary(propertyId, filters = {}) {
  const { session } = useAuth();
  const token = session.access_token;
  const [state, setState] = useState({ loading: true }),
    [attempt, setAttempt] = useState(0);
  const query = queryString({ property_id: propertyId, ...filters });
  useEffect(() => {
    const c = new AbortController();
    setState({ loading: true });
    operationRequest(token, `/summary?${query}`, { signal: c.signal })
      .then((data) => {
        if (
          !data ||
          !Array.isArray(data.portfolio) ||
          !data.totals ||
          !data.finances
        )
          throw new Error('Property operations could not be loaded.');
        setState({ data });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState({
            error: e.message,
            routeUnavailable:
              e instanceof ApiError &&
              e.status === 404 &&
              e.code === 'RESOURCE_NOT_FOUND' &&
              e.message === 'Route not found.',
          });
      });
    return () => c.abort();
  }, [token, query, attempt]);
  return { ...state, token, retry: () => setAttempt((v) => v + 1) };
}
export function HubState({ state }) {
  return state.loading ? (
    <p role="status">Loading property operations...</p>
  ) : state.error ? (
    <div role="alert">
      <p>{state.error}</p>
      <button onClick={state.retry}>Try again</button>
    </div>
  ) : null;
}
function Events({ items, title }) {
  return (
    <section className="operation-panel">
      <h2>{title}</h2>
      {!items.length ? (
        <p>No recorded items require attention.</p>
      ) : (
        <ul className="operation-events">
          {items.map((i) => (
            <li key={`${i.domain}-${i.id}`}>
              <div>
                <Link
                  to={
                    i.domain === 'applications'
                      ? `/landlord/applications/${i.id}`
                      : i.domain === 'viewings'
                        ? '/owner/viewings'
                        : `/owner/properties/${i.property_id}?tab=${i.domain}`
                  }
                >
                  {i.title}
                </Link>
                <small>
                  {i.property_name}
                  {i.owner_name && ` / ${i.owner_name}`}
                </small>
              </div>
              <time>{i.date}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function PortfolioRows({ items }) {
  return (
    <div className="portfolio-rows">
      {items.map((p) => (
        <article key={p.id}>
          <div>
            {p.cover_image_url && (
              <img
                className="portfolio-cover"
                src={p.cover_image_url}
                alt={p.name}
              />
            )}
            <Link to={`/owner/properties/${p.id}`}>
              <strong>{p.name}</strong>
            </Link>
            {p.managed_owner_id && (
              <p>
                Owner:{' '}
                <Link to={`/agent/owners/${p.managed_owner_id}`}>
                  {p.owner_name}
                </Link>
              </p>
            )}
            <p>
              {label(p.property_type)} · {p.locality}
            </p>
          </div>
          <div>
            <span className="status-badge">{label(p.occupancy)}</span>
            <p>{p.tenant_name ?? 'No current tenancy'}</p>
          </div>
          <div>
            <strong>
              {p.monthly_rent != null
                ? money(p.monthly_rent)
                : 'Rent not recorded'}
            </strong>
            <p>
              {p.open_maintenance} open maintenance ·{' '}
              {p.listing_status ? label(p.listing_status) : 'No listing'}
            </p>
          </div>
          <Link
            to={`/owner/properties/${p.id}?tab=${p.open_maintenance ? 'maintenance' : p.tenancy_id ? 'rent' : 'tenancies'}`}
          >
            {p.open_maintenance
              ? 'Review maintenance'
              : p.tenancy_id
                ? 'View rent'
                : 'Add tenancy'}
          </Link>
        </article>
      ))}
    </div>
  );
}
export default function OwnerHub() {
  const { profile } = useAuth();
  const state = useOwnerSummary();
  const d = state.data;
  return (
    <main className="owner-hub">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">PROPERTY OPERATIONS</p>
          <h1>Portfolio overview</h1>
        </div>
        <Link className="primary-button" to="/landlord/properties/new">
          Add property
        </Link>
      </header>
      {profile?.role === 'AGENT' && d && (
        <p>
          <Link to="/agent/owners">{d.owners ?? 0} active owners</Link> /
          Properties you manage on their behalf
        </p>
      )}
      <HubState state={state} />
      {d &&
        (d.total_properties === 0 ? (
          <section className="operation-panel">
            <h2>Add your first property</h2>
            <p>
              Start with its details, then record an existing tenancy or prepare
              it for a new tenant.
            </p>
            <ol>
              <li>Add property details and photos.</li>
              <li>
                Already occupied? Add the current tenancy and rent records.
              </li>
              <li>Available? Prepare a rental listing when you are ready.</li>
            </ol>
            <Link to="/landlord/properties/new">Add property</Link>
          </section>
        ) : (
          <>
            <div className="operations-summary">
              {Object.entries(d.totals).map(([key, value]) => (
                <Link
                  key={key}
                  to={
                    key === 'unread_messages'
                      ? '/conversations'
                      : key === 'applications'
                        ? '/owner/applications'
                        : key === 'maintenance'
                          ? '/owner/maintenance'
                          : key === 'overdue'
                            ? '/owner/rent'
                            : `/owner/properties?occupancy=${key === 'occupied' ? 'OCCUPIED' : key === 'vacant' ? 'VACANT' : ''}`
                  }
                >
                  <strong>{value}</strong>
                  <span>{label(key)}</span>
                </Link>
              ))}
            </div>
            <div className="operations-columns">
              <Events items={d.attention} title="Needs attention" />
              <Events items={d.upcoming} title="Upcoming" />
            </div>
            <section className="operation-panel">
              <h2>
                {profile.role === 'AGENT'
                  ? 'Properties you manage'
                  : 'Your properties'}
              </h2>
              <PortfolioRows items={d.portfolio} />
            </section>
            <section className="operation-panel">
              <h2>Recorded finances</h2>
              <p>
                {d.period.from} to {d.period.to} · Records entered in Asserta
              </p>
              <div className="operations-summary">
                {['expected', 'received', 'outstanding', 'expenses'].map(
                  (k) => (
                    <Link
                      key={k}
                      to={k === 'expenses' ? '/owner/finances' : '/owner/rent'}
                    >
                      <strong>{money(d.finances[k])}</strong>
                      <span>{label(k)}</span>
                    </Link>
                  ),
                )}
              </div>
            </section>
          </>
        ))}
    </main>
  );
}
export function PortfolioPage() {
  const [params, setParams] = useSearchParams(),
    [page, setPage] = useState(1);
  const state = useOwnerSummary(undefined, {
    page,
    limit: 20,
    owner_id: params.get('owner_id') || undefined,
    occupancy: params.get('occupancy') || undefined,
    location: params.get('location') || undefined,
  });
  // Keep core property management available before the operations API is deployed.
  if (state.routeUnavailable) return <PropertyListPage />;
  const occupancy = params.get('occupancy') ?? '',
    location = params.get('location') ?? '';
  return (
    <main className="owner-hub">
      <header className="panel-heading">
        <h1>Properties</h1>
        <Link to="/landlord/properties/new" className="primary-button">
          Add property
        </Link>
      </header>
      <OwnerSelector
        value={params.get('owner_id') ?? ''}
        onChange={(owner_id) => {
          setPage(1);
          setParams({ ...Object.fromEntries(params), owner_id });
        }}
      />
      <div className="operation-filters">
        <label>
          Occupancy
          <select
            value={occupancy}
            onChange={(e) => {
              setPage(1);
              setParams({
                owner_id: params.get('owner_id') ?? '',
                occupancy: e.target.value,
                location,
              });
            }}
          >
            <option value="">All</option>
            {['OCCUPIED', 'VACANT', 'NOTICE_GIVEN', 'INACTIVE'].map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Location
          <input
            value={location}
            onChange={(e) => {
              setPage(1);
              setParams({
                owner_id: params.get('owner_id') ?? '',
                occupancy,
                location: e.target.value,
              });
            }}
          />
        </label>
      </div>
      <HubState state={state} />
      {state.data && (
        <>
          <PortfolioRows
            items={state.data.portfolio.filter(
              (p) =>
                (!occupancy || p.occupancy === occupancy) &&
                p.locality.toLowerCase().includes(location.toLowerCase()),
            )}
          />
          {state.data.total_properties === 0 && (
            <p>
              No properties yet. Add a property, whether vacant or already
              occupied.
            </p>
          )}
          <div className="operation-row-actions">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 20 >= state.data.total_properties}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
export function GlobalOperationPage() {
  const { domain } = useParams();
  const [params, setParams] = useSearchParams();
  const ownerId = params.get('owner_id') || undefined;
  const state = useOwnerSummary(undefined, { limit: 100, owner_id: ownerId });
  const propertyId = params.get('property') || undefined;
  return (
    <main className="owner-hub">
      <h1>{configurations[domain]?.title ?? label(domain)}</h1>
      <OwnerSelector
        value={ownerId}
        onChange={(owner_id) => setParams({ owner_id })}
      />
      <HubState state={state} />
      {state.data && (
        <>
          <label>
            Property
            <select
              value={propertyId ?? ''}
              onChange={(e) =>
                setParams({ owner_id: ownerId ?? '', property: e.target.value })
              }
            >
              <option value="">All properties</option>
              {state.data.portfolio.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {configurations[domain] ? (
            <OperationPanel
              key={`${domain}-${propertyId}-${ownerId}`}
              ownerId={ownerId}
              domain={domain}
              propertyId={propertyId}
              token={state.token}
            />
          ) : (
            <LeasingPanel
              key={`${domain}-${propertyId}-${ownerId}`}
              propertyId={propertyId}
              token={state.token}
              ownerId={ownerId}
              mode={domain}
            />
          )}
        </>
      )}
    </main>
  );
}
export function LeasingPanel({ propertyId, ownerId, token, mode = 'leasing' }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    operationRequest(
      token,
      `/leasing?${queryString({ owner_id: ownerId, property_id: propertyId, page, limit: 20 })}`,
    )
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [propertyId, ownerId, token, page, attempt]);
  return (
    <section className="operation-panel">
      <h2>{label(mode)}</h2>
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setAttempt((v) => v + 1)}>Try again</button>
        </p>
      )}
      {!data && !error && <p>Loading leasing activity...</p>}
      {data && (
        <>
          {mode === 'leasing' && propertyId && (
            <>
              <Link to={`/landlord/listings/new?property_id=${propertyId}`}>
                Create listing
              </Link>
              <ul>
                {data.listings.map((l) => (
                  <li key={l.id}>
                    <Link to={`/landlord/listings/${l.id}`}>{l.title}</Link> ·{' '}
                    {label(l.status)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {mode !== 'viewings' && (
            <>
              <h3>Applications</h3>
              <ul>
                {data.applications.map((a) => (
                  <li key={a.id}>
                    <Link to={`/landlord/applications/${a.id}`}>
                      {a.tenant?.profile?.first_name ?? 'Applicant'} ·{' '}
                      {label(a.status)}
                    </Link>
                    {a.status === 'ACCEPTED' && (
                      <>
                        {' '}
                        ·{' '}
                        <Link
                          to={`/owner/properties/${a.listing?.property_id ?? propertyId}?tab=tenancies&application=${a.id}`}
                        >
                          Create tenancy
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {mode !== 'applications' && (
            <>
              <h3>Viewings</h3>
              <ul>
                {data.viewings.map((v) => (
                  <li key={v.id}>
                    <Link to={`/landlord/applications/${v.application_id}`}>
                      {new Date(v.start_time).toLocaleString()} ·{' '}
                      {label(v.status)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(mode === 'applications'
            ? !data.applications.length
            : mode === 'viewings'
              ? !data.viewings.length
              : !data.listings.length &&
                !data.applications.length &&
                !data.viewings.length) && <p>No leasing activity recorded.</p>}
          {data.totals && (
            <div className="operation-row-actions">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={
                  page * 20 >=
                  (data.totals[mode] ?? Math.max(...Object.values(data.totals)))
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
