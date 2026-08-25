import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  getConversation,
  listMessages,
  markConversationRead,
  sendMessage,
} from '../../services/conversationService.js';
import { createReport } from '../../services/reportService.js';

function localDate(value) {
  return new Intl.DateTimeFormat('en-MU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ConversationDetailPage() {
  const { conversationId } = useParams();
  const { session } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [reportingMessageId, setReportingMessageId] = useState(null);
  const [reportReason, setReportReason] = useState('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatusMessage, setReportStatusMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await getConversation(
          session.access_token,
          conversationId,
          { signal: controller.signal },
        );
        setConversation(result);
        try {
          const history = await listMessages(
            session.access_token,
            conversationId,
            { signal: controller.signal },
          );
          setMessages(Array.isArray(history?.data) ? history.data : []);
          await markConversationRead(session.access_token, conversationId);
        } catch (messageError) {
          if (messageError.name !== 'AbortError') {
            setError("We couldn't load messages. Try again.");
          }
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(
            requestError instanceof ApiError && requestError.status === 404
              ? 'Conversation not found.'
              : "We couldn't load this conversation. Try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setMessageLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [conversationId, session.access_token]);

  async function submitMessage(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const sent = await sendMessage(
        session.access_token,
        conversationId,
        draft,
      );
      setMessages((current) => [...current, sent]);
      setDraft('');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "We couldn't send that message. Try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function reportMessage(event) {
    event.preventDefault();
    try {
      const result = await createReport(session.access_token, {
        target_type: 'MESSAGE',
        target_id: reportingMessageId,
        reason: reportReason,
        details: reportDetails,
      });
      setReportStatusMessage(
        result.created
          ? 'Message reported.'
          : 'This message is already reported by you.',
      );
      setReportingMessageId(null);
      setReportDetails('');
    } catch (requestError) {
      setReportStatusMessage(
        requestError instanceof ApiError
          ? requestError.message
          : 'The message report could not be submitted.',
      );
    }
  }

  return (
    <main className="management-shell conversation-shell">
      <Link className="public-back-link" to="/conversations">
        Back to conversations
      </Link>
      {loading ? <p aria-live="polite">Loading conversation...</p> : null}
      {!loading && !conversation ? (
        <section className="public-state" role="alert">
          <h1>Conversation unavailable</h1>
          <p>{error}</p>
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
            className="conversation-messages"
            aria-labelledby="messages-title"
          >
            <h2 id="messages-title">Messages</h2>
            {messageLoading ? (
              <p aria-live="polite">Loading messages...</p>
            ) : null}
            {!messageLoading && messages.length === 0 ? (
              <p>No messages yet. Start the conversation when you're ready.</p>
            ) : null}
            <ol aria-label="Message history">
              {messages.map((item) => (
                <li
                  key={item.id}
                  className={
                    item.sender.is_me ? 'message-own' : 'message-counterparty'
                  }
                >
                  <span>
                    {item.sender.is_me
                      ? 'You'
                      : conversation.counterparty.first_name}
                  </span>
                  <p>{item.body}</p>
                  {!item.sender.is_me ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setReportingMessageId(item.id)}
                    >
                      Report message
                    </button>
                  ) : null}
                  {reportingMessageId === item.id ? (
                    <form onSubmit={reportMessage}>
                      <label htmlFor={`message-report-reason-${item.id}`}>
                        Reason
                      </label>
                      <select
                        id={`message-report-reason-${item.id}`}
                        value={reportReason}
                        onChange={(event) =>
                          setReportReason(event.target.value)
                        }
                      >
                        <option value="HARASSMENT">Harassment</option>
                        <option value="SPAM">Spam</option>
                        <option value="FRAUD_OR_SCAM">Fraud or scam</option>
                        <option value="INAPPROPRIATE_CONTENT">
                          Inappropriate content
                        </option>
                        <option value="OTHER">Other</option>
                      </select>
                      <label htmlFor={`message-report-details-${item.id}`}>
                        Details (optional)
                      </label>
                      <textarea
                        id={`message-report-details-${item.id}`}
                        maxLength={1000}
                        value={reportDetails}
                        onChange={(event) =>
                          setReportDetails(event.target.value)
                        }
                      />
                      <button type="submit">Submit report</button>
                    </form>
                  ) : null}
                  <time dateTime={item.created_at}>
                    {localDate(item.created_at)}
                  </time>
                </li>
              ))}
            </ol>
            {error ? (
              <p className="form-message" role="alert">
                {error}
              </p>
            ) : null}
            {reportStatusMessage ? (
              <p className="form-message" role="status">
                {reportStatusMessage}
              </p>
            ) : null}
            <form onSubmit={submitMessage}>
              <label htmlFor="conversation-message">Message</label>
              <textarea
                id="conversation-message"
                value={draft}
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" disabled={sending || !draft.trim()}>
                {sending ? 'Sending...' : 'Send message'}
              </button>
            </form>
          </section>
        </article>
      ) : null}
    </main>
  );
}
