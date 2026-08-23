import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicHeader from '../../components/public/PublicHeader.jsx';
import ApplicationQuestionFields from '../../components/application/ApplicationQuestionFields.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  createApplicationDraft,
  getApplicationAnswers,
  putApplicationAnswers,
  submitApplication,
  updateApplicationDraft,
} from '../../services/applicationService.js';
import { listPublicApplicationQuestions } from '../../services/applicationQuestionService.js';

const emptyForm = {
  move_in_date: '',
  requested_lease_duration_months: '',
  number_of_occupants: '',
  introductory_message: '',
};

function formFrom(application) {
  return {
    move_in_date: application.move_in_date ?? '',
    requested_lease_duration_months:
      application.requested_lease_duration_months?.toString() ?? '',
    number_of_occupants: application.number_of_occupants?.toString() ?? '',
    introductory_message: application.introductory_message ?? '',
  };
}

function positiveInteger(value, label, errors) {
  if (value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    errors.push(`${label} must be a positive whole number.`);
    return null;
  }
  return number;
}

function payloadFrom(form) {
  const errors = [];
  const lease = positiveInteger(
    form.requested_lease_duration_months,
    'Lease duration',
    errors,
  );
  const occupants = positiveInteger(
    form.number_of_occupants,
    'Number of occupants',
    errors,
  );
  if (form.introductory_message.trim().length > 2000) {
    errors.push('Introduction must be 2,000 characters or fewer.');
  }
  return {
    errors,
    payload: {
      move_in_date: form.move_in_date || null,
      requested_lease_duration_months: lease,
      number_of_occupants: occupants,
      introductory_message: form.introductory_message.trim() || null,
    },
  };
}

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function validateAnswers(questions, values) {
  const errors = {};
  for (const question of questions) {
    const value = (values[question.id] ?? '').trim();
    if (!value) continue;
    if (question.question_type === 'TEXT' && value.length > 2000) {
      errors[question.id] = 'Answer must be 2,000 characters or fewer.';
    }
    if (
      question.question_type === 'NUMBER' &&
      (!NUMBER_PATTERN.test(value) || !Number.isFinite(Number(value)))
    ) {
      errors[question.id] = 'Enter a valid finite number.';
    }
    if (
      question.question_type === 'BOOLEAN' &&
      value !== 'true' &&
      value !== 'false'
    ) {
      errors[question.id] = 'Choose Yes or No.';
    }
    if (
      question.question_type === 'DATE' &&
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      errors[question.id] = 'Enter a valid date.';
    }
    if (
      question.question_type === 'SELECT' &&
      !question.options.some((option) => option.option_text === value)
    ) {
      errors[question.id] = 'Choose a current option.';
    }
  }
  return errors;
}

function answerValues(questions, answers) {
  const stored = new Map(
    answers.map((answer) => [answer.question_id, answer.answer_text]),
  );
  return Object.fromEntries(
    questions.map((question) => [question.id, stored.get(question.id) ?? '']),
  );
}

export default function ApplicationDraftPage() {
  const { listingId } = useParams();
  const { session } = useAuth();
  const [application, setApplication] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [answerErrors, setAnswerErrors] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setMessage('');
    async function initialize() {
      try {
        const result = await createApplicationDraft(
          session.access_token,
          listingId,
          {},
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setApplication(result.application);
        setForm(formFrom(result.application));
        setEditable(Boolean(result.meta.editable));
        if (!result.meta.listing_available) {
          setQuestions([]);
          setAnswers({});
          setMessage(
            'This rental is no longer accepting application changes. Your draft has been preserved.',
          );
          return;
        }

        const [currentQuestions, currentAnswers] = await Promise.all([
          listPublicApplicationQuestions(listingId, {
            signal: controller.signal,
          }),
          getApplicationAnswers(session.access_token, result.application.id, {
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted) return;
        setQuestions(currentQuestions);
        setAnswers(answerValues(currentQuestions, currentAnswers));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setLoadError(true);
        setMessage(
          error instanceof ApiError && error.code === 'LISTING_NOT_FOUND'
            ? 'This rental is no longer available and no new draft can be created.'
            : error instanceof ApiError &&
                error.code === 'APPLICATION_ALREADY_EXISTS'
              ? 'An application already exists and is no longer an editable draft.'
              : 'We could not load your application draft. Try again.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void initialize();
    return () => controller.abort();
  }, [listingId, session.access_token]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setAnswerErrors((current) => ({ ...current, [questionId]: undefined }));
  }

  async function persistDraft() {
    const { errors, payload } = payloadFrom(form);
    const nextAnswerErrors = validateAnswers(questions, answers);
    setAnswerErrors(nextAnswerErrors);
    if (errors.length) {
      setMessage(errors.join(' '));
      return false;
    }
    if (Object.keys(nextAnswerErrors).length) {
      setMessage('Check the highlighted application answers.');
      return false;
    }
    setSaving(true);
    setMessage('');
    let basicDetailsSaved = false;
    try {
      const result = await updateApplicationDraft(
        session.access_token,
        application.id,
        payload,
      );
      setApplication(result.application);
      setForm(formFrom(result.application));
      setEditable(Boolean(result.meta.editable));
      basicDetailsSaved = true;
      const savedAnswers = await putApplicationAnswers(
        session.access_token,
        application.id,
        questions.map((question) => ({
          question_id: question.id,
          answer_text: answers[question.id]?.trim() || null,
        })),
      );
      setAnswers(answerValues(questions, savedAnswers));
      setMessage('Draft and answers saved. They have not been submitted.');
      return true;
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'LISTING_NOT_AVAILABLE' ||
          error.code === 'APPLICATION_NOT_EDITABLE')
      ) {
        setEditable(false);
        setMessage(
          basicDetailsSaved
            ? 'Your basic details were saved, but answers were not saved because this rental is no longer accepting changes.'
            : error.code === 'LISTING_NOT_AVAILABLE'
              ? 'This rental is no longer accepting application changes. Your draft has been preserved.'
              : 'This application is no longer editable.',
        );
      } else {
        setMessage(
          basicDetailsSaved
            ? 'Your basic details were saved, but application answers were not saved. Try again.'
            : error instanceof ApiError
              ? error.message
              : 'Your draft could not be saved. Try again.',
        );
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    await persistDraft();
  }

  async function reviewApplication() {
    const missingCore = [
      ['move_in_date', form.move_in_date, 'Preferred move-in date'],
      [
        'requested_lease_duration_months',
        form.requested_lease_duration_months,
        'Requested lease duration',
      ],
      ['number_of_occupants', form.number_of_occupants, 'Number of occupants'],
    ].filter(([, value]) => !value);
    const missingQuestions = questions.filter(
      (question) => question.is_required && !answers[question.id]?.trim(),
    );
    if (missingCore.length || missingQuestions.length) {
      setAnswerErrors(
        Object.fromEntries(
          missingQuestions.map((question) => [
            question.id,
            'Answer this required question before submitting.',
          ]),
        ),
      );
      const details = [
        ...missingCore.map(([, , label]) => label),
        ...missingQuestions.map((question) => question.question_text),
      ];
      setMessage(`Complete these required items: ${details.join(', ')}.`);
      return;
    }
    if (await persistDraft()) {
      setReviewing(true);
      setMessage('');
      globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  }

  async function confirmSubmission() {
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const result = await submitApplication(
        session.access_token,
        application.id,
      );
      setApplication(result.application);
      setSubmitted(result.application);
      setEditable(false);
      setReviewing(false);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'APPLICATION_INCOMPLETE'
      ) {
        const fields = error.fields ?? {};
        setAnswerErrors(
          Object.fromEntries(
            [
              ...(fields.missing_question_ids ?? []),
              ...(fields.invalid_question_ids ?? []),
            ].map((id) => [id, 'Review this answer before submitting.']),
          ),
        );
        setReviewing(false);
        setMessage(
          'The application changed while you were reviewing it. Complete the highlighted items and review again.',
        );
      } else if (
        error instanceof ApiError &&
        error.code === 'LISTING_NOT_AVAILABLE'
      ) {
        setEditable(false);
        setReviewing(false);
        setMessage(
          'This rental stopped accepting applications before submission. Your draft remains saved.',
        );
      } else {
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'Your application could not be submitted. Try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function displayAnswer(question) {
    const value = answers[question.id]?.trim();
    if (!value) return 'Not answered (optional)';
    if (question.question_type === 'BOOLEAN') {
      return value === 'true' ? 'Yes' : 'No';
    }
    return value;
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="application-draft-shell">
        <Link className="public-back-link" to={`/listings/${listingId}`}>
          Back to rental
        </Link>
        <header className="application-draft-heading">
          <div>
            <p className="status-badge">Draft</p>
            <h1>Rental application</h1>
          </div>
          <p>
            Save your basic application details here. This draft is private to
            your tenant account and is not submitted.
          </p>
        </header>

        {loading ? (
          <p aria-live="polite">Preparing your application draft...</p>
        ) : null}
        {!loading && loadError ? (
          <section className="public-state" role="alert">
            <h2>Draft unavailable</h2>
            <p>{message}</p>
            <Link className="primary-link-button" to="/listings">
              Browse available rentals
            </Link>
          </section>
        ) : null}
        {!loading && submitted ? (
          <section className="application-submitted" role="status">
            <p className="status-badge">Submitted</p>
            <h2>Application submitted</h2>
            <p>
              Your application was submitted on{' '}
              <time dateTime={submitted.submitted_at}>
                {new Date(submitted.submitted_at).toLocaleString()}
              </time>
              . It can no longer be edited.
            </p>
            <Link className="primary-link-button" to={`/listings/${listingId}`}>
              Return to rental
            </Link>
          </section>
        ) : null}
        {!loading && application && reviewing ? (
          <section
            className="application-review"
            aria-labelledby="review-title"
          >
            <p className="status-badge">Final review</p>
            <h2 id="review-title">Review your application</h2>
            <dl className="application-review-list">
              <div>
                <dt>Move-in date</dt>
                <dd>{form.move_in_date}</dd>
              </div>
              <div>
                <dt>Lease duration</dt>
                <dd>{form.requested_lease_duration_months} months</dd>
              </div>
              <div>
                <dt>Occupants</dt>
                <dd>{form.number_of_occupants}</dd>
              </div>
              <div>
                <dt>Introduction</dt>
                <dd>{form.introductory_message || 'Not provided'}</dd>
              </div>
              {questions.map((question) => (
                <div key={question.id}>
                  <dt>{question.question_text}</dt>
                  <dd>{displayAnswer(question)}</dd>
                </div>
              ))}
            </dl>
            <div className="application-review-warning" role="note">
              Submission is final. You will not be able to edit this application
              or its answers afterward.
            </div>
            <div className="application-review-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={submitting}
                onClick={() => setReviewing(false)}
              >
                Back to edit
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={submitting}
                onClick={confirmSubmission}
              >
                {submitting
                  ? 'Submitting application...'
                  : 'Submit application'}
              </button>
            </div>
            {message ? (
              <p className="form-message" role="alert">
                {message}
              </p>
            ) : null}
          </section>
        ) : null}
        {!loading && application && !reviewing && !submitted ? (
          <form className="auth-form application-draft-form" onSubmit={save}>
            {!editable ? (
              <div className="draft-unavailable" role="status">
                <strong>Editing unavailable</strong>
                <p>{message}</p>
              </div>
            ) : null}
            <label htmlFor="move-in-date">Preferred move-in date</label>
            <input
              id="move-in-date"
              name="move_in_date"
              type="date"
              value={form.move_in_date}
              onChange={updateField}
              disabled={!editable || saving || submitting}
            />

            <label htmlFor="lease-duration">
              Requested lease duration (months)
            </label>
            <input
              id="lease-duration"
              name="requested_lease_duration_months"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.requested_lease_duration_months}
              onChange={updateField}
              disabled={!editable || saving || submitting}
            />

            <label htmlFor="occupants">Number of occupants</label>
            <input
              id="occupants"
              name="number_of_occupants"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.number_of_occupants}
              onChange={updateField}
              disabled={!editable || saving || submitting}
            />

            <label htmlFor="introduction">Brief introduction</label>
            <textarea
              id="introduction"
              name="introductory_message"
              rows="6"
              maxLength="2000"
              value={form.introductory_message}
              onChange={updateField}
              disabled={!editable || saving || submitting}
              aria-describedby="introduction-help"
            />
            <p id="introduction-help" className="field-hint">
              Optional, up to 2,000 characters.
            </p>

            <ApplicationQuestionFields
              questions={questions}
              values={answers}
              errors={answerErrors}
              onChange={updateAnswer}
              disabled={!editable || saving || submitting}
            />

            {editable ? (
              <div className="application-draft-actions">
                <button
                  className="secondary-button"
                  type="submit"
                  disabled={saving || submitting}
                >
                  {saving ? 'Saving draft...' : 'Save draft'}
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={saving || submitting}
                  onClick={reviewApplication}
                >
                  {saving ? 'Saving draft...' : 'Review application'}
                </button>
              </div>
            ) : null}
            {message && editable ? (
              <p className="form-message" role="status">
                {message}
              </p>
            ) : null}
          </form>
        ) : null}
      </main>
    </div>
  );
}
