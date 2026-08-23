function controlFor(question, value, onChange, disabled) {
  const id = `application-answer-${question.id}`;
  const common = {
    id,
    name: `answer-${question.id}`,
    value,
    disabled,
    onChange: (event) => onChange(question.id, event.target.value),
  };

  if (question.question_type === 'TEXT') {
    return <textarea {...common} rows="4" maxLength="2000" />;
  }
  if (question.question_type === 'NUMBER') {
    return <input {...common} type="number" step="any" inputMode="decimal" />;
  }
  if (question.question_type === 'BOOLEAN') {
    return (
      <select {...common}>
        <option value="">Not answered</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (question.question_type === 'DATE') {
    return <input {...common} type="date" />;
  }
  if (question.question_type === 'SELECT') {
    return (
      <select {...common}>
        <option value="">Choose an option</option>
        {question.options.map((option) => (
          <option key={option.id} value={option.option_text}>
            {option.option_text}
          </option>
        ))}
      </select>
    );
  }
  return null;
}

export default function ApplicationQuestionFields({
  questions,
  values,
  errors,
  onChange,
  disabled,
}) {
  return (
    <section
      className="application-answer-section"
      aria-labelledby="application-questions-heading"
    >
      <h2 id="application-questions-heading">Application questions</h2>
      <p>
        You can save your answers and finish later. Required questions may stay
        empty while this application is a draft.
      </p>
      {!questions.length ? (
        <p className="field-hint">
          This landlord has no application questions.
        </p>
      ) : (
        <div className="application-answer-list">
          {questions.map((question) => {
            const id = `application-answer-${question.id}`;
            return (
              <div className="application-answer-field" key={question.id}>
                <label htmlFor={id}>
                  {question.question_text}
                  {question.is_required ? (
                    <span className="required-label"> Required</span>
                  ) : (
                    <span className="field-hint"> Optional</span>
                  )}
                </label>
                {controlFor(
                  question,
                  values[question.id] ?? '',
                  onChange,
                  disabled,
                )}
                {errors[question.id] ? (
                  <p className="field-error" role="alert">
                    {errors[question.id]}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
