import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ownerRequest } from '../../services/managedOwnerService.js';
import {
  useOwnerSummary,
  HubState,
  PortfolioRows,
} from '../owner/OwnerHub.jsx';
import { money } from '../owner/operationConfig.js';
export function OwnerForm({ initial = {}, onSave, onCancel }) {
  const [fields, setFields] = useState(
      Object.fromEntries(
        ['name', 'company', 'email', 'phone', 'address', 'notes'].map((k) => [
          k,
          initial[k] ?? '',
        ]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="operation-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSave(fields);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{initial.id ? 'Edit owner' : 'New owner'}</h2>
      {Object.keys(fields).map((k) => (
        <label key={k}>
          {k === 'name' ? 'Owner name' : k[0].toUpperCase() + k.slice(1)}
          {['address', 'notes'].includes(k) ? (
            <textarea
              value={fields[k]}
              maxLength={k === 'notes' ? 5000 : 1000}
              onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
            />
          ) : (
            <input
              value={fields[k]}
              type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
              required={k === 'name'}
              maxLength={k === 'email' ? 254 : k === 'phone' ? 50 : 200}
              onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
            />
          )}
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
      <div className="operation-row-actions">
        <button disabled={busy} type="submit">
          {busy ? 'Saving...' : 'Save owner'}
        </button>
        <button disabled={busy} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export default function OwnersPage() {
  const { session } = useAuth(),
    navigate = useNavigate();
  const [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [state, setState] = useState({}),
    [create, setCreate] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setState({});
    ownerRequest(
      session.access_token,
      `?${new globalThis.URLSearchParams({ search, archived, page, limit: 20 })}`,
      { signal: c.signal },
    )
      .then((data) => !c.signal.aborted && setState({ data }))
      .catch((e) => !c.signal.aborted && setState({ error: e.message }));
    return () => c.abort();
  }, [session.access_token, search, archived, page, attempt]);
  return (
    <main className="owner-hub managed-owners">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">MANAGED PROPERTY OWNERS</p>
          <h1>Owners</h1>
          <p>The people and businesses whose properties you manage.</p>
        </div>
        <button onClick={() => setCreate(true)}>Add owner</button>
      </header>
      {create && (
        <OwnerForm
          onCancel={() => setCreate(false)}
          onSave={async (fields) => {
            const o = await ownerRequest(session.access_token, '', {
              method: 'POST',
              body: fields,
            });
            navigate(`/agent/owners/${o.id}`);
          }}
        />
      )}
      <div className="operation-filters">
        <label>
          Search owners
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Records
          <select
            value={String(archived)}
            onChange={(e) => {
              setArchived(e.target.value === 'true');
              setPage(1);
            }}
          >
            <option value="false">Active owners</option>
            <option value="true">Archived owners</option>
          </select>
        </label>
      </div>
      {state.error ? (
        <p role="alert">
          {state.error}{' '}
          <button onClick={() => setAttempt((v) => v + 1)}>Try again</button>
        </p>
      ) : !state.data ? (
        <p role="status">Loading owners...</p>
      ) : (
        <>
          <div className="portfolio-rows">
            {state.data.items.map((o) => (
              <article key={o.id}>
                <div>
                  <Link to={`/agent/owners/${o.id}`}>
                    <strong>{o.name}</strong>
                  </Link>
                  <p>{o.company}</p>
                </div>
                <div>
                  <p>{o.email || 'No email recorded'}</p>
                  <p>{o.phone}</p>
                </div>
                <div>
                  <strong>{o.property_count} properties</strong>
                  <p>
                    {o.occupied} occupied / {o.vacant} vacant
                  </p>
                </div>
                <div>
                  <strong>{money(o.outstanding)}</strong>
                  <p>Outstanding rent records</p>
                </div>
              </article>
            ))}
          </div>
          {!state.data.items.length && (
            <p>
              No {archived ? 'archived ' : ''}owners found. Add an owner before
              creating a managed property.
            </p>
          )}
          <div className="operation-row-actions">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 20 >= state.data.total}
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
export function OwnerDetailPage() {
  const { ownerId } = useParams(),
    { session } = useAuth();
  const [record, setRecord] = useState(null),
    [error, setError] = useState(''),
    [edit, setEdit] = useState(false),
    [archive, setArchive] = useState(false),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const summary = useOwnerSummary(undefined, { owner_id: ownerId, limit: 20 });
  useEffect(() => {
    const c = new AbortController();
    setRecord(null);
    setError('');
    ownerRequest(session.access_token, `/${ownerId}`, { signal: c.signal })
      .then((o) => !c.signal.aborted && setRecord(o))
      .catch((e) => !c.signal.aborted && setError(e.message));
    return () => c.abort();
  }, [session.access_token, ownerId, attempt]);
  return (
    <main className="owner-hub managed-owners">
      <Link to="/agent/owners">All owners</Link>
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setAttempt((v) => v + 1)}>Reload owner</button>
        </p>
      )}
      {!record && !error && <p role="status">Loading owner...</p>}
      {record && (
        <>
          <header className="panel-heading">
            <div>
              <p className="eyebrow">
                PROPERTY OWNER {record.archived_at ? ' / ARCHIVED' : ''}
              </p>
              <h1>{record.name}</h1>
              <p>{record.company}</p>
            </div>
            {!record.archived_at && (
              <div className="operation-row-actions">
                <Link to={`/landlord/properties/new?owner_id=${record.id}`}>
                  Add property
                </Link>
                <button onClick={() => setEdit(true)}>Edit owner</button>
                <button onClick={() => setArchive(true)}>Archive owner</button>
              </div>
            )}
          </header>
          {archive && (
            <section className="operation-panel">
              <h2>Archive this owner?</h2>
              <p>
                Existing properties and records remain accessible. You will no
                longer be able to add properties for this owner.
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setRecord(
                      await ownerRequest(
                        session.access_token,
                        `/${ownerId}/archive`,
                        { method: 'POST', body: { version: record.version } },
                      ),
                    );
                    setArchive(false);
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirm archive
              </button>
              <button disabled={busy} onClick={() => setArchive(false)}>
                Cancel
              </button>
            </section>
          )}
          {edit ? (
            <OwnerForm
              key={record.version}
              initial={record}
              onCancel={() => setEdit(false)}
              onSave={async (fields) => {
                setRecord(
                  await ownerRequest(session.access_token, `/${ownerId}`, {
                    method: 'PATCH',
                    body: { ...fields, version: record.version },
                  }),
                );
                setEdit(false);
              }}
            />
          ) : (
            <dl className="operations-facts">
              {['email', 'phone', 'address', 'notes'].map((k) => (
                <div key={k}>
                  <dt>{k[0].toUpperCase() + k.slice(1)}</dt>
                  <dd>{record[k] || 'Not recorded'}</dd>
                </div>
              ))}
            </dl>
          )}
          <HubState state={summary} />
          {summary.data && (
            <>
              <section className="operation-panel">
                <h2>Managed properties</h2>
                <p>
                  {summary.data.total_properties} properties /{' '}
                  {money(summary.data.finances.outstanding)} outstanding in the
                  report period
                </p>
                <PortfolioRows items={summary.data.portfolio} />
                <Link to={`/owner/properties?owner_id=${ownerId}`}>
                  View all properties
                </Link>
              </section>
              <section className="operation-panel">
                <h2>Tenancies and activity</h2>
                <p>
                  {summary.data.total_tenancies ?? 0} tenancies in the current
                  report period.
                </p>
                <ul>
                  {summary.data.activity.map((a) => (
                    <li key={`${a.title}-${a.id}`}>
                      {a.title}{' '}
                      <Link to={`/owner/properties/${a.property_id}`}>
                        Open property
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to={`/owner/reports?owner_id=${ownerId}`}>
                  Owner property report
                </Link>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
