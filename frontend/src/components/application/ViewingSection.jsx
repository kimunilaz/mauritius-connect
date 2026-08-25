import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient.js';
import {
  cancelViewing,
  completeViewing,
  confirmViewing,
  declineViewing,
  listViewings,
  noShowViewing,
  proposeViewing,
} from '../../services/viewingService.js';

function localDateTime(value) {
  if (!value) return 'Not provided';
  return new Intl.DateTimeFormat('en-MU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function label(status) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ViewingSection({
  accessToken,
  applicationId,
  applicationStatus,
  role,
  onApplicationChanged,
}) {
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_time: '', end_time: '', notes: '' });

  async function refresh(signal) {
    const result = await listViewings(accessToken, applicationId, { signal });
    setViewings(Array.isArray(result) ? result : (result?.data ?? []));
  }

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal)
      .catch((error) => {
        if (error.name !== 'AbortError')
          setMessage(
            error instanceof ApiError
              ? error.message
              : "We couldn't load the viewings.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, applicationId]);

  const open = viewings.find(({ status }) =>
    ['PROPOSED', 'CONFIRMED'].includes(status),
  );
  const canPropose =
    role === 'LANDLORD' &&
    ['SHORTLISTED', 'VIEWING_INVITED'].includes(applicationStatus) &&
    !open;

  async function run(action, success, confirmation) {
    if (confirmation && !globalThis.confirm(confirmation)) return;
    setPending(true);
    setMessage('');
    try {
      await action();
      await refresh();
      await onApplicationChanged?.();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "We couldn't update the viewing. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await run(
      () =>
        proposeViewing(accessToken, applicationId, {
          start_time: new Date(form.start_time).toISOString(),
          end_time: form.end_time
            ? new Date(form.end_time).toISOString()
            : null,
          notes: form.notes || null,
        }),
      'Viewing proposed.',
    );
    setShowForm(false);
  }

  return (
    <section
      className="management-panel viewing-section"
      aria-labelledby="viewings-title"
    >
      <div className="viewing-heading">
        <h2 id="viewings-title">Viewings</h2>
        {canPropose ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => setShowForm((value) => !value)}
          >
            Propose viewing
          </button>
        ) : null}
      </div>
      {showForm ? (
        <form className="viewing-form" onSubmit={submit}>
          <label htmlFor="viewing-start">Start time *</label>
          <input
            id="viewing-start"
            type="datetime-local"
            required
            value={form.start_time}
            onChange={(event) =>
              setForm({ ...form, start_time: event.target.value })
            }
          />
          <label htmlFor="viewing-end">End time</label>
          <input
            id="viewing-end"
            type="datetime-local"
            value={form.end_time}
            onChange={(event) =>
              setForm({ ...form, end_time: event.target.value })
            }
          />
          <label htmlFor="viewing-notes">Notes</label>
          <textarea
            id="viewing-notes"
            maxLength="1000"
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
          />
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? 'Proposing...' : 'Send viewing proposal'}
          </button>
        </form>
      ) : null}
      {loading ? <p>Loading viewings...</p> : null}
      {!loading && !viewings.length ? <p>No viewings scheduled.</p> : null}
      {viewings.length ? (
        <ol className="viewing-list">
          {viewings.map((viewing) => {
            const afterStart = new Date(viewing.start_time) <= new Date();
            return (
              <li key={viewing.id}>
                <strong>{label(viewing.status)}</strong>
                <span>{localDateTime(viewing.start_time)}</span>
                {viewing.end_time ? (
                  <span>Ends {localDateTime(viewing.end_time)}</span>
                ) : null}
                {viewing.notes ? <p>{viewing.notes}</p> : null}
                <div className="application-review-actions">
                  {role === 'TENANT' && viewing.status === 'PROPOSED' ? (
                    <>
                      <button
                        className="primary-button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => confirmViewing(accessToken, viewing.id),
                            'Viewing confirmed.',
                          )
                        }
                        type="button"
                      >
                        Confirm viewing
                      </button>
                      <button
                        className="secondary-button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => declineViewing(accessToken, viewing.id),
                            'Viewing declined.',
                          )
                        }
                        type="button"
                      >
                        Decline viewing
                      </button>
                    </>
                  ) : null}
                  {['PROPOSED', 'CONFIRMED'].includes(viewing.status) ? (
                    <button
                      className="danger-button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => cancelViewing(accessToken, viewing.id),
                          'Viewing cancelled.',
                          'Cancel this viewing?',
                        )
                      }
                      type="button"
                    >
                      Cancel viewing
                    </button>
                  ) : null}
                  {role === 'LANDLORD' &&
                  viewing.status === 'CONFIRMED' &&
                  afterStart ? (
                    <>
                      <button
                        className="primary-button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => completeViewing(accessToken, viewing.id),
                            'Viewing completed.',
                            'Mark this viewing complete?',
                          )
                        }
                        type="button"
                      >
                        Complete viewing
                      </button>
                      <button
                        className="danger-button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => noShowViewing(accessToken, viewing.id),
                            'Viewing marked no-show.',
                            'Mark this viewing as no-show?',
                          )
                        }
                        type="button"
                      >
                        Mark no-show
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
