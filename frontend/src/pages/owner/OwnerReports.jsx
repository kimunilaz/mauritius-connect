import { useSearchParams } from 'react-router-dom';
import OwnerSelector from '../agent/OwnerSelector.jsx';
import { useState } from 'react';
import { useOwnerSummary, HubState, PortfolioRows } from './OwnerHub.jsx';
import { money, label } from './operationConfig.js';
export default function OwnerReports() {
  const [params, setParams] = useSearchParams();
  const ownerId = params.get('owner_id') || undefined;
  const [from, setFrom] = useState(
      new Date().toISOString().slice(0, 7) + '-01',
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [property, setProperty] = useState(''),
    [page, setPage] = useState(1);
  const choices = useOwnerSummary(undefined, { limit: 100, owner_id: ownerId });
  const state = useOwnerSummary(property || undefined, {
    owner_id: ownerId,
    from,
    to,
    page,
    limit: 20,
  });
  function csv() {
    const rows = [
      ['Measure', 'Recorded amount (MUR)'],
      ...Object.entries(state.data.finances),
    ];
    const content = rows
      .map((row) =>
        row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(','),
      )
      .join(String.fromCharCode(13, 10));
    const url = globalThis.URL.createObjectURL(
      new globalThis.Blob([content], { type: 'text/csv;charset=utf-8' }),
    );
    const a = globalThis.document.createElement('a');
    a.href = url;
    a.download = 'asserta-recorded-finances.csv';
    a.click();
    globalThis.URL.revokeObjectURL(url);
  }
  return (
    <main className="owner-hub">
      <h1>Property & portfolio reports</h1>
      <OwnerSelector
        value={ownerId}
        onChange={(owner_id) => {
          setParams({ owner_id });
          setProperty('');
          setPage(1);
        }}
      />
      <div className="operation-filters">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </label>
        <label>
          Property
          <select
            value={property}
            onChange={(e) => {
              setPage(1);
              setProperty(e.target.value);
            }}
          >
            <option value="">All properties</option>
            {choices.data?.portfolio.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <HubState state={state} />
      {state.data && (
        <>
          <section className="operation-panel">
            <div className="panel-heading">
              <h2>Recorded financial summary</h2>
              <button onClick={csv}>Export CSV</button>
            </div>
            <p>
              Expected and outstanding use rent due dates. Received uses offline
              receipt dates. Income includes rent receipts once plus other
              income entered. Expenses use the recorded date. Deposits are
              records, not money held by Asserta.
            </p>
            <dl className="operations-facts">
              {Object.entries(state.data.finances).map(([k, v]) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{money(v)}</dd>
                </div>
              ))}
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
          </section>
          <section className="operation-panel">
            <h2>Current occupancy</h2>
            <p>
              Occupancy is a current snapshot, independent of the financial date
              filter.
            </p>
            <PortfolioRows items={state.data.portfolio} />
          </section>
          <section className="operation-panel">
            <h2>Tenancy history</h2>
            <ul>
              {state.data.tenancy_history.map((t) => (
                <li key={t.id}>
                  {t.tenant_name} · {t.start_date} to{' '}
                  {t.end_date ?? t.expected_end_date ?? 'Open-ended'} ·{' '}
                  {label(t.status)}
                </li>
              ))}
            </ul>
          </section>
          <section className="operation-panel">
            <h2>Property activity</h2>
            <p>Latest 30 recorded events within the selected dates.</p>
            <ul>
              {state.data.activity.map((a) => (
                <li key={`${a.title}-${a.id}`}>
                  {new Date(a.occurred_at).toLocaleDateString()} · {a.title}
                </li>
              ))}
            </ul>
          </section>
          <div className="operation-row-actions">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous records
            </button>
            <span>Records page {page}</span>
            <button
              disabled={
                page * 20 >=
                Math.max(
                  state.data.total_properties,
                  state.data.total_tenancies ?? 0,
                )
              }
              onClick={() => setPage(page + 1)}
            >
              Next records
            </button>
          </div>
        </>
      )}
    </main>
  );
}
