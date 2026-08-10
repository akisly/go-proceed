-- ===========================================================================
-- 0052 — A TAB IS NOT A SOURCE CITATION
--
-- WHAT WAS WRONG. Fifty-two CHECK constraints across twenty-two tables guard a
-- text column with `length(btrim(col)) > 0`, and every one of their comments
-- says what they are for. 0041:212-216 puts it plainest, about the column that
-- carries the ДБН citation behind a hidden-works obligation:
--
--     NOT NULL is not INV-073: '' and '   ' carry no source while satisfying
--     the column.
--
-- It is right about '' and '   ' and wrong about everything else, because
-- one-argument `btrim()` strips SPACES ONLY. A source_citation of E'\t\n' is
-- two characters long after btrim and satisfies the guard. So does a single
-- non-breaking space — the character a citation pasted out of Word arrives
-- with. The columns this admits are not incidental: source_citation,
-- item_text_uk and source_standard on the Додаток Н library; the return
-- `reason` a crew has to act on; the `correction_reason` on a superseding
-- closure and on a superseding act version; acceptance_criterion,
-- performer_role and approver_role on every requirement occurrence.
--
-- HOW IT WAS FOUND. m1-rules-schema.test.ts probes '', '   ' AND E'\t\n'
-- against requirement_library_items.source_citation. The third value was
-- stored, and the row it left behind then collided with the positive control
-- underneath it — two red assertions, one hole, and forty-six identical holes
-- nowhere near a test.
--
-- WHAT THIS DOES. Every one of the fifty-two constraints is dropped and re-added
-- with the character set spelled out: space, tab, LF, CR, FF, VT and U+00A0.
-- Nothing else about any of them changes — the compound ones keep their other
-- terms, the nullable ones keep their `IS NULL OR`, and the two-argument btrims
-- that were already explicit are left alone. This only TIGHTENS: a value that
-- satisfied a guard before and fails now is whitespace end to end, which is the
-- value each of these constraints was written to refuse.
--
-- The escapes are written rather than typed. A literal NBSP in a migration is
-- invisible in every diff it ever appears in.
--
-- ROLLBACK (dev only): re-run the same statements with `btrim(col)` in place of
-- `btrim(col, E' \t\n\r\f\v\u00A0')`. There is no data migration either way.
-- ===========================================================================

alter table public.blocked_reasons
  drop constraint blocked_reasons_code_vocabulary_version_check,
  add constraint blocked_reasons_code_vocabulary_version_check check ((length(btrim(code_vocabulary_version, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.contracts
  drop constraint contracts_contract_no_check,
  add constraint contracts_contract_no_check check ((length(btrim(contract_no, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.external_access_grants
  drop constraint external_access_grants_hmac_key_id_check,
  add constraint external_access_grants_hmac_key_id_check check ((length(btrim(hmac_key_id, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.external_access_grants
  drop constraint external_access_grants_recipient_email_check,
  add constraint external_access_grants_recipient_email_check check ((((length(btrim(recipient_email, E' \t\n\r\f\v\u00A0')) >= 3) AND (length(btrim(recipient_email, E' \t\n\r\f\v\u00A0')) <= 320)) AND (recipient_email = lower(recipient_email)) AND (recipient_email ~~ '%@%'::text)));

alter table public.external_access_grants
  drop constraint external_access_grants_recipient_role_check,
  add constraint external_access_grants_recipient_role_check check ((length(btrim(recipient_role, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.external_decision_batches
  drop constraint external_decision_batches_confirmation_text_version_check,
  add constraint external_decision_batches_confirmation_text_version_check check ((length(btrim(confirmation_text_version, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.external_decision_batches
  drop constraint external_decision_batches_idempotency_key_check,
  add constraint external_decision_batches_idempotency_key_check check ((length(btrim(idempotency_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.external_sessions
  drop constraint external_sessions_verifier_key_id_check,
  add constraint external_sessions_verifier_key_id_check check ((length(btrim(verifier_key_id, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.import_files
  drop constraint import_files_filename_check,
  add constraint import_files_filename_check check ((length(btrim(filename, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.locations
  drop constraint locations_name_check,
  add constraint locations_name_check check ((length(btrim(name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.parties
  drop constraint parties_display_name_check,
  add constraint parties_display_name_check check ((length(btrim(display_name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.party_contacts
  drop constraint party_contacts_full_name_check,
  add constraint party_contacts_full_name_check check ((length(btrim(full_name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.party_legal_profiles
  drop constraint party_legal_profiles_official_name_check,
  add constraint party_legal_profiles_official_name_check check ((length(btrim(official_name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.projects
  drop constraint projects_name_check,
  add constraint projects_name_check check ((length(btrim(name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.readiness_projection
  drop constraint readiness_projection_scope_kind_check,
  add constraint readiness_projection_scope_kind_check check ((length(btrim(scope_kind, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_evidence_decisions
  drop constraint requirement_evidence_decisions_approver_role_check,
  add constraint requirement_evidence_decisions_approver_role_check check ((length(btrim(approver_role, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_evidence_decisions
  drop constraint requirement_evidence_decisions_idempotency_key_check,
  add constraint requirement_evidence_decisions_idempotency_key_check check ((length(btrim(idempotency_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_evidence_decisions
  drop constraint requirement_evidence_decisions_return_reason_check,
  add constraint requirement_evidence_decisions_return_reason_check check (((outcome <> 'returned'::text) OR (length(btrim(COALESCE(reason, ''::text), E' \t\n\r\f\v\u00A0')) > 0)));

alter table public.requirement_exceptions
  drop constraint requirement_exceptions_idempotency_key_check,
  add constraint requirement_exceptions_idempotency_key_check check ((length(btrim(idempotency_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_exceptions
  drop constraint requirement_exceptions_reason_check,
  add constraint requirement_exceptions_reason_check check ((length(btrim(reason, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_library_items
  drop constraint requirement_library_items_item_text_uk_check,
  add constraint requirement_library_items_item_text_uk_check check ((length(btrim(item_text_uk, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_library_items
  drop constraint requirement_library_items_position_title_uk_check,
  add constraint requirement_library_items_position_title_uk_check check ((length(btrim(position_title_uk, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_library_items
  drop constraint requirement_library_items_source_citation_check,
  add constraint requirement_library_items_source_citation_check check ((length(btrim(source_citation, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_library_items
  drop constraint requirement_library_items_source_standard_check,
  add constraint requirement_library_items_source_standard_check check ((length(btrim(source_standard, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_acceptance_criterion_check,
  add constraint requirement_occurrences_acceptance_criterion_check check ((length(btrim(acceptance_criterion, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_approver_role_check,
  add constraint requirement_occurrences_approver_role_check check ((length(btrim(approver_role, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_norm_ref_sourced_check,
  add constraint requirement_occurrences_norm_ref_sourced_check check (((norm_ref IS NULL) OR ((norm_ref_verification IS NOT NULL) AND (length(btrim(COALESCE(norm_ref_source, ''::text), E' \t\n\r\f\v\u00A0')) > 0))));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_performer_role_check,
  add constraint requirement_occurrences_performer_role_check check ((length(btrim(performer_role, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_stage_key_check,
  add constraint requirement_occurrences_stage_key_check check ((length(btrim(stage_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_acceptance_criterion_check,
  add constraint requirement_rule_versions_acceptance_criterion_check check ((length(btrim(acceptance_criterion, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_approver_role_check,
  add constraint requirement_rule_versions_approver_role_check check ((length(btrim(approver_role, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_norm_ref_sourced_check,
  add constraint requirement_rule_versions_norm_ref_sourced_check check (((norm_ref IS NULL) OR ((norm_ref_verification IS NOT NULL) AND (length(btrim(COALESCE(norm_ref_source, ''::text), E' \t\n\r\f\v\u00A0')) > 0))));

alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_performer_role_check,
  add constraint requirement_rule_versions_performer_role_check check ((length(btrim(performer_role, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_stage_key_check,
  add constraint requirement_rule_versions_stage_key_check check ((length(btrim(stage_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_work_type_key_check,
  add constraint requirement_rule_versions_work_type_key_check check ((length(btrim(work_type_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.requirement_template_versions
  drop constraint requirement_template_versions_template_key_check,
  add constraint requirement_template_versions_template_key_check check ((length(btrim(template_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.source_amount_resolutions
  drop constraint source_amount_resolutions_reason_check,
  add constraint source_amount_resolutions_reason_check check ((length(btrim(reason, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.stage_closures
  drop constraint stage_closures_correction_reason_check,
  add constraint stage_closures_correction_reason_check check (((predecessor_closure_id IS NULL) OR (length(btrim(COALESCE(correction_reason, ''::text), E' \t\n\r\f\v\u00A0')) > 0)));

alter table public.stage_closures
  drop constraint stage_closures_idempotency_key_check,
  add constraint stage_closures_idempotency_key_check check ((length(btrim(idempotency_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_version_signatories
  drop constraint statutory_act_version_signatories_frozen_person_name_check,
  add constraint statutory_act_version_signatories_frozen_person_name_check check ((length(btrim(frozen_person_name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_version_signatories
  drop constraint statutory_act_version_signatories_org_name_check,
  add constraint statutory_act_version_signatories_org_name_check check ((length(btrim(frozen_organization_name, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_correction_reason_check,
  add constraint statutory_act_versions_correction_reason_check check (((predecessor_version_id IS NULL) OR (length(btrim(COALESCE(correction_reason, ''::text), E' \t\n\r\f\v\u00A0')) > 0)));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_form_citation_check,
  add constraint statutory_act_versions_form_citation_check check ((length(btrim(form_citation, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_form_citation_source_check,
  add constraint statutory_act_versions_form_citation_source_check check ((length(btrim(form_citation_source, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_form_template_key_check,
  add constraint statutory_act_versions_form_template_key_check check ((length(btrim(form_template_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_form_template_version_check,
  add constraint statutory_act_versions_form_template_version_check check ((length(btrim(form_template_version, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_idempotency_key_check,
  add constraint statutory_act_versions_idempotency_key_check check ((length(btrim(idempotency_key, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.statutory_act_versions
  drop constraint statutory_act_versions_renderer_version_check,
  add constraint statutory_act_versions_renderer_version_check check (((renderer_version IS NULL) OR (length(btrim(renderer_version, E' \t\n\r\f\v\u00A0')) > 0)));

alter table public.unit_definitions
  drop constraint unit_definitions_code_check,
  add constraint unit_definitions_code_check check ((length(btrim(code, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.work_items
  drop constraint work_items_description_check,
  add constraint work_items_description_check check ((length(btrim(description, E' \t\n\r\f\v\u00A0')) > 0));

alter table public.work_items
  drop constraint work_items_work_type_key_shape_check,
  add constraint work_items_work_type_key_shape_check check (((work_type_key IS NULL) OR ((work_type_key = btrim(work_type_key, E' \t\n\r\f\v\u00A0')) AND (length(work_type_key) > 0))));

alter table public.work_stages
  drop constraint work_stages_stage_key_check,
  add constraint work_stages_stage_key_check check ((length(btrim(stage_key, E' \t\n\r\f\v\u00A0')) > 0));
