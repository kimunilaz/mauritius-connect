import { Link, useLocation } from 'react-router-dom';
import Brand from '../common/Brand.jsx';
import { isWorkspacePath } from '../common/WorkspaceLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useEffect, useState } from 'react';
import { getUnreadNotificationCount } from '../../services/notificationService.js';

export default function PublicHeader() {
  const { isAuthenticated, profile } = useAuth();
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    if (
      !session?.access_token ||
      !['TENANT', 'LANDLORD', 'AGENT'].includes(profile?.role)
    ) {
      setUnreadCount(0);
      return undefined;
    }
    const controller = new AbortController();
    getUnreadNotificationCount(session.access_token, {
      signal: controller.signal,
    })
      .then((result) => setUnreadCount(result.unread_count ?? 0))
      .catch(() => undefined);
    return () => controller.abort();
  }, [profile?.role, session?.access_token]);

  if (profile && isWorkspacePath(pathname)) return null;

  return (
    <header className="public-header">
      <Brand light />
      <nav className="public-navigation" aria-label="Main navigation">
        <Link to="/listings">Browse rentals</Link>
        {!isAuthenticated || ['LANDLORD', 'AGENT'].includes(profile?.role) ? (
          <Link to={isAuthenticated ? '/landlord/properties' : '/register'}>
            {pathname === '/' ? 'Manage properties' : 'List a property'}
          </Link>
        ) : null}
        {profile?.role === 'TENANT' ? (
          <Link to="/tenant/saved-listings">Saved homes</Link>
        ) : null}
        {profile?.role === 'TENANT' ||
        ['LANDLORD', 'AGENT'].includes(profile?.role) ? (
          <Link to="/conversations">Conversations</Link>
        ) : null}
        {profile?.role === 'ADMIN' ? (
          <>
            <Link to="/admin/listings">Listing review</Link>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/reports">Reports</Link>
            <Link to="/admin/verifications">Verifications</Link>
          </>
        ) : null}
        {profile?.role === 'TENANT' ||
        ['LANDLORD', 'AGENT'].includes(profile?.role) ? (
          <Link to="/notifications" aria-label="Notifications">
            Notifications{unreadCount ? ` (${unreadCount} unread)` : ''}
          </Link>
        ) : null}
        <Link to={isAuthenticated ? '/account' : '/login'}>
          {isAuthenticated ? 'Account' : 'Log in'}
        </Link>
        {!isAuthenticated ? <Link to="/register">Create account</Link> : null}
      </nav>
    </header>
  );
}
