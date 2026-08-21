import { Link } from 'react-router-dom';

export default function AuthLayout({ title, intro, children, footer }) {
  return (
    <main className="page-shell">
      <section className="auth-card" aria-labelledby="auth-page-title">
        <Link className="brand-link" to="/">
          Mauritius Rental Platform
        </Link>
        <h1 id="auth-page-title">{title}</h1>
        {intro ? <p>{intro}</p> : null}
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
    </main>
  );
}
