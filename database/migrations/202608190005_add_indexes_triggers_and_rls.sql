-- Required lookup and foreign-key indexes. Unique constraints already cover
-- tenant_profiles.user_id, landlord_profiles.user_id,
-- application_answers(application_id, question_id), and
-- conversations(listing_id, tenant_user_id, landlord_user_id).
create index profiles_role_idx on public.profiles (role);
create index tenant_preferred_locations_tenant_profile_id_idx
  on public.tenant_preferred_locations (tenant_profile_id);

create index properties_landlord_id_idx on public.properties (landlord_id);
create index properties_district_locality_idx
  on public.properties (district, locality);
create index property_images_property_id_idx
  on public.property_images (property_id);

create index listings_property_id_idx on public.listings (property_id);
create index listings_status_idx on public.listings (status);
create index listings_available_from_idx on public.listings (available_from);
create index listings_monthly_rent_idx on public.listings (monthly_rent);
create index saved_listings_listing_id_idx on public.saved_listings (listing_id);

create index application_questions_listing_id_idx
  on public.application_questions (listing_id);
create index application_question_options_question_id_idx
  on public.application_question_options (question_id);
create index applications_listing_id_idx on public.applications (listing_id);
create index applications_tenant_id_idx on public.applications (tenant_id);
create index applications_listing_id_status_idx
  on public.applications (listing_id, status);
create index application_answers_question_id_idx
  on public.application_answers (question_id);
create index application_status_history_application_id_idx
  on public.application_status_history (application_id);
create index viewings_application_id_idx on public.viewings (application_id);

create index conversations_tenant_user_id_idx
  on public.conversations (tenant_user_id);
create index conversations_landlord_user_id_idx
  on public.conversations (landlord_user_id);
create index conversation_participants_user_id_idx
  on public.conversation_participants (user_id);
create index messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);
create index messages_sender_user_id_idx on public.messages (sender_user_id);

create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_id_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create index reports_reporter_user_id_idx on public.reports (reporter_user_id);
create index reports_reported_user_id_idx on public.reports (reported_user_id);
create index reports_listing_id_idx on public.reports (listing_id);
create index verification_records_subject_idx
  on public.verification_records (subject_type, subject_id);
create index verification_records_reviewed_by_user_id_idx
  on public.verification_records (reviewed_by_user_id);
create index admin_audit_logs_admin_user_id_created_at_idx
  on public.admin_audit_logs (admin_user_id, created_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger tenant_profiles_set_updated_at
before update on public.tenant_profiles
for each row execute function public.set_updated_at();

create trigger landlord_profiles_set_updated_at
before update on public.landlord_profiles
for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create trigger application_questions_set_updated_at
before update on public.application_questions
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create trigger application_answers_set_updated_at
before update on public.application_answers
for each row execute function public.set_updated_at();

create trigger viewings_set_updated_at
before update on public.viewings
for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- No policies are created in TASK-001. With RLS enabled, publishable-key
-- clients have deny-by-default access until identity-aware policies are added.
alter table public.profiles enable row level security;
alter table public.tenant_profiles enable row level security;
alter table public.tenant_preferred_locations enable row level security;
alter table public.landlord_profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.listings enable row level security;
alter table public.saved_listings enable row level security;
alter table public.application_questions enable row level security;
alter table public.application_question_options enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.application_status_history enable row level security;
alter table public.viewings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.verification_records enable row level security;
alter table public.admin_audit_logs enable row level security;
