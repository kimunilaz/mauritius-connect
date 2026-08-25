import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService.js';

function localDate(value) {
  return new Intl.DateTimeFormat('en-MU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function NotificationPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page, signal) => {
      setLoading(true);
      setMessage('');
      try {
        const result = await listNotifications(session.access_token, {
          page,
          signal,
        });
        setNotifications(result.notifications);
        setMeta(result.meta);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMessage(
            error instanceof ApiError
              ? error.message
              : "We couldn't load your notifications. Try again.",
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

  async function openNotification(notification) {
    if (!notification.read_at) {
      setPending(notification.id);
      try {
        await markNotificationRead(session.access_token, notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, read_at: new Date().toISOString() }
              : item,
          ),
        );
      } catch (error) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't update that notification.",
        );
        return;
      } finally {
        setPending(null);
      }
    }
    if (notification.target) navigate(notification.target);
  }

  async function markAll() {
    setPending('all');
    try {
      await markAllNotificationsRead(session.access_token);
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "We couldn't update your notifications.",
      );
    } finally {
      setPending(null);
    }
  }

  const hasUnread = notifications.some((item) => !item.read_at);

  return (
    <main className="management-shell conversation-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Updates</p>
          <h1>Notifications</h1>
          <p>Updates about your applications, viewings, and conversations.</p>
        </div>
        <Link to="/account">Back to account</Link>
      </header>

      {hasUnread ? (
        <button type="button" disabled={pending !== null} onClick={markAll}>
          {pending === 'all' ? 'Marking all as read...' : 'Mark all as read'}
        </button>
      ) : null}
      {loading ? <p aria-live="polite">Loading notifications...</p> : null}
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {!loading && !message && notifications.length === 0 ? (
        <section className="empty-state">
          <h2>No notifications yet</h2>
          <p>
            Updates about your applications, viewings, and conversations will
            appear here.
          </p>
        </section>
      ) : null}
      {!loading && !message && notifications.length > 0 ? (
        <ul className="notification-list" aria-label="Notifications">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={notification.read_at ? '' : 'notification-unread'}
                disabled={pending === notification.id}
                onClick={() => openNotification(notification)}
                aria-label={`${notification.read_at ? 'Read' : 'Unread'}: ${notification.title}`}
              >
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{localDate(notification.created_at)}</small>
                {!notification.read_at ? <em>Unread</em> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !message && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Notification pages">
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
