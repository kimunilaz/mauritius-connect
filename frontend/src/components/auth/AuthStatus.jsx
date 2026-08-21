export function AuthLoading() {
  return (
    <main className="page-shell">
      <section className="auth-card" aria-live="polite">
        <p>Loading your account…</p>
      </section>
    </main>
  );
}

export function AccountUnavailable({ message }) {
  return (
    <main className="page-shell">
      <section className="auth-card" role="alert">
        <h1>Account unavailable</h1>
        <p>{message ?? 'This account cannot access the platform right now.'}</p>
      </section>
    </main>
  );
}
