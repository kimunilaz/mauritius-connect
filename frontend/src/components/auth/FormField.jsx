export default function FormField({ id, label, error, hint, children }) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="field-error" id={descriptionId}>
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={descriptionId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
