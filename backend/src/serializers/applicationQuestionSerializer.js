function orderedOptions(options = []) {
  return [...options]
    .sort(
      (left, right) =>
        left.display_order - right.display_order ||
        left.id.localeCompare(right.id),
    )
    .map((option) => ({
      id: option.id,
      option_text: option.option_text,
      display_order: option.display_order,
    }));
}

export function serializeApplicationQuestion(question) {
  return {
    id: question.id,
    question_text: question.question_text,
    question_type: question.question_type,
    is_required: question.is_required,
    display_order: question.display_order,
    options:
      question.question_type === 'SELECT'
        ? orderedOptions(question.options)
        : [],
  };
}

export function serializeApplicationQuestions(questions) {
  return [...questions]
    .sort(
      (left, right) =>
        left.display_order - right.display_order ||
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    )
    .map(serializeApplicationQuestion);
}
