import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { getConversation } from '../../services/conversationService.js';

export default function ConversationDetailPage() {
  const { conversationId } = useParams();
  const { session } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getConversation(session.access_token, conversationId, {
      signal: controller.signal,
    })
      .then(setConversation)
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setMessage(
            error instanceof ApiError && error.status === 404
              ? 'Conversation not found.'
              : "We couldn't load this conversation. Try again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [conversationId, session.access_token]);

  return (
    <main className="management-shell conversation-shell">
      <Link className="public-back-link" to="/conversations">
        Back to conversations
      </Link>
      {loading ? <p aria-live="polite">Loading conversation...</p> : null}
      {!loading && !conversation ? (
        <section className="public-state" role="alert">
          <h1>Conversation unavailable</h1>
          <p>{message}</p>
        </section>
      ) : null}
      {!loading && conversation ? (
        <article className="management-panel conversation-detail">
          <header className="conversation-counterparty">
            {conversation.counterparty.profile_photo_url ? (
              <img src={conversation.counterparty.profile_photo_url} alt="" />
            ) : null}
            <div>
              <p className="eyebrow">Conversation with</p>
              <h1>
                {conversation.counterparty.first_name}{' '}
                {conversation.counterparty.last_name}
              </h1>
            </div>
          </header>
          <section aria-labelledby="rental-context-title">
            <h2 id="rental-context-title">Rental context</h2>
            {conversation.listing_context.listing ? (
              <div>
                <strong>{conversation.listing_context.listing.title}</strong>
                <p>
                  Availability:{' '}
                  {conversation.listing_context.availability === 'AVAILABLE'
                    ? 'Available'
                    : 'Unavailable'}
                </p>
              </div>
            ) : (
              <div className="unavailable-conversation-context">
                <strong>Rental unavailable</strong>
                <p>
                  This conversation remains accessible, but the rental's private
                  listing details are no longer shown.
                </p>
              </div>
            )}
          </section>
          <section
            className="conversation-foundation"
            aria-labelledby="conversation-state-title"
          >
            <h2 id="conversation-state-title">Conversation ready</h2>
            <p>
              Message history and sending will be added in the next messaging
              task.
            </p>
          </section>
        </article>
      ) : null}
    </main>
  );
}
