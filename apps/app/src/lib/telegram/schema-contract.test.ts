import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "../../technical/database/schema-v0.1.sql"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/0071_telegram_evidence_claim_fences.sql"), "utf8");

describe("Telegram evidence canonical schema contract", () => {
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
});
