import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { tenantOperationRequest } from '../../services/operationService.js';
import OperationPanel from './OperationPanel.jsx';
import { money, label } from './operationConfig.js';
import './operations.css';
export default function TenantHome() {
  const { session } = useAuth();
  const token = session.access_token;
  const [homes, setHomes] = useState(null),
    [selected, setSelected] = useState(''),
    [tab, setTab] = useState('rent'),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    tenantOperationRequest(token, '/home')
      .then((d) => active && setHomes(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token, revision]);
  const home = homes?.find((t) => t.id === selected) ?? homes?.[0];
  return (
    <main className="owner-hub">
      <h1>My home</h1>
      {error && <p role="alert">{error}</p>}
      {!homes && !error && <p role="status">Loading your home...</p>}
      {home ? (
        <>
          <label>
            Your tenancy
            <select
              value={home.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {homes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.property?.address_line_1 ?? t.property?.locality}
                </option>
              ))}
            </select>
          </label>
          <section className="operation-panel">
            <h2>{home.property?.address_line_1 ?? home.property?.locality}</h2>
            <p>
              {label(home.status)} · {home.start_date} to{' '}
              {home.expected_end_date ?? 'Open-ended'}
            </p>
            <strong>{money(home.monthly_rent)} / month</strong>
            <p>
              Rent records show amounts entered by your property owner. Asserta
              does not collect payments.
            </p>
            <button
              onClick={async () => {
                try {
                  const r = await tenantOperationRequest(
                    token,
                    `/tenancies/${home.id}/conversation`,
                    { method: 'POST' },
                  );
                  globalThis.location.assign(`/conversations/${r.id}`);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Message property owner
            </button>
          </section>
          <nav className="property-tabs" aria-label="My home sections">
            {['rent', 'maintenance', 'documents'].map((t) => (
              <button
                key={t}
                className={tab === t ? 'is-active' : 'secondary-button'}
                onClick={() => setTab(t)}
              >
                {label(t)}
              </button>
            ))}
          </nav>
          <OperationPanel
            key={`${home.id}-${tab}`}
            domain={tab}
            tenant
            canSubmit={
              home.status !== 'UPCOMING' &&
              home.start_date <= new Date().toISOString().slice(0, 10)
            }
            propertyId={home.property_id}
            tenantId={home.id}
            token={token}
          />
        </>
      ) : (
        homes && (
          <p>
            No current or upcoming tenancy is connected to your account. You can
            continue browsing and applying for rentals.
          </p>
        )
      )}
      <details>
        <summary>Connect an existing tenancy</summary>
        <p>Ask your property owner for a private connection code.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              await tenantOperationRequest(token, '/claim', {
                method: 'POST',
                body: { code: code.trim() },
              });
              setCode('');
              setRevision((v) => v + 1);
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <label>
            Connection code
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button>Connect tenancy</button>
        </form>
      </details>
    </main>
  );
}
