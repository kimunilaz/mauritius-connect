import { useEffect, useState, useId } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ownerRequest } from '../../services/managedOwnerService.js';
export default function OwnerSelector({ value, onChange, required = false }) {
  const { session, profile } = useAuth();
  const selectorId = useId();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [state, setState] = useState({}),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (profile?.role !== 'AGENT') return;
    const c = new AbortController();
    setState({});
    ownerRequest(
      session.access_token,
      `?${new globalThis.URLSearchParams({ search, page, limit: 20 })}`,
      { signal: c.signal },
    )
      .then((data) => !c.signal.aborted && setState({ data }))
      .catch((e) => !c.signal.aborted && setState({ error: e.message }));
    return () => c.abort();
  }, [session.access_token, profile?.role, search, page, attempt]);
  if (profile?.role !== 'AGENT') return null;
  return (
    <div className="owner-selector">
      <label>
        Find owner
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <label htmlFor={selectorId}>Property owner</label>
      <select
        id={selectorId}
        required={required}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{required ? 'Select an owner' : 'All owners'}</option>
        {value && !state.data?.items?.some((o) => o.id === value) && (
          <option value={value}>Selected owner</option>
        )}
        {state.data?.items?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.company ? ` (${o.company})` : ''}
          </option>
        ))}
      </select>
      {!state.data && !state.error && (
        <small role="status">Loading owners...</small>
      )}
      {state.error && (
        <p role="alert">
          {state.error}{' '}
          <button type="button" onClick={() => setAttempt((v) => v + 1)}>
            Retry owners
          </button>
        </p>
      )}
      {state.data && state.data.total > 20 && (
        <div>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous owners
          </button>
          <button
            type="button"
            disabled={page * 20 >= state.data.total}
            onClick={() => setPage(page + 1)}
          >
            More owners
          </button>
        </div>
      )}
    </div>
  );
}
