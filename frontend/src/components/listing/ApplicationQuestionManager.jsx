import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient.js';
import {
  createApplicationQuestion,
  deleteApplicationQuestion,
  listLandlordApplicationQuestions,
  updateApplicationQuestion,
} from '../../services/applicationQuestionService.js';

const QUESTION_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT'];
const emptyQuestion = () => ({
  question_text: '',
  question_type: 'TEXT',
  is_required: false,
  display_order: 0,
  options: [],
});

function QuestionForm({ initial, onCancel, onSaved, token, listingId }) {
  const [question, setQuestion] = useState(initial ?? emptyQuestion());
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(initial?.id);

  function setField(field, value) {
    setQuestion((current) => ({ ...current, [field]: value }));
  }

  function setOption(index, field, value) {
    setQuestion((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option,
      ),
    }));
  }

  function chooseType(questionType) {
    setQuestion((current) => ({
      ...current,
      question_type: questionType,
      options:
        questionType === 'SELECT'
          ? current.options.length
            ? current.options
            : [{ option_text: '', display_order: 0 }]
          : [],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!question.question_text.trim()) {
      nextErrors.question_text = 'Enter the question.';
    }
    if (
      !Number.isInteger(Number(question.display_order)) ||
      question.display_order < 0
    ) {
      nextErrors.display_order = 'Enter an order of zero or greater.';
    }
    if (
      question.question_type === 'SELECT' &&
      (!question.options.length ||
        question.options.some(
          (option) =>
            !option.option_text.trim() ||
            !Number.isInteger(Number(option.display_order)) ||
            option.display_order < 0,
        ))
    ) {
      nextErrors.options = 'Each SELECT option needs text and a valid order.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      question_text: question.question_text,
      question_type: question.question_type,
      is_required: question.is_required,
      display_order: Number(question.display_order),
      ...(question.question_type === 'SELECT'
        ? {
            options: question.options.map((option) => ({
              option_text: option.option_text,
              display_order: Number(option.display_order),
            })),
          }
        : {}),
    };
    setSubmitting(true);
    setMessage('');
    try {
      if (editing) {
        await updateApplicationQuestion(token, listingId, initial.id, payload);
      } else {
        await createApplicationQuestion(token, listingId, payload);
      }
      await onSaved();
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The application question could not be saved.',
      );
      setErrors(error instanceof ApiError ? (error.fields ?? {}) : {});
      if (
        error instanceof ApiError &&
        error.code === 'APPLICATION_QUESTIONS_LOCKED'
      ) {
        await onSaved({ keepForm: false });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="question-form" onSubmit={submit} noValidate>
      <h3>{editing ? 'Edit question' : 'Add question'}</h3>
      <label htmlFor="application-question-text">Question</label>
      <textarea
        id="application-question-text"
        value={question.question_text}
        maxLength={500}
        onChange={(event) => setField('question_text', event.target.value)}
        aria-describedby={
          errors.question_text ? 'question-text-error' : undefined
        }
      />
      {errors.question_text ? (
        <p id="question-text-error" className="field-error">
          {errors.question_text}
        </p>
      ) : null}

      <div className="question-form-grid">
        <div>
          <label htmlFor="application-question-type">Type</label>
          <select
            id="application-question-type"
            value={question.question_type}
            onChange={(event) => chooseType(event.target.value)}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="application-question-order">Order</label>
          <input
            id="application-question-order"
            type="number"
            min="0"
            step="1"
            value={question.display_order}
            onChange={(event) =>
              setField('display_order', Number(event.target.value))
            }
          />
          {errors.display_order ? (
            <p className="field-error">{errors.display_order}</p>
          ) : null}
        </div>
      </div>

      <label className="checkbox-field" htmlFor="application-question-required">
        <input
          id="application-question-required"
          type="checkbox"
          checked={question.is_required}
          onChange={(event) => setField('is_required', event.target.checked)}
        />
        Required
      </label>

      {question.question_type === 'SELECT' ? (
        <fieldset className="question-options">
          <legend>Options</legend>
          {question.options.map((option, index) => (
            <div className="question-option-row" key={option.id ?? index}>
              <div>
                <label htmlFor={`question-option-text-${index}`}>
                  Option {index + 1}
                </label>
                <input
                  id={`question-option-text-${index}`}
                  value={option.option_text}
                  maxLength={200}
                  onChange={(event) =>
                    setOption(index, 'option_text', event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor={`question-option-order-${index}`}>Order</label>
                <input
                  id={`question-option-order-${index}`}
                  type="number"
                  min="0"
                  step="1"
                  value={option.display_order}
                  onChange={(event) =>
                    setOption(
                      index,
                      'display_order',
                      Number(event.target.value),
                    )
                  }
                />
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setQuestion((current) => ({
                    ...current,
                    options: current.options.filter(
                      (_candidate, optionIndex) => optionIndex !== index,
                    ),
                  }))
                }
              >
                Remove option {index + 1}
              </button>
            </div>
          ))}
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setQuestion((current) => ({
                ...current,
                options: [
                  ...current.options,
                  {
                    option_text: '',
                    display_order: current.options.length,
                  },
                ],
              }))
            }
          >
            Add option
          </button>
          {errors.options ? (
            <p className="field-error">{errors.options}</p>
          ) : null}
        </fieldset>
      ) : null}

      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting
            ? 'Saving...'
            : editing
              ? 'Save question'
              : 'Add question'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ApplicationQuestionManager({ listingId, token }) {
  const [questions, setQuestions] = useState([]);
  const [meta, setMeta] = useState({ locked: false, editable: false });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [formQuestion, setFormQuestion] = useState(null);

  const load = useCallback(
    async ({ signal, keepForm = true } = {}) => {
      try {
        const result = await listLandlordApplicationQuestions(
          token,
          listingId,
          {
            signal,
          },
        );
        setQuestions(result.questions);
        setMeta(result.meta);
        setMessage('');
        if (!keepForm || !result.meta.editable) setFormQuestion(null);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load application questions. Try again.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [listingId, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  async function remove(question) {
    if (!globalThis.confirm(`Delete “${question.question_text}”?`)) return;
    setMessage('');
    try {
      await deleteApplicationQuestion(token, listingId, question.id);
      await load({ keepForm: false });
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The application question could not be deleted.',
      );
      if (
        error instanceof ApiError &&
        error.code === 'APPLICATION_QUESTIONS_LOCKED'
      ) {
        await load({ keepForm: false });
      }
    }
  }

  return (
    <section className="question-manager" aria-labelledby="questions-title">
      <div className="question-manager-heading">
        <div>
          <h2 id="questions-title">Application questions</h2>
          <p>
            Add questions tenants will answer when applications are introduced.
          </p>
        </div>
        {meta.editable && formQuestion === null ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => setFormQuestion(emptyQuestion())}
          >
            Add question
          </button>
        ) : null}
      </div>

      {meta.locked ? (
        <p className="locked-notice" role="status">
          Application questions are locked because applications have already
          been submitted.
        </p>
      ) : null}
      {!meta.locked && !meta.editable && !loading ? (
        <p className="locked-notice" role="status">
          Application questions are read-only for this listing status.
        </p>
      ) : null}
      {loading ? (
        <p aria-live="polite">Loading application questions...</p>
      ) : null}
      {message ? (
        <div className="question-load-error" role="alert">
          <p>{message}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => load()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !message && questions.length === 0 ? (
        <p>No application questions yet.</p>
      ) : null}
      {questions.length ? (
        <ol className="question-list">
          {questions.map((question) => (
            <li key={question.id} className="question-card">
              <div>
                <p className="question-card-text">{question.question_text}</p>
                <p className="question-card-meta">
                  {question.question_type} · Order {question.display_order} ·{' '}
                  {question.is_required ? 'Required' : 'Optional'}
                </p>
                {question.options.length ? (
                  <ul>
                    {question.options.map((option) => (
                      <li key={option.id}>
                        {option.option_text} (order {option.display_order})
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {meta.editable ? (
                <div className="question-card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setFormQuestion(question)}
                  >
                    Edit
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => remove(question)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {formQuestion ? (
        <QuestionForm
          key={formQuestion.id ?? 'new'}
          initial={formQuestion.id ? formQuestion : null}
          listingId={listingId}
          token={token}
          onCancel={() => setFormQuestion(null)}
          onSaved={async (options) => {
            await load(options);
            setFormQuestion(null);
          }}
        />
      ) : null}
    </section>
  );
}
