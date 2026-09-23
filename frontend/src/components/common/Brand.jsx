import { Link } from 'react-router-dom';

export default function Brand({ light = false, compact = false }) {
  return (
    <Link
      className={`asserta-brand${light ? ' asserta-brand-light' : ''}${compact ? ' asserta-brand-compact' : ''}`}
      to="/"
      aria-label="Asserta home"
    >
      <img
        className="asserta-mark"
        src={light ? '/brand/mark-light.svg' : '/brand/mark.svg'}
        width="40"
        height="40"
        alt=""
      />
      {!compact && (
        <span className="asserta-wordmark" aria-hidden="true">
          Asserta
        </span>
      )}
    </Link>
  );
}
