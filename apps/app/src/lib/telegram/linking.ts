import { withServiceTx, recordAudit } from "@goproceed/database";
import { loadTelegramConfig } from "./config";
import { telegramVerifier } from "./tokens";

type BindingOutcome = "connected" | "wrong_group_type" | "channel_unavailable";
type MemberLinkOutcome = "linked" | "membership_inactive" | "telegram_identity_already_linked";

export type BindingCommandResult =
  | { kind: "invalid_or_expired" }
  | { kind: BindingOutcome; workspaceId: string; projectId: string; bindingId: string | null };

export type MemberLinkCommandResult =
  | { kind: "invalid_or_expired" }
  | { kind: MemberLinkOutcome; workspaceId: string; memberId: string; memberLinkId: string | null };

export type ConsumeBindingCommandInput = {
  rawToken: string;
  chatId: string;
  chatType: string;
  title: string | null;
  telegramUserId: string;
  requestId?: string;
};

export type ConsumeMemberLinkCommandInput = {
  rawToken: string;
  telegramUserId: string;
  displayName: string | null;
  username: string | null;
  requestId?: string;
};

/**
 * Consumes a provider-observed `/startgroup` payload. The database function is
 * the sole authority for expiry, one-use semantics, type checking, binding and
 * channel-health transition; this module never reimplements that locking.
 */
export async function consumeBindingCommand(input: ConsumeBindingCommandInput): Promise<BindingCommandResult> {
  const config = loadTelegramConfig();
  const verifier = telegramVerifier(input.rawToken, config.linkPepper);
  const requestId = input.requestId ?? crypto.randomUUID();

  return withServiceTx({ actorUserId: "", organizationId: null, requestId }, async (tx) => {
    // Retain only non-secret audit metadata. The consuming function is still
    // the one that locks and consumes this row, so this lookup has no bearing
    // on authorization or the atomic state transition.
    const intent = await tx.query<{ id: string }>(
      "select id from public.telegram_binding_intents where verifier_hash=$1", [verifier]);
    const result = await tx.query<{
      workspace_id: string; project_id: string; telegram_chat_binding_id: string | null; outcome: BindingOutcome;
    }>(`select * from app.consume_telegram_binding_intent(
         $1::text, $2::bigint, $3::bigint, $4::text, $5::text, $6::bigint
       )`, [verifier, config.botId, input.chatId, input.chatType, input.title, input.telegramUserId]);
    if (result.rows.length === 0) return { kind: "invalid_or_expired" };

    const row = result.rows[0]!;
    if (intent.rows[0]) {
      await recordAudit(tx, { actorUserId: "", organizationId: row.workspace_id, requestId }, {
        action: "telegram_binding_intent.consumed", object_type: "telegram_binding_intent", object_id: intent.rows[0].id,
        details: { projectId: row.project_id, outcome: row.outcome },
      }, { organizationId: row.workspace_id, actorType: "system" });
    }
    return {
      kind: row.outcome, workspaceId: row.workspace_id, projectId: row.project_id,
      bindingId: row.telegram_chat_binding_id,
    };
  });
}

/**
 * Consumes a provider-observed private `/start` payload. Display metadata is
 * snapshot-only; the Telegram sender id is the sole external identity used.
 */
export async function consumeMemberLinkCommand(input: ConsumeMemberLinkCommandInput): Promise<MemberLinkCommandResult> {
  const config = loadTelegramConfig();
  const verifier = telegramVerifier(input.rawToken, config.linkPepper);
  const requestId = input.requestId ?? crypto.randomUUID();

  return withServiceTx({ actorUserId: "", organizationId: null, requestId }, async (tx) => {
    const intent = await tx.query<{ id: string }>(
      "select id from public.telegram_member_link_intents where verifier_hash=$1", [verifier]);
    const result = await tx.query<{
      workspace_id: string; member_id: string; telegram_member_link_id: string | null; outcome: MemberLinkOutcome;
    }>(`select * from app.consume_telegram_member_link_intent(
         $1::text, $2::bigint, $3::text, $4::text
       )`, [verifier, input.telegramUserId, input.displayName, input.username]);
    if (result.rows.length === 0) return { kind: "invalid_or_expired" };

    const row = result.rows[0]!;
    if (intent.rows[0]) {
      await recordAudit(tx, { actorUserId: "", organizationId: row.workspace_id, requestId }, {
        action: "telegram_member_link_intent.consumed", object_type: "telegram_member_link_intent", object_id: intent.rows[0].id,
        details: { memberId: row.member_id, outcome: row.outcome },
      }, { organizationId: row.workspace_id, actorType: "system" });
    }
    return {
      kind: row.outcome, workspaceId: row.workspace_id, memberId: row.member_id,
      memberLinkId: row.telegram_member_link_id,
    };
  });
}
