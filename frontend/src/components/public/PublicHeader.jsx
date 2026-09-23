import { Link, useLocation } from 'react-router-dom';
import Brand from '../common/Brand.jsx';
import { isWorkspacePath } from '../common/WorkspaceLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { getUnreadNotificationCount } from '../../services/notificationService.js';

export default function PublicHeader() {
  const { isAuthenticated, profile, session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    function closeOutside(event) {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    }
    const desktop = globalThis.matchMedia('(min-width: 72rem)');
    function closeOnDesktop(event) {
      if (event.matches) setMenuOpen(false);
    }
    globalThis.document.addEventListener('keydown', closeOnEscape);
    globalThis.document.addEventListener('pointerdown', closeOutside);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      globalThis.document.removeEventListener('keydown', closeOnEscape);
      globalThis.document.removeEventListener('pointerdown', closeOutside);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [menuOpen]);

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
    <header className="public-header" ref={headerRef}>
      <Brand light />
      <button
        className="public-menu-toggle"
        ref={menuButtonRef}
        type="button"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-controls="public-main-navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="public-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span aria-hidden="true">Menu</span>
      </button>
      <nav
        className={`public-navigation${menuOpen ? ' is-open' : ''}`}
        id="public-main-navigation"
        aria-label="Main navigation"
        onClick={(event) => {
          if (event.target.closest('a')) setMenuOpen(false);
        }}
      >
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
