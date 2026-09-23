import { Link } from 'react-router-dom';
import Brand from '../common/Brand.jsx';

export default function AuthLayout({ title, intro, children, footer }) {
  return (
    <main className="auth-experience">
      <aside className="auth-story">
        <Brand light />
        <div>
          <span className="banner-tag">RENTAL WORKFLOW SOFTWARE</span>
          <h2>From available to rented.</h2>
          <p>
            Manage properties, applications, viewings and tenant conversations
            with Asserta. Looking for a home? Browse rentals and track your
            applications.
          </p>
          <div className="auth-story-points">
            <span>
              01 <strong>List your property</strong>
            </span>
            <span>
              02 <strong>Review applications and arrange viewings</strong>
            </span>
            <span>
              03 <strong>Choose your tenant</strong>
            </span>
          </div>
        </div>
        <small>
          Rental tools for property owners and tenants in Mauritius.
        </small>
      </aside>
      <div className="auth-form-side">
        <section className="auth-card" aria-labelledby="auth-page-title">
          <Link className="brand-link" to="/">
            ← Back to Asserta
          </Link>
          <h1 id="auth-page-title">{title}</h1>
          {intro ? <p>{intro}</p> : null}
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
        </section>
      </div>
    </main>
  );
}
