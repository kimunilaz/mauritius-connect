import { useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Brand from './Brand.jsx';
import { statusLabel } from '../../utils/status.js';

const navigation = {
  LANDLORD: [
    ['Overview', '/account', '', ''],
    ['Properties', '/owner/properties', '', 'Portfolio'],
    ['Tenancies', '/owner/tenancies', '', ''],
    ['Listings', '/landlord/listings', '', 'Leasing'],
    ['Applications', '/owner/applications', '', ''],
    ['Viewings', '/owner/viewings', '', ''],
    ['Maintenance', '/owner/maintenance', '', 'Operations'],
    ['Inspections', '/owner/inspections', '', ''],
    ['Tasks', '/owner/tasks', '', ''],
    ['Rent ledger', '/owner/rent', '', 'Finances'],
    ['Income & expenses', '/owner/finances', '', ''],
    ['Documents', '/owner/documents', '', 'Records'],
    ['Messages', '/conversations', '', ''],
    ['Reports', '/owner/reports', '', ''],
    ['Notifications', '/notifications', '', 'Account'],
    ['Verification', '/landlord/verifications', '', ''],
    ['My profile', '/landlord/profile', '', ''],
  ],
  TENANT: [
    ['My home', '/tenant/home', ''],
    ['Overview', '/account', '◫'],
    ['Browse rentals', '/listings', '⌂'],
    ['Saved homes', '/tenant/saved-listings', '♡'],
    ['Applications', '/tenant/applications', '▤'],
    ['Messages', '/conversations', '◷'],
    ['Notifications', '/notifications', '◉'],
    ['My profile', '/tenant/profile', '○'],
  ],
  ADMIN: [
    ['Overview', '/account', '◫'],
    ['Listings', '/admin/listings', '▤'],
    ['Users', '/admin/users', '○'],
    ['Reports', '/admin/reports', '⚑'],
    ['Verifications', '/admin/verifications', '✓'],
  ],
};

navigation.AGENT = [
  navigation.LANDLORD[0],
  ['Owners', '/agent/owners', '', ''],
  ...navigation.LANDLORD.slice(1),
];

export function isWorkspacePath(path) {
  return /^\/(account|agent|owner|landlord|tenant|admin|conversations|notifications)(\/|$)/.test(
    path,
  );
}

export default function WorkspaceLayout({ children }) {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const menuButton = useRef(null);
  if (!profile || !isWorkspacePath(pathname)) return children;
  const links = navigation[profile.role] ?? [];
  const current = links.find(
    ([, path]) =>
      pathname === path ||
      (path !== '/account' && pathname.startsWith(`${path}/`)),
  );
  const role =
    profile.role === 'ADMIN'
      ? 'Admin'
      : profile.role === 'LANDLORD'
        ? 'Owner'
        : profile.role === 'AGENT'
          ? 'Agent'
          : 'Tenant';
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`;

  async function logout() {
    setSigningOut(true);
    setError('');
    try {
      await signOut();
      setOpen(false);
      navigate('/login', { replace: true });
    } catch {
      setError('Unable to log out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      className={`workspace${open ? ' workspace-menu-open' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#workspace-content">
        Skip to content
      </a>
      <aside className="workspace-sidebar" id="workspace-navigation">
        <Brand />
        <div className="workspace-label">{role} workspace</div>
        <nav aria-label={`${role} navigation`}>
          {links.map(([label, path, icon, group]) => (
            <div key={path}>
              {group && <h2 className="workspace-nav-group">{group}</h2>}
              <NavLink
                key={path}
                to={path}
                end={path === '/account'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  isActive
                    ? 'workspace-nav-link is-active'
                    : 'workspace-nav-link'
                }
              >
                <span className="nav-symbol" aria-hidden="true">
                  {icon}
                </span>
                {label}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          {['LANDLORD', 'AGENT'].includes(profile.role) && (
            <Link className="workspace-marketplace" to="/listings">
              Browse rentals <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="workspace-topbar-start">
            <span className="workspace-mobile-brand">
              <Brand light compact />
            </span>
            <button
              type="button"
              className="workspace-menu-button"
              ref={menuButton}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? 'Close menu' : 'Menu'}
            </button>
            <span className="workspace-breadcrumb">
              Workspace <span aria-hidden="true">/</span>{' '}
              <strong>
                {current?.[0] ??
                  (pathname.startsWith('/landlord/properties')
                    ? 'Properties'
                    : 'Workspace')}
              </strong>
            </span>
          </div>
          <div className="workspace-topbar-end">
            <span className="workspace-user">
              <span className="user-avatar" aria-hidden="true">
                {initials}
              </span>
              <span>
                {profile.first_name}
                <small>
                  {role} · {statusLabel(profile.account_status)}
                </small>
              </span>
            </span>
            <button
              className="workspace-logout"
              onClick={logout}
              disabled={signingOut}
            >
              {signingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </header>
        {error ? (
          <p className="form-message" role="alert">
            {error}
          </p>
        ) : null}
        <div id="workspace-content" className="workspace-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="workspace-footer">
          <span>Asserta</span>
        </footer>
      </div>
    </div>
  );
}
