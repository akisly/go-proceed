import { adoptServiceWorkspace, withServiceTx, recordAudit } from "@goproceed/database";
import { loadTelegramConfig } from "./config";
import { telegramVerifierCandidates } from "./tokens";

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
  const { keyIds, verifierHashes } = telegramVerifierCandidates(input.rawToken, config.linkKeys);
  const requestId = input.requestId ?? crypto.randomUUID();

  return withServiceTx({ actorUserId: "", organizationId: null, requestId }, async (tx) => {
    const result = await tx.query<{
      workspace_id: string; project_id: string; telegram_chat_binding_id: string | null; outcome: BindingOutcome;
      telegram_binding_intent_id: string;
    }>(`select * from app.consume_telegram_binding_intent(
         $1::text[], $2::text[], $3::bigint, $4::bigint, $5::text, $6::text, $7::bigint
       )`, [keyIds, verifierHashes, config.botId, input.chatId, input.chatType, input.title, input.telegramUserId]);
    if (result.rows.length === 0) return { kind: "invalid_or_expired" };

    const row = result.rows[0]!;
    // The tenant is the OUTPUT of the consume above, so it could not be declared
    // when the transaction opened. Declared now, before anything reads a table:
    // telegram_binding_intents is confined by telegram_binding_intents_service
    // (0062), and the probe below would otherwise return nothing, silently.
    await adoptServiceWorkspace(tx, row.workspace_id);

    // Retain only non-secret audit metadata, keyed by the intent id the
    // consuming function returned (0085) rather than by a second verifier lookup.
    await recordAudit(tx, { actorUserId: "", organizationId: row.workspace_id, requestId }, {
      action: "telegram_binding_intent.consumed", object_type: "telegram_binding_intent", object_id: row.telegram_binding_intent_id,
      details: { projectId: row.project_id, outcome: row.outcome },
    }, { organizationId: row.workspace_id, actorType: "system" });
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
  const { keyIds, verifierHashes } = telegramVerifierCandidates(input.rawToken, config.linkKeys);
  const requestId = input.requestId ?? crypto.randomUUID();

  return withServiceTx({ actorUserId: "", organizationId: null, requestId }, async (tx) => {
    const result = await tx.query<{
      workspace_id: string; member_id: string; telegram_member_link_id: string | null; outcome: MemberLinkOutcome;
      telegram_member_link_intent_id: string;
    }>(`select * from app.consume_telegram_member_link_intent(
         $1::text[], $2::text[], $3::bigint, $4::text, $5::text
       )`, [keyIds, verifierHashes, input.telegramUserId, input.displayName, input.username]);
    if (result.rows.length === 0) return { kind: "invalid_or_expired" };

    const row = result.rows[0]!;
    // Same reason as consumeBindingCommand above: the tenant is resolved by the
    // definer, and telegram_member_link_intents is confined from here on.
    await adoptServiceWorkspace(tx, row.workspace_id);

    await recordAudit(tx, { actorUserId: "", organizationId: row.workspace_id, requestId }, {
      action: "telegram_member_link_intent.consumed", object_type: "telegram_member_link_intent", object_id: row.telegram_member_link_intent_id,
      details: { memberId: row.member_id, outcome: row.outcome },
    }, { organizationId: row.workspace_id, actorType: "system" });
    return {
      kind: row.outcome, workspaceId: row.workspace_id, memberId: row.member_id,
      memberLinkId: row.telegram_member_link_id,
    };
  });
}
