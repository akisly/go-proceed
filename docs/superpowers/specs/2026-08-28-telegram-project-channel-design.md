# Telegram as the locked project channel — design

**Date:** 2026-08-28

**Status:** approved by the owner in conversation, section by section

**Applies to:** first messaging-channel release

**Read with:**
[`../../decisions/ADR-007-pilot-field-client.md`](../../decisions/ADR-007-pilot-field-client.md),
[`../../architecture/files-and-storage.md`](../../architecture/files-and-storage.md),
[`../../architecture/jobs-events-and-audit.md`](../../architecture/jobs-events-and-audit.md),
[`../../architecture/tenancy-and-security.md`](../../architecture/tenancy-and-security.md),
and [`../../product/personas-and-workflows.md`](../../product/personas-and-workflows.md)

## 1. Purpose

GoProceed gains one field-communication channel for a project: Telegram.
A project team uses one closed Telegram group for site communication, while PTV
staff may read and reply either in that group or in GoProceed's web app. The web
app mirrors the project conversation and connects exact message attachments to
the existing evidence and decision model.

This is not a generic messenger bridge. The project's channel is selected at
the beginning, is locked when the project becomes active, and cannot be changed
or supplemented in this release. Telegram messages do not flow to WhatsApp,
Viber, email, or the GoProceed mobile client. Those future adapters may reuse
the normalized communication model, but no cross-channel routing is designed
or implied here.

Telegram is a transport and interaction surface. PostgreSQL remains the source
of truth for project scope, message identity, authorship, evidence association,
decisions, delivery state, and audit. Private object storage remains the source
of evidence bytes. Telegram is never the only copy of an accepted evidence
original.

## 2. Owner-approved decisions

| # | Decision |
|---|---|
| 1 | A project has exactly one field-communication channel. It is chosen before activation and cannot be switched or supplemented after activation in this release. |
| 2 | Telegram is the first and only implemented channel. WhatsApp, Viber, Mini Apps, and channel switching are out of scope. |
| 3 | One closed Telegram group belongs to one project. Site participants, PTV staff, and the GoProceed bot share that group. |
| 4 | PTV may reply in the Telegram group or from the web app. A web reply returns only to that project's Telegram group. |
| 5 | Evidence is submitted by replying to a GoProceed assignment card. An unbound photo stays visible in communication history but is not evidence. |
| 6 | One official GoProceed bot serves all project groups. Server-side tenant and project resolution provide isolation. |
| 7 | GoProceed mirrors conversation from the time the bot is connected. It does not import earlier Telegram history. |
| 8 | Editing a Telegram message appends history and does not rewrite committed evidence or decisions. Removing a source message in Telegram does not erase GoProceed records; ordinary group-message deletions are not reported by the HTTP Bot API and therefore cannot be mirrored automatically. |

## 3. Approaches considered

### Chosen: one official bot, one closed group per project

One bot token and webhook serve every tenant. Each Telegram chat identifier is
bound to one exact `(workspace_id, project_id)` pair. This gives the pilot one
installation path, one delivery worker, one operational dashboard, and one bot
identity while keeping authorization in GoProceed.

### Rejected: private bot conversations

Private conversations reduce group noise but remove the shared project context
that teams already use and make PTV dependent on the web inbox. They also split
one project into many provider conversations that then have to be reconstructed
in GoProceed.

### Rejected: one bot per organization or project

Dedicated bots provide cosmetic branding, not stronger domain isolation. They
multiply secrets, BotFather setup, webhook operations, rotation, monitoring,
and support. A branded organization bot may be added later as a commercial
option behind the same adapter interface; a bot per project is not planned.

### Rejected: Telegram Mini App

A Mini App would recreate a mobile web client inside Telegram. The first release
needs message capture, evidence association, delivery, and a web inbox, not a
second rich client.

## 4. Scope

### Included

- select `telegram` while creating or configuring a draft project;
- project lifecycle support sufficient to enforce `draft -> active -> archived`;
- create a short-lived one-time Telegram group-binding intent;
- connect one closed Telegram group and show its health in the web app;
- link a Telegram user to an existing workspace member;
- ingest and normalize group messages from the time of connection;
- publish one assignment card and its exact requirement occurrences;
- accept Telegram photos and image documents sent as replies to that card;
- ask the uploader to select one occurrence when the card contains several;
- store every selected image through the existing upload-intent/finalization
  protocol;
- display receipts and actionable failures in Telegram;
- display the project conversation in the web app;
- send a PTV reply from the web app back to the same Telegram thread;
- record Telegram replies from linked PTV members in the web history;
- expose explicit accept and return actions with current authorization checks;
- reflect Telegram edits without rewriting committed evidence or decisions;
- preserve GoProceed history when a source is later removed in Telegram, while
  making no claim that ordinary group-message deletion is observable;
- retry safe delivery failures and make uncertain delivery visible;
- monitor connection, ingestion, download, finalization, and delivery health.

### Evidence media in the first release

- Telegram `photo` messages;
- JPEG, PNG, and HEIC sent as Telegram documents;
- Telegram media groups containing only supported images.

A media group is one submission and must target one occurrence. Each image is
downloaded, hashed, finalized, and recorded independently. Partial success is
visible per image; the batch never claims all images succeeded when one failed.

Telegram videos, voice notes, PDF files, and arbitrary documents are retained
as ordinary communication metadata where the provider update supports it, but
their bytes are not downloaded and they cannot become evidence in this release.

### Excluded

- WhatsApp and Viber adapters;
- the GoProceed mobile app as a selectable project communication channel;
- multiple simultaneous channels for a project;
- channel migration, participant-specific channel overrides, or fallback
  delivery to another channel;
- replies from one messenger to another;
- Telegram Mini Apps, inline mode, business-account impersonation, and personal
  bot conversations as an operational project channel; a private deep-link
  handshake used only to bind a Telegram identity is included;
- importing messages sent before the bot was connected;
- offline capture and durable local queues;
- retroactively associating an unbound photo in the web app;
- videos, voice messages, PDFs, and arbitrary documents as evidence;
- customer-specific bot names, tokens, or branding.
- real-time mirroring of ordinary Telegram group-message deletions; the HTTP
  Bot API exposes deletion updates only for connected business-account chats,
  which this release explicitly excludes.

## 5. Current-state prerequisite

The canonical v0.1 schema defines `project_status` with `draft`, `active`, and
`archived`, but the applied migration `0010_workspace_access_module.sql` and
`packages/contracts/src/projects.ts` do not: projects are created without a
status and therefore have no server-enforced activation boundary.

This release closes that disagreement before channel activation:

- deployed `projects` gains the canonical status vocabulary;
- project creation produces a draft; the channel is selected while the project
  is draft and activation requires `fieldCommunicationChannel: "telegram"`;
- a project activation command is added;
- activation is refused until the Telegram group is connected and healthy;
- the channel value and bound group identity become immutable at activation;
  operational health continues to change as the bot is removed or restored;
- archive preserves the binding and history and stops new field communication.

The change does not invent a second project lifecycle. It makes the applied
surface capable of enforcing the lifecycle already present in the canonical
schema and required by the owner-approved channel rule.

Existing applied projects are backfilled as `active` and receive no inferred
channel. They cannot bind Telegram retroactively in this release; the first
pilot uses a newly created draft project. This preserves the rule that a
project chooses its channel before activation instead of adding a disguised
post-activation switch for legacy rows.

## 6. Architecture

```text
closed Telegram project group
        |
        | signed webhook updates
        v
Telegram adapter / normalized inbox
        |
        +--> communication store --> Web App communication view
        |
        +--> evidence bridge --> existing upload intent / storage / finalize
        |
        +--> explicit decision command --> existing evidence decision model

Web App reply / domain event
        |
        v
transactional outbox --> Telegram delivery worker --> same project group/thread
```

### 6.1 Telegram adapter

The adapter owns provider-specific concerns only:

- webhook-secret verification;
- Bot API update parsing;
- provider update and message identifiers;
- Telegram chat migrations and group membership service messages;
- reply and media-group reconstruction;
- file metadata and downloads;
- Bot API calls and provider error classification.

It emits normalized commands and events. It does not decide workspace access,
project capability, requirement satisfaction, evidence acceptance, or stage
closure.

### 6.2 Communication application service

The communication service resolves the exact channel binding, actor link,
project, reply target, and message identity. It writes normalized messages and
events under tenant RLS and returns an explicit disposition such as:

- `stored_chat_message`;
- `awaiting_identity_link`;
- `awaiting_requirement_choice`;
- `evidence_processing`;
- `rejected_wrong_project_context`;
- `ignored_pre_connection_history`.

No project is inferred from text, group title, username, phone number, or an
assignment code. Only the persisted Telegram chat binding supplies project
scope.

### 6.3 Evidence bridge

The current upload route assumes an authenticated member HTTP session. A
Telegram webhook has provider-authenticated identity, not a Supabase browser
session. The upload authorization and finalization logic must therefore be
factored into shared server-side application services invoked by:

- the existing member routes, with their authenticated user context; and
- the Telegram adapter, with a verified linked-member context.

Both callers use the same membership, project-capability, occurrence, media,
quota, hash, storage, audit, and finalization rules. The Telegram path may not
copy those rules into a second route.

For a Telegram image:

1. resolve the replied-to assignment card;
2. resolve or request one requirement occurrence;
3. verify the linked member has `evidence.record` and access to the project;
4. reject provider-declared files above the Bot API download ceiling before a
   download is attempted;
5. download bytes and compute SHA-256 and byte size server-side;
6. create an intent with an idempotency identity derived from the provider
   message, file, and occurrence;
7. write the bytes to the exact intent-bound storage key;
8. finalize and read the durable receipt;
9. link the communication attachment to the evidence object;
10. publish a Telegram receipt only after `available` is durable.

Telegram does not prove a native camera session, the sensor original, capture
time, or location. The intent uses `origin_not_distinguished`, a null claimed
capture time and timezone, and separate provider provenance. The Telegram
message timestamp is stored as provider communication time, never relabelled as
capture time. A Telegram `photo` may be transformed by Telegram. Sending an
image as a document preserves more provider-visible file metadata but still
does not prove sensor provenance.

### 6.4 Web reply and delivery worker

A web reply is committed to the communication store with state `queued` and an
outbox event in one transaction. A worker sends it to the exact bound chat and,
when applicable, the exact Telegram reply target. Provider acceptance moves the
message to `provider_accepted`; it does not prove a human read the message.

Telegram Bot API sends do not expose a client idempotency key. If the provider
definitively rejects a request before accepting it, the worker may retry under
the existing bounded retry policy. If a network timeout leaves acceptance
unknown, the worker records `delivery_unknown` and does not automatically send
a possible duplicate. PTV sees the uncertainty and may choose a warned manual
retry.

## 7. Data model

Names below describe responsibilities; the implementation plan may align exact
names with repository conventions without changing their meaning.

### `project_field_channels`

One row per project, unique on `(workspace_id, project_id)`:

- channel: first-release value `telegram`;
- state: `unbound`, `connected`, `active`, `unhealthy`, or `archived`;
- `locked_at` and `locked_by_member_id`;
- current binding health and last successful provider interaction;
- version for optimistic concurrency.

The channel value is mutable only while the project is draft and the channel is
unbound. Activation sets `locked_at`; no update can clear or change it. The
row's health state may still move between `active` and `unhealthy` without
changing its channel or Telegram group binding.

### `telegram_chat_bindings`

- workspace and project identity;
- bot identity/version, without the bot token;
- Telegram chat id and chat-type assertion;
- title snapshot for display only;
- connection state, connected time, and connecting member;
- Telegram supergroup migration lineage;
- uniqueness preventing one live chat from belonging to two projects.

A Telegram basic-group-to-supergroup migration may update the provider chat id
through the provider's signed service event. It is continuity of the same
channel, not a channel switch.

### `telegram_member_links`

- workspace member id;
- Telegram user id;
- verified, revoked, and last-seen times;
- actor who issued the link intent;
- uniqueness for one Telegram identity and one member inside a workspace.

The Telegram display name and username are untrusted snapshots. They never
grant access. One person may have memberships in several workspaces; each link
is authorized and scoped independently.

### `communication_messages`

- workspace, project, and field-channel identity;
- inbound, outbound, or system direction;
- normalized kind and text;
- linked member author, or null for an unlinked provider participant;
- provider user snapshot for attribution, never authorization;
- provider message id, provider timestamp, and server receipt time;
- internal reply target and provider reply target;
- assignment-card identity when the bot authored the card;
- delivery/visibility state;
- immutable original normalized content.

Unique provider identities deduplicate inbound messages. Message edits append
events; they do not overwrite original content. Ordinary group-message
deletions produce no HTTP Bot API update and therefore produce no event.

### `communication_message_events`

Append-only edits, delivery transitions, and bot-removal/health events. Every
event records provider time when present and server time. The model does not
invent a deletion event when the provider emitted none.

### `communication_attachments`

- message and Telegram file identity;
- media-group identity;
- untrusted filename and provider-declared size/type;
- lifecycle state, initially `staged` while provider metadata is retained but
  no download or evidence processing has begun;
- chosen requirement occurrence;
- durable evidence object id when finalized;
- exact failure code and retry disposition.

Provider file handles are retained only as long as required for bounded
processing and operational recovery. They are not public download URLs.

### `communication_delivery_attempts`

Each outbound attempt records message, attempt number, state, provider response
identifier when known, timestamps, and a safe error classification. Bot tokens,
signed storage URLs, raw evidence keys, and unrestricted provider payloads are
forbidden.

### `telegram_update_receipts`

The provider update id is unique for the bot. A receipt stores its payload hash,
processing disposition, and timestamps so replay converges on the first result.
The raw update is not retained after normalized processing.

## 8. User flows

### 8.1 Project and group connection

1. An authorized project administrator creates or configures a draft project
   with Telegram as its field channel.
2. GoProceed creates a random, short-lived, single-use binding intent and stores
   only its verifier hash.
3. The administrator opens a `startgroup` deep link and selects a closed group.
4. The bot receives the token in that group, consumes it once, verifies project
   authority, and creates the exact chat binding.
5. The web app shows group title, connection time, and health.
6. Project activation is allowed only while the same binding is healthy.
7. Activation locks the field channel and binding. Removing the bot makes the
   channel unhealthy; it does not unlock or switch the channel.

### 8.2 Member linking

The bot posts a link-account action. The participant opens a private bot deep
link, signs into GoProceed when necessary, and confirms the exact workspace
membership. The one-time token binds the Telegram sender id observed by the bot
to that member. Neither a group administrator role nor a matching display name
is sufficient.

An unlinked person's group message is mirrored with an unverified-author marker
because it is part of project communication. That person cannot produce
evidence or decisions until linking succeeds.

### 8.3 Assignment card and evidence

GoProceed publishes the exact assignment and its ordered requirement
occurrences. The card instructs participants to reply to it.

- With one upload-capable occurrence, a supported image reply begins processing
  immediately.
- With several occurrences, the bot asks the original uploader to choose one.
  Only that uploader's callback is accepted. One selection applies to the whole
  image album.
- No selection within 24 hours closes the attachment as `not_evidence`; the
  chat record remains and the user must reply again in the correct context.
- A supported image not replying to a live assignment card is recorded as
  `unbound` communication and is not downloaded into evidence storage.
- PTV cannot retroactively attach it in the first release.

The bot reports `processing` without claiming success, then reports a durable
receipt or an exact failure such as unsupported type, provider download limit,
requirement policy mismatch, quota exhausted, revoked access, or temporary
provider failure.

### 8.4 PTV conversation and decision

The project communication page shows the Telegram timeline from connection
forward. PTV may reply to a message or assignment card. The web composer cannot
select another channel or recipient.

Accept and return are explicit actions separate from free-form text. They reuse
the existing occurrence evidence-decision command and capability checks. A
message such as `ок` is communication only. A Telegram callback is accepted
only from a linked member who currently holds the required authority.

## 9. Web app

### Project setup

- required field-channel selection on the draft project;
- Telegram-only option in the first release, labelled as the project-wide
  channel rather than a personal preference;
- group connection action and short explanation of bot visibility;
- connected group, health, and immutable-after-activation notice;
- activation refusal with actionable missing prerequisites.

### Project communication

- one chronological timeline for the bound Telegram group;
- author, role, Telegram source, provider time, and server receipt time;
- replies, assignment cards, image attachments, and evidence states;
- explicit unlinked-author and unbound-attachment states;
- message edit history without rewriting the original;
- a permanent notice that Telegram source deletion is not observable and does
  not delete GoProceed history;
- PTV reply composer fixed to Telegram;
- explicit accept and return actions;
- delivery states: queued, provider accepted, failed, or unknown;
- filters for all, unbound, processing, awaiting review, and returned;
- links to exact assignment, occurrence, evidence object, and decision.

The page is not a generic workspace messenger. It exists inside one project and
has no cross-project or cross-channel recipient picker.

## 10. Security and privacy

- The Bot API webhook uses HTTPS and a configured secret header. Invalid or
  missing secrets are refused before body processing.
- Bot token and webhook secret live in the deployment secret store, never in
  tenant tables, client bundles, audit payloads, or logs.
- Provider update size, media count, text length, callback data, and processing
  rate are bounded before expensive work.
- Every inbound action resolves the persisted chat binding and current project
  state. Client-supplied workspace or project ids are not trusted.
- Every member action rechecks active membership, project access, and exact
  capability at execution time.
- Tenant tables carry workspace identity, composite foreign keys, RLS, and
  grants consistent with the current database architecture.
- Link and binding tokens are random, expire, are single-use, and are stored
  only as keyed verifiers.
- Evidence buckets remain private. Telegram never receives permanent storage
  URLs.
- Chat text and participant identifiers are customer data and follow the
  approved retention/export/deletion policy. No real pilot data enters before
  the existing M0 retention and privacy gates are satisfied.
- A linked identity can be revoked without deleting historical attribution.
- Removing the bot, archiving the project, or revoking a member stops new
  actions but preserves committed records.

## 11. Failure handling

| Failure | Required outcome |
|---|---|
| Duplicate webhook update | Return the stored disposition; create no duplicate message, attachment, evidence, decision, or delivery. |
| Unknown or unbound group | Record only a safe operational metric; create no tenant data and disclose no project information. |
| Unlinked participant | Mirror the message as unverified communication; refuse evidence and decisions with a link-account action. |
| Reply to another project's or stale card | Refuse association and disclose no foreign assignment details. |
| Telegram file exceeds provider download limit | Do not request an upload intent; show the exact provider limit and advise a supported resend. |
| Temporary file download failure | Retry within a bounded window using the provider file identity; show processing, never success. |
| One album image fails | Preserve per-image outcomes and report partial success; never roll successful evidence back or claim the batch complete. |
| Upload finalization fails | Keep the chat attachment failed/pending according to the existing upload receipt; do not create a fake evidence link. |
| Bot removed or permission revoked | Mark channel unhealthy, stop outbound sends, surface activation/operation failure, and do not switch channels. |
| Definite outbound rejection | Apply bounded retries when classified retryable, then expose failure. |
| Outbound acceptance unknown | Record `delivery_unknown`; do not blind-retry a possible duplicate. |
| Telegram message edited | Append an event and update the chat projection; preserve immutable evidence and decisions. |
| Telegram source message deleted | The ordinary Bot API emits no deletion update. Keep the GoProceed record unchanged and never claim live deletion mirroring. |

## 12. API surface

Exact paths follow existing `/v1` conventions; the intended operations are:

- create/update draft project with `fieldCommunicationChannel=telegram`;
- create and inspect a Telegram group-binding intent;
- inspect field-channel health;
- activate and archive the project;
- list project communication messages with cursor pagination;
- post a PTV reply to an exact message or assignment card;
- publish an assignment card idempotently;
- issue and revoke a Telegram member-link intent;
- perform explicit occurrence evidence accept/return through the existing
  decision command;
- receive the provider webhook on a non-member integration route.

Member operations use the normal member plane and current capability checks.
The webhook route is provider-authenticated, resolves tenant scope internally,
accepts no workspace/project selector from Telegram callback data, and returns
quickly after durable inbox acceptance. File processing and outbound delivery
run outside the webhook response through leased work.

## 13. Testing and verification

### Contract and unit tests

- strict request/response schemas and channel vocabulary;
- webhook-secret and update parser fixtures;
- normalization of messages, replies, edits, albums, callbacks, and
  group migrations;
- stable provider idempotency identities;
- requirement-choice and attachment state transitions;
- provider error classification and delivery-unknown behaviour;
- Telegram formatting and Ukrainian copy.

### Database and integration tests

- draft project accepts Telegram and active project refuses a channel change;
- activation refuses a missing or unhealthy group;
- one group cannot bind to two projects or workspaces;
- binding and member tokens expire and are single-use;
- cross-tenant chat, member, card, occurrence, and evidence references fail;
- duplicate updates converge on one normalized message and evidence object;
- unlinked participants cannot record evidence or decisions;
- one-occurrence and multi-occurrence card flows;
- albums, partial failures, quota limits, media policies, and revoked access;
- edits preserve committed evidence and decision rows;
- absence of a deletion update never mutates or purges communication evidence;
- a web reply commits with an outbox event atomically;
- definite failure, bounded retry, dead letter, and delivery-unknown paths;
- bot removal changes health without unlocking the channel.

### Provider adapter tests

CI uses a fake Telegram Bot API server and signed webhook fixtures. It does not
depend on the public Telegram service. The fake covers downloads, provider
limits, send responses, timeouts after possible acceptance, and edits,
callback queries, and group migration events.

### Staging acceptance

One real closed Telegram group and physical phone prove:

1. connect a draft project and activate it;
2. link a foreman and a PTV member;
3. publish an assignment card;
4. upload one Telegram photo, one image document, and one album;
5. select a requirement and receive durable receipts;
6. see the same timeline and evidence in the web app;
7. reply from Telegram and from the web app;
8. accept and return with attributed decisions;
9. edit a source message and observe append-only history; delete it in Telegram
   and confirm GoProceed retains the last known record without claiming a
   deletion event;
10. remove and restore the bot and observe health without channel switching;
11. inject a provider timeout and observe `delivery_unknown` without an
    automatic duplicate.

No completion claim is made from green mocks alone; the real-group staging pass
is required before the feature is described as operational.

## 14. Rollout and observability

The adapter is disabled unless the bot token, webhook secret, and public webhook
origin are configured. Project creation cannot offer Telegram in an environment
where those prerequisites fail a readiness check.

Operational metrics include:

- webhook acceptance, rejection, and deduplication counts;
- normalization and authorization failures by safe code;
- time from Telegram receipt to durable evidence receipt;
- attachment success, partial success, and failure counts;
- outbound queue age and provider-accepted/failed/unknown counts;
- connected and unhealthy project channels;
- expired unconsumed binding/member-link intents.

Metrics and logs carry internal opaque ids and safe classifications, not bot
tokens, one-time tokens, signed storage URLs, full chat text, or evidence bytes.

The first rollout is one synthetic staging project, then one named pilot project
after the existing real-data gates are closed. There is no silent enablement for
all existing projects and no inferred channel for historical projects.

## 15. Success criteria

The release succeeds when a linked foreman can reply to an assignment card with
a supported image, receive a truthful durable receipt, and have PTV see the
same message and evidence in the web app; PTV can reply from either surface and
record an attributed accept/return decision; duplicate, cross-tenant, edited,
source-removed, failed, and uncertain-provider paths remain explainable without
changing the project channel, inventing a deletion event, or inventing evidence.
