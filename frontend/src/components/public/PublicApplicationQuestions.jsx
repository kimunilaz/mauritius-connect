import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient.js';
import { listPublicApplicationQuestions } from '../../services/applicationQuestionService.js';

export default function PublicApplicationQuestions({ listingId }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    listPublicApplicationQuestions(listingId, { signal: controller.signal })
      .then(setQuestions)
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setMessage(
          error instanceof ApiError && error.status === 404
            ? ''
            : "Application questions couldn't be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [listingId]);

  if (loading)
    return <p aria-live="polite">Loading application questions...</p>;
  if (message) {
    return (
      <p className="form-message" role="status">
        {message}
      </p>
    );
  }
  if (!questions.length) return null;

  return (
    <section
      className="public-questions"
      aria-labelledby="public-questions-title"
    >
      <h2 id="public-questions-title">Application questions</h2>
      <p>These questions will be part of this rental’s application.</p>
      <ol>
        {questions.map((question) => (
          <li key={question.id}>
            <p>
              {question.question_text}{' '}
              <span>{question.is_required ? '(Required)' : '(Optional)'}</span>
            </p>
            <p className="question-card-meta">
              Answer type: {question.question_type}
            </p>
            {question.options.length ? (
              <ul>
                {question.options.map((option) => (
                  <li key={option.id}>{option.option_text}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
