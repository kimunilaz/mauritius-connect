import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="page-shell">
        <section className="auth-card" role="alert">
          <p className="eyebrow">Asserta</p>
          <h1>We couldn’t open this page</h1>
          <p>
            Check your connection and reload to try again. If you were filling
            out a form, unsaved changes may need to be entered again.
          </p>
          <div className="card-actions">
            <button
              className="primary-button"
              onClick={() => globalThis.location.reload()}
            >
              Reload page
            </button>
            <a className="secondary-button" href="/">
              Back to home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
