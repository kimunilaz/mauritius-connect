import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  operationRequest,
  tenantOperationRequest,
  queryString,
} from '../../services/operationService.js';
import { configurations, label, money } from './operationConfig.js';
import OperationForm from './OperationForm.jsx';
export default function OperationPanel({
  domain,
  propertyId,
  ownerId,
  token,
  tenantId,
  tenant = false,
  canSubmit = true,
}) {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [edit, setEdit] = useState(null),
    [related, setRelated] = useState({}),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [priority, setPriority] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [history, setHistory] = useState({}),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(''),
    [receipt, setReceipt] = useState(null);
  const request = tenant ? tenantOperationRequest : operationRequest;
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    request(
      token,
      `/${domain}?${queryString({ owner_id: tenant ? undefined : ownerId, property_id: tenant ? undefined : propertyId, tenancy_id: tenant ? tenantId : undefined, page, limit: 20, status, priority, from, to })}`,
      { signal: controller.signal, returnEnvelope: true },
    )
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [
    domain,
    propertyId,
    ownerId,
    tenantId,
    tenant,
    token,
    page,
    status,
    priority,
    from,
    to,
    revision,
    request,
  ]);
  async function form(row = {}) {
    setError('');
    try {
      if (!tenant) {
        const domains =
          domain === 'documents'
            ? ['tenancies', 'maintenance', 'inspections']
            : domain === 'finances'
              ? ['tenancies', 'maintenance', 'documents']
              : ['tenancies'];
        const results = await Promise.all(
          domains.map((d) =>
            operationRequest(
              token,
              `/${d}?${queryString({ owner_id: tenant ? undefined : ownerId, property_id: row.property_id ?? propertyId, limit: 100 })}`,
            ),
          ),
        );
        const links = Object.fromEntries(
          domains.map((d, i) => [d, results[i]]),
        );
        if (domain === 'tenancies') {
          const leasing = await operationRequest(
            token,
            `/properties/${row.property_id ?? propertyId}/leasing`,
          );
          links.applications = leasing.applications.filter(
            (a) => a.status === 'ACCEPTED',
          );
          const selected = links.applications.find(
            (a) => a.id === searchParams.get('application'),
          );
          if (!row.id && selected)
            row = {
              ...row,
              application_id: selected.id,
              tenant_name: [
                selected.tenant?.profile?.first_name,
                selected.tenant?.profile?.last_name,
              ]
                .filter(Boolean)
                .join(' '),
            };
        }
        setRelated(links);
      }
      setEdit(
        !row.id && domain === 'tenancies' && searchParams.get('application')
          ? { ...row, application_id: searchParams.get('application') }
          : row,
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function save(fields, file) {
    const body = edit.id
      ? fields
      : {
          ...fields,
          property_id: propertyId,
          ...(tenant ? { tenancy_id: tenantId } : {}),
        };
    if (domain === 'documents' && !edit.id) {
      const f = new globalThis.FormData();
      for (const [k, v] of Object.entries(body)) if (v !== null) f.append(k, v);
      f.append('file', file);
      await request(token, '/documents/upload', { method: 'POST', body: f });
    } else
      await request(token, `/${domain}${edit.id ? `/${edit.id}` : ''}`, {
        method: edit.id ? 'PATCH' : 'POST',
        body,
      });
    setEdit(null);
    setRevision((v) => v + 1);
    setMessage('Record saved.');
  }
  async function action(fn) {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  }
  if (edit)
    return (
      <OperationForm
        key={`${domain}-${edit.id ?? 'new'}`}
        domain={domain}
        initial={edit}
        related={related}
        onSave={save}
        onCancel={() => setEdit(null)}
        tenant={tenant}
      />
    );
  return (
    <section
      className="operation-panel"
      aria-label={configurations[domain].title}
    >
      <div className="panel-heading">
        <h2>{configurations[domain].title}</h2>
        {propertyId &&
          canSubmit &&
          !(domain === 'details' && data?.data.length > 0) &&
          (!tenant || domain === 'maintenance') && (
            <button onClick={() => form()}>
              {domain === 'documents'
                ? 'Upload document'
                : domain === 'tenancies'
                  ? 'Add tenancy'
                  : 'Add record'}
            </button>
          )}
      </div>
      {domain === 'rent' && (
        <p>Offline records only. No money is collected through Asserta.</p>
      )}
      {!tenant && (
        <div className="operation-filters">
          {(domain === 'rent' ||
            configurations[domain].fields.find((f) => f.key === 'status')) && (
            <label>
              Status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {(domain === 'rent'
                  ? [
                      'UPCOMING',
                      'DUE',
                      'PAID',
                      'PARTIALLY_PAID',
                      'OVERDUE',
                      'WAIVED',
                    ]
                  : configurations[domain].fields.find(
                      (f) => f.key === 'status',
                    ).options
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          {['rent', 'finances'].includes(domain) && (
            <>
              <label>
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </>
          )}
          {domain === 'maintenance' && (
            <label>
              Priority
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All priorities</option>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRevision((v) => v + 1)}>Try again</button>
        </p>
      )}
      {!data && !error && <p role="status">Loading records...</p>}
      {data?.data.length === 0 && (
        <p>
          No {configurations[domain].title.toLowerCase()} match these filters.
        </p>
      )}
      <div className="operation-records">
        {data?.data.map((r) => (
          <article key={r.id}>
            {!propertyId && (
              <Link to={`/owner/properties/${r.property_id}?tab=${domain}`}>
                {r.property?.locality ?? 'Open property'}
              </Link>
            )}
            <div className="operation-record-heading">
              <h3>
                {r.tenant_name ??
                  r.title ??
                  r.filename ??
                  r.reference_name ??
                  (domain === 'rent'
                    ? `Rent: ${r.period}`
                    : domain === 'finances'
                      ? `${label(r.kind)}: ${label(r.category)}`
                      : domain === 'inspections'
                        ? `${label(r.type)} inspection`
                        : configurations[domain].title)}
              </h3>
              {r.voided && <span className="status-badge">Voided</span>}
              {(r.rent_status || r.status) && (
                <span className="status-badge">
                  {label(r.rent_status ?? r.status)}
                </span>
              )}
            </div>
            <dl>
              {[
                ['start_date', 'Start'],
                ['expected_end_date', 'Expected end'],
                ['end_date', 'Ended'],
                ['due_date', 'Due'],
                ['record_date', 'Date'],
                ...(domain === 'documents' ? [['created_at', 'Uploaded']] : []),
                ['inspection_date', 'Inspection date'],
                ['scheduled_date', 'Scheduled'],
                ['priority', 'Priority'],
                ['owner_update', 'Owner update'],
                ['description', 'Description'],
                ['owner_notes', 'Private notes'],
                ['notes', 'Notes'],
                ['move_in_notes', 'Move-in record'],
                ['move_out_notes', 'Move-out record'],
                ['condition_notes', 'Condition observations'],
                ['vendor_name', 'Vendor (private)'],
                ['access_notes', 'Access notes (private)'],
                ['utilities_notes', 'Utilities notes'],
                ['acquisition_notes', 'Acquisition notes'],
              ]
                .filter(([k]) => r[k])
                .map(([k, l]) => (
                  <div key={k}>
                    <dt>{l}</dt>
                    <dd>{label(k === 'priority' ? r[k] : '') || r[k]}</dd>
                  </div>
                ))}
              {[
                'monthly_rent',
                'deposit_amount',
                'amount_due',
                'amount_paid',
                'outstanding',
                'amount',
                'estimated_cost',
                'actual_cost',
              ]
                .filter((k) => r[k] != null)
                .map((k) => (
                  <div key={k}>
                    <dt>{label(k)}</dt>
                    <dd>{money(r[k])}</dd>
                  </div>
                ))}
            </dl>
            {!tenant && domain === 'maintenance' && (
              <details
                onToggle={(e) => {
                  if (e.currentTarget.open && !history[r.id])
                    action(async () => {
                      const record = await operationRequest(
                        token,
                        `/maintenance/${r.id}`,
                      );
                      setHistory((h) => ({ ...h, [r.id]: record.updates }));
                    });
                }}
              >
                <summary>Maintenance history</summary>
                <ul>
                  {history[r.id]?.map((u) => (
                    <li key={u.id}>
                      {new Date(u.created_at).toLocaleString()} �{' '}
                      {label(u.status)} {u.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {r.checklist?.length > 0 && (
              <details>
                <summary>Inspection checklist</summary>
                <ul>
                  {r.checklist.map((i) => (
                    <li key={i.label}>
                      {i.label}: {label(i.condition)} {i.notes}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {r.receipts?.length > 0 && (
              <details>
                <summary>Latest recorded receipts (up to 100)</summary>
                <ul>
                  {r.receipts.map((p) => (
                    <li key={p.id}>
                      {p.received_on}: {money(p.amount)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {tenant && canSubmit && domain === 'maintenance' && (
              <label>
                Attach a maintenance photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    action(async () => {
                      const body = new globalThis.FormData();
                      body.append('property_id', propertyId);
                      body.append('tenancy_id', tenantId);
                      body.append('maintenance_id', r.id);
                      body.append('file', file);
                      await tenantOperationRequest(token, '/documents/upload', {
                        method: 'POST',
                        body,
                      });
                      setMessage('Maintenance photo uploaded.');
                    });
                  }}
                />
              </label>
            )}
            <div className="operation-row-actions">
              {!tenant && (
                <button className="secondary-button" onClick={() => form(r)}>
                  Edit record
                </button>
              )}
              {!tenant && domain === 'documents' && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    action(async () => {
                      await operationRequest(token, `/documents/${r.id}`, {
                        method: 'PATCH',
                        body: { version: r.version, archived: true },
                      });
                      setRevision((v) => v + 1);
                      setMessage(
                        'Document archived. New downloads and tenancy sharing are disabled.',
                      );
                    })
                  }
                >
                  Archive document
                </button>
              )}
              {domain === 'documents' && (
                <button
                  onClick={() =>
                    action(async () => {
                      const result = await request(
                        token,
                        `/documents/${r.id}/url${tenant ? `?tenancy_id=${tenantId}` : ''}`,
                      );
                      globalThis.open(
                        result.url,
                        '_blank',
                        'noopener,noreferrer',
                      );
                    })
                  }
                >
                  Download file
                </button>
              )}
              {!tenant &&
                domain === 'tenancies' &&
                !r.tenant_user_id &&
                !['ENDED', 'CANCELLED'].includes(r.status) && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      action(async () => {
                        const result = await operationRequest(
                          token,
                          `/tenancies/${r.id}/invitation`,
                          { method: 'POST' },
                        );
                        setMessage(
                          `Share this one-use connection code privately with your tenant: ${result.code}`,
                        );
                      })
                    }
                  >
                    Connect tenant account
                  </button>
                )}
              {!tenant && domain === 'rent' && r.outstanding > 0 && (
                <button
                  onClick={() =>
                    setReceipt({
                      id: r.id,
                      amount: r.outstanding,
                      request_key: globalThis.crypto.randomUUID(),
                    })
                  }
                >
                  Record offline receipt
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {receipt && (
        <form
          className="operation-form"
          onSubmit={(e) => {
            e.preventDefault();
            action(async () => {
              await operationRequest(token, `/rent/${receipt.id}/receipts`, {
                method: 'POST',
                body: {
                  amount: Number(receipt.amount),
                  received_on: receipt.date,
                  request_key: receipt.request_key,
                },
              });
              setReceipt(null);
              setRevision((v) => v + 1);
            });
          }}
        >
          <h3>Record offline rent received</h3>
          <label>
            Amount (MUR)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={receipt.amount}
              onChange={(e) =>
                setReceipt({ ...receipt, amount: e.target.value })
              }
            />
          </label>
          <label>
            Received on
            <input
              required
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setReceipt({ ...receipt, date: e.target.value })}
            />
          </label>
          <button>Save receipt</button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setReceipt(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {data && data.meta.total_pages > 1 && (
        <div className="operation-row-actions">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {data.meta.total_pages}
          </span>
          <button
            disabled={page >= data.meta.total_pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
