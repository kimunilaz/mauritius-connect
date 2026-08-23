import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const ANSWER_COLUMNS = [
  'id',
  'application_id',
  'question_id',
  'answer_text',
  'created_at',
  'updated_at',
].join(',');

const ANSWER_WITH_QUESTION = [
  ANSWER_COLUMNS,
  'question:application_questions!inner(id,listing_id,question_text,question_type,is_required,display_order,created_at)',
].join(',');

const DRAFT_ANSWER_PROJECTION = [
  ANSWER_COLUMNS,
  'application:applications!inner(status,submitted_at)',
].join(',');

export class ApplicationAnswerRepositoryError extends Error {
  constructor(reason) {
    super('The application answer repository operation failed.');
    this.name = 'ApplicationAnswerRepositoryError';
    this.reason = reason;
  }
}

function failure(reason) {
  return new ApplicationAnswerRepositoryError(reason);
}

export const applicationAnswerRepository = {
  async listForApplication(applicationId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_answers')
      .select(ANSWER_WITH_QUESTION)
      .eq('application_id', applicationId);
    if (error) throw failure('READ_FAILED');
    return data ?? [];
  },

  async upsertForApplication(applicationId, answers) {
    if (!answers.length) return [];
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_answers')
      .upsert(
        answers.map((answer) => ({
          application_id: applicationId,
          question_id: answer.question_id,
          answer_text: answer.answer_text,
        })),
        { onConflict: 'application_id,question_id' },
      )
      .select(ANSWER_COLUMNS);
    if (error) throw failure('WRITE_FAILED');
    return data ?? [];
  },

  async deleteForApplicationQuestions(applicationId, questionIds) {
    if (!questionIds.length) return;
    const { error } = await getPrivilegedSupabaseClient()
      .from('application_answers')
      .delete()
      .eq('application_id', applicationId)
      .in('question_id', questionIds);
    if (error) throw failure('WRITE_FAILED');
  },

  async listDraftForQuestion(questionId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_answers')
      .select(DRAFT_ANSWER_PROJECTION)
      .eq('question_id', questionId)
      .eq('application.status', 'DRAFT')
      .is('application.submitted_at', null);
    if (error) throw failure('READ_FAILED');
    return (data ?? []).map(
      ({ application: _application, ...answer }) => answer,
    );
  },

  async deleteByIds(answerIds) {
    if (!answerIds.length) return;
    const { error } = await getPrivilegedSupabaseClient()
      .from('application_answers')
      .delete()
      .in('id', answerIds);
    if (error) throw failure('WRITE_FAILED');
  },

  async restore(records) {
    if (!records.length) return;
    const { error } = await getPrivilegedSupabaseClient()
      .from('application_answers')
      .upsert(
        records.map(
          ({
            id,
            application_id,
            question_id,
            answer_text,
            created_at,
            updated_at,
          }) => ({
            id,
            application_id,
            question_id,
            answer_text,
            created_at,
            updated_at,
          }),
        ),
        { onConflict: 'application_id,question_id' },
      );
    if (error) throw failure('WRITE_FAILED');
  },
};
