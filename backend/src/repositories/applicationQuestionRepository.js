import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const QUESTION_COLUMNS = [
  'id',
  'listing_id',
  'question_text',
  'question_type',
  'is_required',
  'display_order',
  'created_at',
  'updated_at',
].join(',');

const OPTION_COLUMNS = [
  'id',
  'question_id',
  'option_text',
  'display_order',
].join(',');
const WITH_OPTIONS = `${QUESTION_COLUMNS},options:application_question_options(${OPTION_COLUMNS})`;

export class ApplicationQuestionRepositoryError extends Error {
  constructor(reason) {
    super('The application question repository operation failed.');
    this.name = 'ApplicationQuestionRepositoryError';
    this.reason = reason;
  }
}

function failure(reason) {
  return new ApplicationQuestionRepositoryError(reason);
}

export const applicationQuestionRepository = {
  async mutateQuestion({
    operation,
    listingId,
    questionId = null,
    actorUserId,
    payload = {},
  }) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'mutate_application_question_transaction',
      {
        p_operation: operation,
        p_listing_id: listingId,
        p_question_id: questionId,
        p_actor_user_id: actorUserId,
        p_payload: payload,
      },
    );
    if (error) throw failure('WRITE_FAILED');
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw failure('NO_RESULT');
    return result;
  },

  async listForListing(listingId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_questions')
      .select(WITH_OPTIONS)
      .eq('listing_id', listingId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw failure('READ_FAILED');
    return data ?? [];
  },

  async findForListing(listingId, questionId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_questions')
      .select(WITH_OPTIONS)
      .eq('listing_id', listingId)
      .eq('id', questionId)
      .maybeSingle();
    if (error) throw failure('READ_FAILED');
    return data;
  },

  async hasSubmittedApplication(listingId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('applications')
      .select('id')
      .eq('listing_id', listingId)
      .not('submitted_at', 'is', null)
      .limit(1)
      .maybeSingle();
    if (error) throw failure('READ_FAILED');
    return Boolean(data);
  },

  async createQuestion(fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_questions')
      .insert(fields)
      .select(QUESTION_COLUMNS)
      .single();
    if (error || !data) throw failure('WRITE_FAILED');
    return data;
  },

  async updateQuestion(listingId, questionId, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_questions')
      .update(fields)
      .eq('listing_id', listingId)
      .eq('id', questionId)
      .select(QUESTION_COLUMNS)
      .maybeSingle();
    if (error) throw failure('WRITE_FAILED');
    return data;
  },

  async deleteQuestion(listingId, questionId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_questions')
      .delete()
      .eq('listing_id', listingId)
      .eq('id', questionId)
      .select('id')
      .maybeSingle();
    if (error) throw failure('WRITE_FAILED');
    return Boolean(data);
  },

  async createOptions(questionId, options) {
    if (!options.length) return [];
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_question_options')
      .insert(options.map((option) => ({ question_id: questionId, ...option })))
      .select(OPTION_COLUMNS);
    if (error) throw failure('WRITE_FAILED');
    return data ?? [];
  },

  async deleteOptions(questionId) {
    const { error } = await getPrivilegedSupabaseClient()
      .from('application_question_options')
      .delete()
      .eq('question_id', questionId);
    if (error) throw failure('WRITE_FAILED');
  },
};
