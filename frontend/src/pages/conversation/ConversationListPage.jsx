import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listConversations } from '../../services/conversationService.js';

function localDate(value) {
  return new Intl.DateTimeFormat('en-MU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function name(counterparty) {
  return `${counterparty.first_name} ${counterparty.last_name}`;
}

export default function ConversationListPage() {
  const { profile, session } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page, signal) => {
      setLoading(true);
      setMessage('');
      try {
        const result = await listConversations(session.access_token, {
          page,
          signal,
        });
        setConversations(result.conversations);
        setMeta(result.meta);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMessage(
            error instanceof ApiError
              ? error.message
              : "We couldn't load your conversations. Try again.",
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [session.access_token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="management-shell conversation-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">
            {profile.role === 'TENANT' ? 'Tenant' : 'Landlord'}
          </p>
          <h1>Conversations</h1>
          <p>Rental conversations you participate in.</p>
        </div>
        <Link to={profile.role === 'TENANT' ? '/listings' : '/account'}>
          {profile.role === 'TENANT' ? 'Browse rentals' : 'Back to account'}
        </Link>
      </header>

      {loading ? <p aria-live="polite">Loading conversations...</p> : null}
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {!loading && message ? (
        <button type="button" onClick={() => load(meta.page)}>
          Try again
        </button>
      ) : null}
      {!loading && !message && conversations.length === 0 ? (
        <section className="empty-state">
          <h2>
            {profile.role === 'TENANT'
              ? 'No conversations yet'
              : 'No tenant conversations yet'}
          </h2>
          <p>
            {profile.role === 'TENANT'
              ? 'When you contact a landlord about a rental, the conversation will appear here.'
              : 'Conversations will appear when a tenant contacts you about a rental.'}
          </p>
          {profile.role === 'TENANT' ? (
            <Link className="primary-link-button" to="/listings">
              Browse rentals
            </Link>
          ) : null}
        </section>
      ) : null}

      {!loading && !message && conversations.length ? (
        <ul className="conversation-list" aria-label="Conversations">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link to={`/conversations/${conversation.id}`}>
                {conversation.counterparty.profile_photo_url ? (
                  <img
                    src={conversation.counterparty.profile_photo_url}
                    alt=""
                  />
                ) : (
                  <span className="conversation-avatar" aria-hidden="true">
                    {conversation.counterparty.first_name.charAt(0)}
                  </span>
                )}
                <span>
                  <strong>{name(conversation.counterparty)}</strong>
                  <span>
                    {conversation.listing_context.listing?.title ??
                      'Rental no longer available'}
                  </span>
                  <small>Updated {localDate(conversation.updated_at)}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !message && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Conversation pages">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => load(meta.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.total_pages}
            onClick={() => load(meta.page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </main>
  );
}
