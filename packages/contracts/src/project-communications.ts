import { z } from "zod";
import { governanceRole } from "./members";

/** Telegram identifiers cross the member boundary as decimal strings, never JS numbers. */
export const telegramDecimalId = z.string().regex(/^-?\d+$/);

export const communicationDirection = z.enum(["inbound", "outbound", "system"]);
export const communicationDeliveryState = z.enum([
  "received", "queued", "provider_accepted", "failed", "delivery_unknown",
]);
export const communicationAttachmentState = z.enum([
  "staged", "unbound", "awaiting_requirement_choice", "processing", "available",
  "not_evidence", "failed",
]);

export const postProjectCommunicationRequest = z.object({
  text: z.string().trim().min(1).max(4096),
  replyToMessageId: z.string().guid().optional(),
}).strict();
export type PostProjectCommunicationRequest = z.infer<typeof postProjectCommunicationRequest>;

export const retryProjectCommunicationRequest = z.object({
  acknowledgePossibleDuplicate: z.boolean().optional(),
}).strict();
export type RetryProjectCommunicationRequest = z.infer<typeof retryProjectCommunicationRequest>;

export const projectCommunicationCommandResponse = z.object({
  messageId: z.string().guid(),
  channel: z.literal("telegram"),
  deliveryState: z.literal("queued"),
  replyToMessageId: z.string().guid().nullable(),
  retryOfMessageId: z.string().guid().nullable(),
}).strict();
export type ProjectCommunicationCommandResponse = z.infer<typeof projectCommunicationCommandResponse>;

export const projectCommunicationEvent = z.object({
  eventId: z.string().guid(),
  kind: z.enum(["edited", "delivery_state_changed", "bot_removed", "bot_restored"]),
  text: z.string().nullable(),
  deliveryState: communicationDeliveryState.nullable(),
  serverReceivedAt: z.string().datetime(),
}).strict();
export type ProjectCommunicationEvent = z.infer<typeof projectCommunicationEvent>;

export const projectCommunicationAttachment = z.object({
  attachmentId: z.string().guid(),
  filename: z.string().nullable(),
  mediaType: z.string().nullable(),
  byteSize: z.string().regex(/^\d+$/).nullable(),
  state: communicationAttachmentState,
  requirementOccurrenceId: z.string().guid().nullable(),
  evidenceObjectId: z.string().guid().nullable(),
  evidenceDecisionId: z.string().guid().nullable(),
  failureCode: z.string().nullable(),
}).strict();
export type ProjectCommunicationAttachment = z.infer<typeof projectCommunicationAttachment>;

export const projectCommunicationMessage = z.object({
  messageId: z.string().guid(),
  source: z.literal("telegram"),
  direction: communicationDirection,
  kind: z.enum(["text", "photo", "document", "assignment_card", "system", "unsupported"]),
  author: z.object({
    memberId: z.string().guid().nullable(),
    displayName: z.string().nullable(),
    role: governanceRole.nullable(),
    verified: z.boolean(),
  }).strict(),
  text: z.string().nullable(),
  replyToMessageId: z.string().guid().nullable(),
  retryOfMessageId: z.string().guid().nullable(),
  workAssignmentId: z.string().guid().nullable(),
  providerSentAt: z.string().datetime().nullable(),
  serverReceivedAt: z.string().datetime(),
  deliveryState: communicationDeliveryState,
  events: z.array(projectCommunicationEvent),
  attachments: z.array(projectCommunicationAttachment),
}).strict();
export type ProjectCommunicationMessage = z.infer<typeof projectCommunicationMessage>;

export const projectCommunicationPage = z.object({
  messages: z.array(projectCommunicationMessage),
  nextCursor: z.string().nullable(),
}).strict();
export type ProjectCommunicationPage = z.infer<typeof projectCommunicationPage>;

const telegramIntentReceipt = z.object({
  intentId: z.string().guid(),
  projectId: z.string().guid(),
  memberId: z.string().guid(),
  expiresAt: z.string().datetime(),
}).strict();

export const telegramBindingIntentReceipt = telegramIntentReceipt;
export type TelegramBindingIntentReceipt = z.infer<typeof telegramBindingIntentReceipt>;

export const telegramBindingIntentResponse = z.discriminatedUnion("kind", [
  telegramIntentReceipt.extend({ kind: z.literal("issued"), telegramUrl: z.string().url() }).strict(),
  telegramIntentReceipt.extend({ kind: z.literal("replayed") }).strict(),
]);
export type TelegramBindingIntentResponse = z.infer<typeof telegramBindingIntentResponse>;

export const telegramMemberLinkIntentReceipt = telegramIntentReceipt;
export type TelegramMemberLinkIntentReceipt = z.infer<typeof telegramMemberLinkIntentReceipt>;

export const telegramMemberLinkIntentResponse = z.discriminatedUnion("kind", [
  telegramIntentReceipt.extend({ kind: z.literal("issued"), telegramUrl: z.string().url() }).strict(),
  telegramIntentReceipt.extend({ kind: z.literal("replayed") }).strict(),
]);
export type TelegramMemberLinkIntentResponse = z.infer<typeof telegramMemberLinkIntentResponse>;

export const projectFieldChannelHealth = z.object({
  channel: z.literal("telegram"),
  state: z.enum(["unbound", "connected", "active", "unhealthy", "archived"]),
  title: z.string().nullable(),
  connectedAt: z.string().datetime().nullable(),
  lastHealthyAt: z.string().datetime().nullable(),
}).strict();
export type ProjectFieldChannelHealth = z.infer<typeof projectFieldChannelHealth>;

export const assignmentCardResponse = z.object({
  messageId: z.string().guid(),
  assignmentId: z.string().guid(),
  deliveryState: communicationDeliveryState,
}).strict();
export type AssignmentCardResponse = z.infer<typeof assignmentCardResponse>;
