export function serializeApplicationAnswer(answer) {
  return {
    question_id: answer.question_id,
    answer_text: answer.answer_text,
    updated_at: answer.updated_at,
  };
}

export function serializeApplicationAnswers(answers) {
  return [...answers]
    .sort(
      (left, right) =>
        left.question.display_order - right.question.display_order ||
        left.question.created_at.localeCompare(right.question.created_at) ||
        left.question_id.localeCompare(right.question_id),
    )
    .map(serializeApplicationAnswer);
}
