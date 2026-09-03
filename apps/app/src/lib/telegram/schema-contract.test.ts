import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "../../technical/database/schema-v0.1.sql"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/0071_telegram_evidence_claim_fences.sql"), "utf8");
const lockOrderMigration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/0072_telegram_evidence_lock_order.sql"), "utf8");
const evidence = readFileSync(resolve(process.cwd(), "src/lib/telegram/evidence.ts"), "utf8");
const processor = readFileSync(resolve(process.cwd(), "src/lib/telegram/processor.ts"), "utf8");

describe("Telegram evidence canonical schema contract", () => {
  it("keeps the decision-attempt membership FK aligned with the canonical membership key", () => {
    const memberships = schema.slice(
      schema.indexOf("create table public.memberships ("),
      schema.indexOf("create table public.invitations ("),
    );
    const attempts = schema.slice(
      schema.indexOf("create table public.telegram_evidence_decision_attempts ("),
      schema.indexOf("create index telegram_evidence_decision_attempts_due_idx"),
    );

    expect(memberships).toContain("unique (workspace_id, id)");
    expect(attempts).toContain(
      "foreign key (workspace_id,actor_member_id) references public.memberships(workspace_id,id)",
    );
  });

  it("keeps runtime message receipt metadata immutable in the canonical guard", () => {
    for (const column of [
      "telegram_reply_markup", "telegram_occurrence_snapshot", "telegram_evidence_receipt_key",
      "telegram_evidence_copy_key", "telegram_evidence_source_attachment_id",
      "telegram_evidence_source_media_group_id", "telegram_evidence_generation",
      "telegram_evidence_chunk_index", "telegram_evidence_recipient_member_id",
      "created_at",
    ]) expect(schema).toContain(`old.${column} is distinct from new.${column}`);
  });

  it("keeps album and attachment recovery columns and checks in canonical DDL", () => {
    for (const fragment of [
      "uploader_member_id uuid", "created_at timestamptz not null", "completed_at timestamptz",
      "processing_generation bigint not null default 0",
      "check (state <> 'processing' or processing_lease_token is not null)",
      "filename_snapshot text", "media_type_snapshot text", "byte_size bigint",
      "retry_disposition text", "provider_retry_attempts integer not null default 0",
      "provider_retry_lease_token uuid",
    ]) expect(schema).toContain(fragment);
  });

  it("keeps every service mutation behind unexpired attachment and album ownership", () => {
    expect(migration).toContain("a.provider_retry_lease_token=p_attachment_lease_token");
    expect(migration).toContain("a.provider_retry_lease_expires_at > now()");
    expect(migration).toContain("g.processing_lease_token=p_group_lease_token");
    expect(migration).toContain("g.processing_lease_expires_at > now()");
    expect(migration).toContain("g.revoked_at is null and g.valid_from <= now()");
  });

  it("locks an album before its attachment in every settlement mutation", () => {
    const settlement = lockOrderMigration.slice(
      lockOrderMigration.indexOf("create or replace function app.settle_telegram_evidence_attachment"),
      lockOrderMigration.indexOf("create function app.terminalize_telegram_media_group_staged"),
    );
    expect(settlement.indexOf("from public.telegram_media_groups where id=p_group_id for update"))
      .toBeLessThan(settlement.indexOf("from public.communication_attachments\n    where id=p_attachment_id for update"));
    expect(settlement).not.toContain("exists (");
    expect(settlement).toContain("v_group.processing_lease_expires_at<=now()");
    expect(settlement).toContain("v_attachment.provider_retry_lease_expires_at<=now()");
  });

  it("derives album processing ownership only from rows leased by the current prepare", () => {
    expect(evidence).toContain("returning id,provider_retry_lease_token::text as token");
    expect(evidence).toContain("const owner = leased.rows.find");
    expect(evidence).toContain("if (!owner || owner.id !== input.attachmentId)");
    expect(evidence).not.toContain("order by id limit 1");
  });

  it("revalidates persisted retry identity and delivered-card context before download", () => {
    expect(processor).toContain("l.telegram_user_id=m.provider_user_id and l.member_id=m.author_member_id");
    expect(processor).toContain("g.uploader_member_id=m.author_member_id");
    expect(processor).toContain("g.reply_provider_message_id=m.provider_reply_to_message_id");
    expect(processor).toContain("u.user_id=$12::uuid");
    expect(processor).toContain("card.provider_message_id=m.provider_reply_to_message_id");
    expect(processor).toContain("card.telegram_occurrence_snapshot @> array[o.id]");
    expect(processor).toContain("row.context_valid && row.actor_user_id !== null");
    expect(processor).toContain("revalidateTelegramEvidenceRetryContext");
    expect(processor).toContain("await revalidateTelegramEvidenceRetryContext(row)");
  });

  it("proves one common delivered card and uploader across every album part", () => {
    expect(lockOrderMigration).toContain("v_common_card_assignment");
    expect(lockOrderMigration).toContain("m.author_member_id is distinct from v_group.uploader_member_id");
    expect(lockOrderMigration).toContain("m.provider_reply_to_message_id is distinct from v_group.reply_provider_message_id");
    expect(lockOrderMigration).toContain("card.telegram_occurrence_snapshot @> array[o.id]");
    expect(lockOrderMigration).toContain("v_context_mismatch");
    expect(lockOrderMigration).toContain("a.state='available'");
    expect(lockOrderMigration).toContain("elsif p_source_attachment_id is not null");
  });

  it("keeps the canonical album claim lease bound equal to the runtime RPC", () => {
    expect(schema).toContain("explicit 1..300-second bound");
    expect(migration).toContain("p_lease_seconds > 300");
  });

  it("answers a valid requirement callback at most once across processing exceptions", () => {
    const callback = processor.slice(processor.indexOf("async function processRequirementCallback"));
    expect(callback).toContain("let answered = false");
    expect(callback).toContain("if (api) await api.answerCallbackQuery");
    expect(callback.indexOf("try {\n    const config = loadTelegramConfig()"))
      .toBeGreaterThan(-1);
    expect(callback).toContain("await answerOnce(\"Не вдалося обробити вибір. Спробуйте ще раз.\")");
  });
});
