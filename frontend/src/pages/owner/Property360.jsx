import { lazy, Suspense, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useOwnerSummary, HubState, LeasingPanel } from './OwnerHub.jsx';
import { configurations, label, money } from './operationConfig.js';
import OperationPanel from './OperationPanel.jsx';
const PropertyDetailPage = lazy(
  () => import('../property/PropertyDetailPage.jsx'),
);
import { operationRequest } from '../../services/operationService.js';
const tabs = [
  ['overview', 'Overview'],
  ['tenancies', 'Tenancy'],
  ['leasing', 'Leasing'],
  ['maintenance', 'Maintenance'],
  ['rent', 'Rent ledger'],
  ['finances', 'Income & expenses'],
  ['inspections', 'Inspections'],
  ['documents', 'Documents'],
  ['tasks', 'Tasks'],
  ['details', 'Private notes'],
  ['physical', 'Property details'],
  ['activity', 'Activity'],
];
export default function Property360() {
  const { propertyId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const state = useOwnerSummary(propertyId);
  const [error, setError] = useState('');
  const p = state.data?.portfolio[0];
  return (
    <main className="owner-hub">
      <Link to="/owner/properties">All properties</Link>
      <HubState state={state} />
      {p && (
        <>
          <header className="property-360-header">
            <div>
              <p className="eyebrow">PROPERTY RECORD</p>
              <h1>{p.name}</h1>
              {p.managed_owner_id && (
                <p>
                  Managed for{' '}
                  <Link to={`/agent/owners/${p.managed_owner_id}`}>
                    {p.owner_name}
                  </Link>
                </p>
              )}
              <p>
                {p.locality} · {label(p.property_type)}
              </p>
            </div>
            <div>
              <span className="status-badge">{label(p.occupancy)}</span>
              <p>{p.tenant_name ?? 'No current tenancy'}</p>
              {p.monthly_rent != null && (
                <strong>{money(p.monthly_rent)} / month</strong>
              )}
            </div>
          </header>
          <nav className="property-tabs" aria-label="Property sections">
            {tabs.map(([id, title]) => (
              <button
                key={id}
                className={tab === id ? 'is-active' : 'secondary-button'}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setParams({ tab: id })}
              >
                {title}
              </button>
            ))}
          </nav>
          {tab === 'overview' && (
            <>
              <section className="operation-panel">
                <h2>Property snapshot</h2>
                <dl className="operations-facts">
                  <div>
                    <dt>Occupancy</dt>
                    <dd>{label(p.occupancy)}</dd>
                  </div>
                  <div>
                    <dt>Current tenant</dt>
                    <dd>{p.tenant_name ?? 'None recorded'}</dd>
                  </div>
                  <div>
                    <dt>Lease dates</dt>
                    <dd>
                      {p.start_date ?? 'Not recorded'}{' '}
                      {p.expected_end_date ? `to ${p.expected_end_date}` : ''}
                    </dd>
                  </div>
                  {p.deposit_amount != null && (
                    <div>
                      <dt>Deposit record</dt>
                      <dd>{money(p.deposit_amount)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Recorded rent received</dt>
                    <dd>{money(state.data.finances.received)}</dd>
                  </div>
                  <div>
                    <dt>Outstanding rent</dt>
                    <dd>{money(state.data.finances.outstanding)}</dd>
                  </div>
                  <div>
                    <dt>Recorded expenses</dt>
                    <dd>{money(state.data.finances.expenses)}</dd>
                  </div>
                  <div>
                    <dt>Advertising</dt>
                    <dd>
                      {p.listing_status
                        ? label(p.listing_status)
                        : 'No listing'}
                    </dd>
                  </div>
                  <div>
                    <dt>Open maintenance</dt>
                    <dd>{p.open_maintenance}</dd>
                  </div>
                  <div>
                    <dt>Recorded net</dt>
                    <dd>
                      {money(
                        Number(state.data.finances.income) -
                          Number(state.data.finances.expenses),
                      )}
                    </dd>
                  </div>
                </dl>
                <p>
                  Recorded net is entered income plus offline rent receipts,
                  less recorded expenses, for {state.data.period.from} to{' '}
                  {state.data.period.to}.
                </p>
                <div className="operation-row-actions">
                  <button onClick={() => setParams({ tab: 'tenancies' })}>
                    {p.tenancy_id
                      ? 'View current tenancy'
                      : 'Add existing tenancy'}
                  </button>
                  <Link to={`/landlord/listings/new?property_id=${propertyId}`}>
                    Prepare a listing
                  </Link>
                  {p.tenancy_id && (
                    <button
                      className="secondary-button"
                      onClick={async () => {
                        try {
                          const r = await operationRequest(
                            state.token,
                            `/tenancies/${p.tenancy_id}/conversation`,
                            { method: 'POST' },
                          );
                          globalThis.location.assign(`/conversations/${r.id}`);
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Message tenant
                    </button>
                  )}
                </div>
                {error && <p role="alert">{error}</p>}
              </section>
              <section className="operation-panel">
                <h2>Needs attention</h2>
                <ul>
                  {state.data.attention.map((i) => (
                    <li key={i.id}>
                      <button
                        className="text-button"
                        onClick={() =>
                          setParams({
                            tab: configurations[i.domain]
                              ? i.domain
                              : 'leasing',
                          })
                        }
                      >
                        {i.title}
                      </button>{' '}
                      · {i.date}
                    </li>
                  ))}
                </ul>
                {!state.data.attention.length && (
                  <p>No recorded items require attention.</p>
                )}
              </section>
            </>
          )}
          {configurations[tab] && (
            <OperationPanel
              key={tab}
              domain={tab}
              propertyId={propertyId}
              token={state.token}
            />
          )}
          {tab === 'physical' && (
            <Suspense fallback={<p>Loading property details...</p>}>
              <PropertyDetailPage />
            </Suspense>
          )}
          {tab === 'leasing' && (
            <LeasingPanel propertyId={propertyId} token={state.token} />
          )}
          {tab === 'activity' && (
            <section className="operation-panel">
              <h2>Recent property history</h2>
              <p>
                Latest recorded events for this reporting period. Historical
                tenancies remain in the Tenancy section.
              </p>
              <ul className="operation-events">
                {state.data.activity.map((a) => (
                  <li key={`${a.title}-${a.id}`}>
                    <span>{a.title}</span>
                    <time>{new Date(a.occurred_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {state.data && !p && <p>Property not found.</p>}
    </main>
  );
}
