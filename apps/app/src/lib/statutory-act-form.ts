import { createHash } from "node:crypto";
import { DODATOK_V_FIELDS } from "./dodatok-v";
import {
  renderedStatutoryAct,
  type ActRenderBlocker, type AssuranceLevel, type RenderBlock,
  type RenderedStatutoryAct, type StatutoryActVersionView, type VerificationTagValue,
} from "@goproceed/contracts";

/**
 * THE ДОДАТОК В RENDER: the template registry, the block model, and the
 * refusal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS FIRST: THE FORM'S FIELD LIST IS NOT IN THIS REPOSITORY
 *
 * hidden-works-content-rules.md allow-list item 3 licenses «the Додаток В form —
 * every field of В.1 and В.2, in the standard's order». It licenses the product
 * to print them.
 *
 * SINCE 2026-08-10 THE REPOSITORY HAS THEM. The owner supplied the official ДБН
 * file and confirmed the edition; `technical/requirements/dbn-a31-5-2016-dodatok-v.csv`
 * carries all 51 printed lines of В.1 and В.2 in the standard's order,
 * transcribed BY MACHINE from that file and verified byte-for-byte against it,
 * every row tagged VERIFIED_PRIMARY and carrying the file's sha256.
 *
 * WHAT IS STILL MISSING IS NOT THE CAPTIONS. `fieldList` below stays `null` for
 * two remaining reasons, both named at the bottom of this comment: the BINDINGS
 * (which caption a fact prints under) are a decision nobody has taken, and
 * `DBN_RETRIEVAL_RECORD` still lacks the URL and the retrieval date. Either one
 * alone keeps the render refusing.
 *
 * The rule that closed the door while the captions were absent is kept verbatim,
 * because it is why the CSV was generated rather than typed —
 * docs/delivery/test-strategy.md:139-152 —
 *
 *     «no test may substitute a field list typed from memory. That substitution
 *      is precisely the fabrication class the adversarial audit behind
 *      hidden-works-content-rules.md was run to catch, and it would be worse in
 *      a fixture than in a document, because a fixture looks verified.»
 *
 * A RENDERER IS WORSE THAN A FIXTURE. A caption typed from memory into this file
 * would be printed onto a document an engineer's client's lawyer reads, and it
 * would look decided. So this file still contains NO field of Додаток В, NO
 * caption of one, and NO order for them — they live in the CSV, and the
 * transcription was performed by a script reading the PDF's own text layer, so
 * no caption passed through anyone's hands. The same reasoning now applies to
 * the BINDINGS: putting the quantity table under «3. При виконанні робіт
 * застосовані» instead of «1. До закриття пред\'явлені такі роботи» would be a
 * wrong document that looks decided, so no binding is guessed here either. `DODATOK_V_TEMPLATE.fieldList` is `null`, and
 * while it is null the render REFUSES with
 * `dodatok_v_field_list_not_committed` and names the file that closes it.
 *
 * THE REFUSAL IS DERIVED, NOT DECLARED. `renderStatutoryAct` computes its
 * blockers from the registry and from the act's own row; nothing in it says «M4
 * is blocked». On the day the field list is committed under
 * `technical/requirements/` with its verification tag and its source, and
 * `fieldList` is populated from it, the same code renders. That is the only
 * change this file needs.
 *
 * AND IT IS UNCONDITIONAL — SAY IT HERE, BECAUSE «the render refuses» reads like
 * something an input could avoid. The field-list blocker is pushed for any
 * template whose `fieldList` is null and the function returns `{ ok: false }` on
 * any non-empty blocker list; NEITHER TEST LOOKS AT THE ACT. So the render
 * refuses for every act, on every input, in every workspace, and there is no
 * composition a user could assemble and no fixture a suite could build that
 * reaches a rendered document. `statutory_act_versions.freeze` hashes the render,
 * so IT ALWAYS REFUSES TOO — an act can be composed as a draft and can never
 * become a document. `DBN_RETRIEVAL_RECORD` below is a second, independent and
 * equally unconditional blocker: closing one leaves the other.
 *
 * THE CONSEQUENCE, NAMED SO NOBODY HAS TO DERIVE IT: v0.1-M4's user outcome is «a
 * document someone can print and hand over» (docs/delivery/version-0.1.md
 * §v0.1-M4) and v0.1 does not meet it. M4 SHIPS A COMPOSER AND NO DOCUMENT. This
 * is correct behaviour and not a defect — refusing is the only correct option
 * open to a renderer that has not been given the form — and it is a milestone
 * blocker all the same. It is recorded in TODOS.md and in the progress
 * document's standing statement; a passing suite over this file is not evidence
 * against it, because the suites assert the refusals.
 *
 * ONE DOCUMENT STILL STATES M4 WITHOUT IT, as of 2026-08-08:
 * `docs/delivery/version-0.1.md` §v0.1-M4 carries the user outcome and a
 * six-step acceptance walk, two of whose steps — «render twice and diff the
 * bytes» and «check the render field by field against the В.1/В.2 list» — cannot
 * be performed while `fieldList` is null. That file owes the sentence; TODOS.md's
 * M4 blocker entry records it as owed and says what it must say. If you are
 * reading this file because that walk failed, nothing is broken.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS A TEMPLATE AT ALL, AND WHY IT IS PINNED BY HASH
 *
 * Migration 0047 §4: every string of Додаток В other than the form citation is
 * TEMPLATE content, pinned by `form_template_key` + `form_template_version` +
 * `form_template_hash`. Storing them as columns would name fields of the form,
 * which ADR-005 decision 10 refuses to do and which prohibition E makes
 * dangerous — «a column is a field, and a field nobody sourced is a field
 * somebody will fill».
 *
 * The hash is not decoration. A contributor can edit a template and leave the
 * version string alone, and then two renders of one frozen act version differ
 * with nothing in the record to say why. `formTemplateHashOf` digests the whole
 * template definition, so the version string cannot lie about the bytes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS NOT CHECKED
 *
 * NOTHING HERE WAS EXECUTED — no test run, no route invoked, no build. Додаток
 * В's own text was never read in this repository, and every string below is
 * transcribed from `docs/product/hidden-works-content-rules.md`, which is
 * in-repo and Approved, and from nowhere else.
 */

/**
 * Bumped when the rendered document's SHAPE or CONTENT changes for unchanged
 * inputs. INV-015's determinism clause is «byte-deterministic FOR A GIVEN
 * RENDERER VERSION», so this string is the qualifier that makes the promise
 * keepable across a change to this file.
 *
 * /2, 2026-08-28: the project-sourced slice taught `blocksFor` to print
 * `PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT` on a list that carries a
 * PROJECT_DOCUMENTATION decision — output that /1, still deployed anywhere the
 * new code is not, cannot produce. Left un-bumped, «/1» would have named two
 * different behaviours, and a cross-binary divergence on such an act would
 * have reported «renderer statutory-act-render/1 against frozen
 * statutory-act-render/1» — a diagnostic pointing away from the real cause.
 * Bumped after verifying no frozen act exists outside disposable local dev
 * (staging measured 2026-08-28: migrations through 0058, zero
 * statutory_act_versions rows), so no pinned content_hash anywhere covers the
 * old string and the bump breaks no re-render.
 */
export const RENDERER_VERSION = "statutory-act-render/2";

// ───────────────────────────────────────────────────────────────────────────
// Provenance-bearing source records
// ───────────────────────────────────────────────────────────────────────────

/**
 * The retrieval record M0 gate 10 owes: the exact URL, the retrieval date and a
 * SHA-256 of the bytes (hidden-works-content-rules.md §"Open items", first
 * bullet).
 *
 * ALL THREE FIELDS ARE REQUIRED BY THE TYPE, so a half-filled record is a
 * compile error rather than a weaker record that still renders.
 */
export interface DbnRetrievalRecord {
  url: string;
  retrievedOn: string;
  sha256: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LANDED 2026-08-10, AND THE BYTES WERE RE-FETCHED RATHER THAN TAKEN ON TRUST
 *
 * This was `null` for the whole of v0.1, and while it was null every
 * `VERIFIED_PRIMARY` string was refused a customer-facing render — the plan's
 * own sentence (`docs/superpowers/plans/2026-08-06-v0.1-implementation.md:265`),
 * not a rule this file added. It was the LAST of M4's two blockers.
 *
 * WHAT THE HASH DID AND DID NOT PROVE, because this record exists for the
 * difference. §"Open items" recorded a fetch «no reviewer could reproduce»: the
 * file was not retained and no URL, date or hash was kept. On 2026-08-10 the
 * owner supplied the file and its sha256 was recorded — which proves two people
 * hold the same bytes and says NOTHING about where the bytes came from. That is
 * why a hash alone did not close this and the URL had to arrive separately.
 *
 * NOW IT IS REPRODUCIBLE. The owner supplied the download URL below; the file
 * was fetched from it and hashed independently of anything this repository had
 * already written down. It is 636 603 bytes — the byte count the adversarial
 * audit recorded before any of this — and its SHA-256 is the value below,
 * matching character for character the hash the Додаток В transcription was
 * verified against. A reviewer can now repeat that: fetch, hash, compare.
 *
 * `url` IS THE STABLE PAGE, NOT THE BYTES' OWN LINK, and that is deliberate.
 * The file itself was fetched from
 * `https://e-construction.gov.ua/files-token/c7fb685e91deb04c43a13f9a6cf628a1`,
 * and a `files-token` link is by its shape a signed, expiring one. Recording it
 * here would produce a record that stops resolving and leaves the tag asserted
 * again — the exact failure this field exists to prevent. The laws_detail page
 * below is the durable entry point a reviewer can reopen and reach the file
 * from. Both are named here so neither is lost.
 */
export const DBN_RETRIEVAL: DbnRetrievalRecord = {
  url: "https://e-construction.gov.ua/laws_detail/3879707932224390963",
  retrievedOn: "2026-08-10",
  sha256: "4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3",
};

/**
 * THE TYPE STAYS NULLABLE AND THE BLOCKER STAYS IN `renderStatutoryAct`. The
 * refusal is DERIVED from the absence of this datum, never declared, so setting
 * it back to `null` — because the URL rotted, or because a new edition arrives
 * unverified — makes the render refuse again with no other edit. A blocker
 * deleted on the day it stopped firing could not do that.
 */
export const DBN_RETRIEVAL_RECORD: DbnRetrievalRecord | null = DBN_RETRIEVAL;

/**
 * The provenance every `VERIFIED_PRIMARY` tag in this repository rests on.
 *
 * BUILT FROM THE RECORD ABOVE, NOT TYPED BESIDE IT. Until 2026-08-10 this
 * string said «URL/дата/хеш не збережені», which was true and is now false; a
 * provenance string that has to be edited in step with a record is a provenance
 * string that will one day contradict it. Deriving it means the citation a
 * customer reads and the record a reviewer re-fetches cannot disagree.
 *
 * The independence caveat is NOT derived and is kept verbatim, because it is
 * still true: one fetch was reproduced, which is not the same as two
 * independent sources agreeing.
 */
const DBN_SINGLE_FETCH_SOURCE =
  "ДБН А.3.1-5:2016; офіційний файл e-construction.gov.ua, " +
  `${DBN_RETRIEVAL.url}, завантажено ${DBN_RETRIEVAL.retrievedOn}, ` +
  `sha256=${DBN_RETRIEVAL.sha256}; ` +
  "незалежність будь-яких додаткових копій не встановлена";

/**
 * WHAT FILLS A FIELD. The binding is the join between the form and this
 * database, and it is stated PER FIELD by whoever commits the field list —
 * because which of Додаток В's fields takes the performed quantity, which takes
 * the requirement list, and which takes each signatory is part of knowing what
 * the fields ARE, and this file does not know that.
 *
 * `static` is a field the form fills with its own fixed text and this database
 * has nothing to put in — the caption prints and no fact is placed under it.
 * There is deliberately no `free_text` binding: a field a human types into is
 * the thing INV-073 exists to prevent, and there is nowhere to put one.
 */
export type FormFieldBinding =
  | { kind: "static" }
  | { kind: "quantity_lines" }
  | { kind: "decision_blocks" }
  | { kind: "signatory"; slot: "builder" | "technical_supervision" | "designer_supervision" }
  /**
   * A single value this database holds, named by WHAT IT IS rather than by a
   * column, and resolved by `blocksFor` below.
   *
   * ADDED 2026-08-10, when the field list arrived and the other four kinds
   * turned out to reach about a third of Додаток В. The set is CLOSED on
   * purpose: a `factRef: string` would let a field name a fact the renderer
   * cannot resolve, and it would print blank while looking bound. Adding a
   * field here is therefore a compile error until `blocksFor` learns to answer
   * it — which is the same arrangement that keeps captions out of this file.
   *
   * WIDENED 2026-08-10, which was the separate named step this comment used to
   * defer to. `work_items.description` and `projects.name` were in the database
   * and not on the view, so «найменування робіт» and «найменування і місце
   * розташування об'єкта будівництва» printed blank; migration 0056 and
   * `loadActVersionView` put all three on the view and the two fields now bind.
   * The set is still closed, and the remaining blanks of Додаток В stay blank
   * because NO COLUMN ANYWHERE HOLDS THEM — проектна документація, матеріали з
   * сертифікатами, відхилення, дати початку і закінчення — not because they are
   * unreachable from here. Guessing one is still not available.
   */
  | { kind: "recorded_fact";
      fact: "act_date" | "builder_organisation_name"
          | "work_item_description" | "construction_object" };

/**
 * One entry of the В.1/В.2 field list, if it is ever committed. The shape is
 * here so that populating it REQUIRES a caption, an ordinal, a binding, a
 * verification tag and a source — a field list cannot be added as bare strings,
 * and a caption cannot be added without saying where it came from.
 *
 * `caption` is deliberately not typed as anything narrower than a string,
 * because this file has never seen one and must not pretend to know their shape.
 * Whoever commits it copies the text BYTE FOR BYTE: prohibition F names «На
 * основі викладеного», «посада,номер» without its space and the state file's
 * «Притітка» typo as strings a formatter must not "fix", and this renderer
 * applies no normalisation of any kind to a caption — no trim of an interior
 * space, no spell pass, no `.normalize()`.
 */
export interface FormFieldDefinition {
  fieldId: string;
  ordinal: number;
  section: "В.1" | "В.2";
  caption: string;
  binding: FormFieldBinding;
  /**
   * STAYS THE TEMPLATE'S OWN TWO-VALUE UNION — NOT WIDENED TO
   * `VerificationTagValue`, and not an oversight of migration 0059. A field
   * of this list is TEMPLATE content: transcribed from the ДБН file and
   * pinned by `form_template_hash`, the same for every act ever rendered off
   * this template, never a fact recorded about one project. It can never be
   * `PROJECT_DOCUMENTATION`, because that value states an ORIGIN a workspace
   * supplied for its own occurrence (hidden-works-content-rules.md
   * §"Project-sourced strings": "an origin, not a verification strength"),
   * and there is no such thing as a workspace-supplied field of Додаток В —
   * prohibition E forbids adding one, and this file's header already refuses
   * a caption typed from memory for the same reason. `FormTemplate.title.
   * verification`, below, carries identical reasoning.
   */
  verification: "VERIFIED_PRIMARY" | "VERIFIED_SECONDARY";
  source: string;
}

export interface FormTemplate {
  key: string;
  version: string;
  actForm: "dodatok_v";
  /**
   * The title of the form. Allow-list item 7. `verification` stays the
   * template's own two-value union for the same reason as
   * `FormFieldDefinition.verification` above: a form title is template
   * content, never a project's own record, so it is never
   * `PROJECT_DOCUMENTATION`.
   */
  title: { text: string; verification: "VERIFIED_PRIMARY" | "VERIFIED_SECONDARY"; source: string };
  /**
   * `null` until the enumeration is committed under `technical/requirements/`.
   * See this file's header: no caption of Додаток В is written here.
   */
  fieldList: readonly FormFieldDefinition[] | null;
}

/**
 * THE v0.1 TEMPLATE. Two sourced strings and an absent field list.
 *
 * PROHIBITION D is why the title is what it is and not «Акт огляду прихованих
 * робіт» — and the prohibition's second half is equally binding and is NOT this
 * renderer's business: «do not tell users «акт огляду» is obsolete», because it
 * is live normative vocabulary in ДБН п. 8.6.3 в) and ПКМУ № 903 п. 6 пп. 5.
 * Nothing here says anything about it either way.
 */
export const DODATOK_V_TEMPLATE: FormTemplate = {
  key: "dodatok-v",
  version: "0.1.0",
  actForm: "dodatok_v",
  title: {
    // hidden-works-content-rules.md allow-list item 7 and prohibition D.
    text: "АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ",
    verification: "VERIFIED_PRIMARY",
    source: DBN_SINGLE_FETCH_SOURCE,
  },
  // The 51 printed lines of В.1 and В.2, generated out of
  // technical/requirements/dbn-a31-5-2016-dodatok-v.csv and compared back
  // against it byte for byte. No caption is written in THIS file, which is the
  // arrangement the header describes and the one Додаток Н already uses.
  fieldList: DODATOK_V_FIELDS,
};

const TEMPLATES: readonly FormTemplate[] = [DODATOK_V_TEMPLATE];

export function findFormTemplate(key: string, version: string): FormTemplate | null {
  return TEMPLATES.find((t) => t.key === key && t.version === version) ?? null;
}

/**
 * The attribution allow-list item 3 gives, verbatim. It is the ONE normative
 * string the act row itself stores (migration 0047 §4), and the composer writes
 * it together with its tag and its source into three NOT NULL columns, so an
 * unsourced act is unrenderable because it is unstorable.
 */
export const FORM_CITATION_TEXT = "форма за Додатком В (обов'язковим)";
export const FORM_CITATION_SOURCE = DBN_SINGLE_FETCH_SOURCE;

// ───────────────────────────────────────────────────────────────────────────
// The mandatory disclaimers, transcribed from the content rules
// ───────────────────────────────────────────────────────────────────────────

const RULE_REQUIRED_DISCLAIMERS =
  "docs/product/hidden-works-content-rules.md §\"Required disclaimers\"";

/**
 * §"Required disclaimers": «On every page of a generated act blank», small,
 * footer. Transcribed verbatim, with `{дата останньої перевірки}` filled from
 * `statutory_act_versions.registry_checked_on`.
 *
 * THE APPROVING ORDER IS NOT IN IT. «затвердженого наказом Мінрегіону від
 * 05.05.2016 № 115, чинного з 01.01.2017» was REMOVED from this disclaimer on
 * 2026-08-06 and «must not be restored by a template edit»: it is asserted by no
 * allow-list item, and the architectural requirement makes a string with no
 * source unrenderable — a mandatory disclaimer carrying one would make the act
 * blank itself unrenderable. hidden-works-content-rules.md §"Open items" records
 * that the only way it comes back is fetching the наказ and adding an allow-list
 * row under §"Change control". Not here, and not by editing this constant.
 */
export function pageFooterText(registryCheckedOn: string): string {
  return "Форма за Додатком В (обов'язковим) ДБН А.3.1-5:2016 «Організація будівельного "
    + "виробництва». Документ сформовано автоматично й офіційним виданням норми не є. "
    + `Перевірено за Реєстром будівельних норм: ${registryCheckedOn}.`;
}

/**
 * §"Required disclaimers": «Under every generated requirement list», never
 * collapsed. Transcribed verbatim.
 *
 * WHY THE ACT PRINTS IT. The act's decision section reproduces the acceptance
 * criteria of the occurrences the closure was proved against, and those criteria
 * are Додаток Н items carrying Додаток Н citations. That is a generated
 * requirement list in substance, and prohibitions B and C are the two largest
 * legal risks the content rules name. Printing a mandatory disclaimer where it
 * may not have been strictly required costs a paragraph; omitting one where it
 * was required is the failure the document exists to prevent.
 */
export const DOVIDKOVYI_DISCLAIMER_TEXT =
  "Наведений перелік — це довідковий Додаток Н ДБН А.3.1-5:2016 (позиція Н.15 "
  + "«Монтаж електротехнічних установок» / Н.14 «Внутрішні санітарно-технічні роботи»), "
  + "відтворений дослівно. Обов'язковий перелік прихованих робіт для вашого об'єкта "
  + "визначає робоча документація (п. 8.4.3.3 ДБН А.3.1-5:2016). Цей перелік її не "
  + "замінює. За потреби такими актами оформлюють й інші види робіт.";

/**
 * How a mandatory disclaimer decides whether it is shown, named as a value so
 * the distinction §"Required disclaimers" draws between its disclaimers is
 * checkable rather than only described in a comment.
 *
 *   `"every_page"`      — `pageFooterText` above: shown on every page
 *                          regardless of what the page contains
 *                          (`pageFooterRepeatsOnEveryPage` on the rendered
 *                          document).
 *   `"never_collapsed"` — `DOVIDKOVYI_DISCLAIMER_TEXT` above and the
 *                          decision-block disclaimers below: shown every time
 *                          their host block is shown at all, which is why
 *                          every other `disclaimer()` call in this file
 *                          passes `neverCollapse: true`.
 *   `"conditional"`     — shown only when a further fact about the host
 *                          list's CONTENTS holds, true on some lists and
 *                          false on others. `PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT`
 *                          below carries this value.
 *
 * ADDITIVE ONLY: the existing constants above are not retrofitted with this
 * type, because doing so is not this change's surface.
 */
export type DisclaimerPlacement = "every_page" | "never_collapsed" | "conditional";

/**
 * §"Required disclaimers": «and, only on a list that also carries
 * project-sourced items, immediately after it» — printed immediately after
 * `DOVIDKOVYI_DISCLAIMER_TEXT` above, and only when that list carries at
 * least one item whose `verification` is `PROJECT_DOCUMENTATION`
 * (§"Project-sourced strings", ADR-010, migration 0059). Transcribed
 * verbatim.
 *
 * CONDITIONAL, NOT NEVER-COLLAPSED — the distinction §"Required disclaimers"
 * itself draws between this text and `DOVIDKOVYI_DISCLAIMER_TEXT`.
 * `DOVIDKOVYI_DISCLAIMER_TEXT` is shown under every generated requirement
 * list once that list is shown at all; this text is shown only when a fact
 * about the list's CONTENTS holds.
 *
 * THE CONDITION IS «AT LEAST ONE», NOT «MIXED», and the difference is not
 * pedantry. The rule's own words are «only on a list that ALSO CARRIES
 * project-sourced items» — satisfied by one such item whatever the rest of the
 * list is. A condition written as «seeded Додаток Н items ALONGSIDE a
 * workspace-supplied one» would omit the mandated string from the list that
 * most needs it: the one whose every item came from the site's own робоча
 * документація. A list built entirely from the seeded library carries no such
 * item and never prints it, which is what
 * `PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT` below records as
 * `"conditional"` rather than `"never_collapsed"`.
 *
 * `blocksFor`'s `"decision_blocks"` case READS THIS CONSTANT and pushes it
 * directly after the довідковий disclaimer when the condition holds. The
 * surface is live: `loadActVersionView` (src/lib/statutory-act.ts) composes an
 * act's decisions from `stage_closure_occurrences ⋈ requirement_occurrences`
 * with no provenance filter, and since migration 0059 an occurrence's
 * `norm_ref_verification` can be `PROJECT_DOCUMENTATION` — which is also why
 * `normative()` below takes the full `VerificationTagValue`.
 */
export const PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT =
  "Пункти, позначені «за робочою документацією об'єкта», внесені виконавцем з "
  + "робочої документації цього об'єкта із зазначенням аркуша та номера креслення. "
  + "Їх текст не є витягом з ДБН і видавцем цієї системи не перевірявся.";

export const PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT: DisclaimerPlacement = "conditional";

/**
 * §"Required disclaimers": «Next to every rendered decision or signatory block»,
 * on the same page as the actor and the server time.
 *
 * THE LEVEL NAME IS THE LADDER'S OWN, IN THE LADDER'S OWN WORDS. The assurance
 * ladder names its five levels in English — `workflow comment`, `operational
 * acknowledgement`, `authenticated acceptance record`, `electronic signature`,
 * `qualified electronic signature (КЕП)` — and gives no Ukrainian translation
 * anywhere in this repository. Inventing one would be writing legal-adjacent
 * product copy onto a regulated document, which is what this whole file exists
 * not to do, and a mistranslation of level 3 is precisely the conflation the
 * ladder exists to prevent. So the ladder's own label is printed and the gap is
 * reported. Prohibition S is satisfied by construction either way: no level
 * below 4 has «підпис» in its name.
 */
export const ASSURANCE_LEVEL_LABEL: Record<AssuranceLevel, string> = {
  workflow_comment: "workflow comment",
  operational_acknowledgement: "operational acknowledgement",
  authenticated_acceptance_record: "authenticated acceptance record",
  electronic_signature: "electronic signature",
  qualified_electronic_signature: "qualified electronic signature (КЕП)",
};

/** §"Required disclaimers", for level 3 only, immediately after the level line. */
export const LEVEL_3_NOT_A_SIGNATURE_TEXT =
  "Це підтвердження за електронним посиланням із зафіксованими IP та серверним часом. "
  + "Це не електронний підпис.";

/**
 * WHICH LADDER LEVEL A v0.1 EVIDENCE DECISION IS. THIS MAPPING IS THE PRODUCT'S
 * ASSUMPTION AND IS STATED BY NO DOCUMENT.
 *
 * The ladder describes MECHANISMS, and v0.1 produces exactly two:
 *
 *   * an INTERNAL member decision — «a recorded ... by an identified in-product
 *     actor», at a server time, with no legal effect claimed. That is level 2,
 *     `operational acknowledgement`. It is not level 3, because level 3 is
 *     defined by the link mechanism (email link, IP, server time, no account),
 *     and it is certainly not 4 or 5.
 *   * an EXTERNAL decision carrying `assurance_label = 'LINK_CONFIRMATION'` —
 *     which the ladder names as level 3 in terms. No v0.1 route can write one
 *     yet; `requirement_evidence_decisions_v01_internal_only_check` (migration
 *     0045) shuts it until M5.
 *
 * WHAT «operational acknowledgement» COSTS, said plainly: level 2's own row says
 * «No legal effect». An accepted evidence decision by a технагляд employed by
 * the customer is arguably more than an acknowledgement — but «arguably more» is
 * not a level, and the ladder's standing rule is that assurance is about the
 * MECHANISM and never about authority. Reading it upward would be exactly the
 * conflation prohibition S and the ladder exist to prevent.
 *
 * `null` means the level CANNOT BE STATED — an `assurance_label` this function
 * does not recognise. The ladder's standing rule then applies: «a package or act
 * that cannot state the level of a decision it carries must not render that
 * decision», so the render refuses rather than printing an unlabelled block.
 */
export function assuranceLevelOf(assuranceLabel: string | null): AssuranceLevel | null {
  if (assuranceLabel === null) return "operational_acknowledgement";
  if (assuranceLabel === "LINK_CONFIRMATION") return "authenticated_acceptance_record";
  return null;
}

/**
 * The slot names п. 8.4.3.5 gives, as quoted by ADR-005 decision 10 and
 * migration 0047 §6.
 *
 * THESE ARE SLOT NAMES AND NOT FORM CAPTIONS, and the distinction is the whole
 * point of this comment. What caption Додаток В prints above each signature line
 * is part of the В.1/В.2 field list, which is not committed here; these are the
 * names of the three ROLES the standard's clause names. The render labels them
 * as roles, and when the field list lands the captions come from there and these
 * stay what they are.
 */
const SLOT_ROLE_NAME: Record<string, string> = {
  builder: "будівельна організація",
  technical_supervision: "технічний нагляд замовника",
  designer_supervision: "авторський нагляд",
};

const SLOT_ROLE_SOURCE =
  "ДБН А.3.1-5:2016, п. 8.4.3.5 (за ADR-005 рішення 10); " + DBN_SINGLE_FETCH_SOURCE;

// ───────────────────────────────────────────────────────────────────────────
// Canonical serialisation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Key-sorted JSON. `JSON.stringify` preserves insertion order, so two objects
 * that are equal as values can serialise to different bytes and produce
 * different hashes — which would make INV-015's determinism claim depend on the
 * order a function happened to build a literal in.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * The hash the act version pins. Digests the WHOLE template definition, so a
 * contributor who edits a caption without touching `version` still moves the
 * hash and the divergence has a name.
 */
export function formTemplateHashOf(template: FormTemplate): string {
  return sha256Hex(canonicalJson(template));
}

// ───────────────────────────────────────────────────────────────────────────
// The render
// ───────────────────────────────────────────────────────────────────────────

function normative(
  blockId: string, text: string,
  // Widened to the full `VerificationTagValue` (not the form template's own
  // narrower two-value union below) because this helper also renders
  // `d.normRef.verification` off a live requirement occurrence, which —
  // since migration 0059 — can legitimately carry `PROJECT_DOCUMENTATION`.
  // The form's own static calls (title, section caption, field caption,
  // signatory role) pass a two-value literal, which is assignable here
  // without narrowing anything back down.
  verification: VerificationTagValue, source: string,
): RenderBlock {
  return { blockId, text, provenance: { kind: "normative", verification, source }, neverCollapse: false };
}
function disclaimer(blockId: string, text: string, mandatedBy: string, neverCollapse: boolean): RenderBlock {
  return { blockId, text, provenance: { kind: "disclaimer", mandatedBy }, neverCollapse };
}
function fact(blockId: string, text: string, factRef: string): RenderBlock {
  return { blockId, text, provenance: { kind: "recorded_fact", factRef }, neverCollapse: false };
}

export type RenderOutcome =
  | { ok: true; document: RenderedStatutoryAct }
  | { ok: false; blockers: ActRenderBlocker[] };

/**
 * The render `statutory_act_versions.freeze` takes to compute `content_hash`.
 *
 * The freeze IS the transaction in which the version becomes frozen, so the
 * renderer's `act_version_not_frozen` blocker — which is about SERVING a draft
 * to a caller — must not fire on the content the freeze is about to make
 * immutable. Every other blocker applies unchanged, which is the point: an act
 * that cannot be rendered cannot be frozen, because freezing it would pin a
 * content hash of a document that does not exist.
 *
 * The document this produces is byte-identical to the one
 * `statutory_acts.render` produces from the frozen row afterwards: it depends on
 * the version's facts, the template and `RENDERER_VERSION`, and on no clock and
 * no column the freeze itself writes.
 */
export function renderForFreeze(
  version: StatutoryActVersionView, template: FormTemplate | null,
): RenderOutcome {
  return renderStatutoryAct({ ...version, status: "frozen" }, template);
}

/**
 * Render one act version, or refuse and say exactly why.
 *
 * THE BLOCKERS ARE COMPUTED, NOT LISTED. Each one is the absence of a specific
 * datum — a registered template, a committed field list, a retrieval record, a
 * frozen status, a statable assurance level — so the set shrinks on its own as
 * those data land, and no edit to this function is needed to unblock it.
 *
 * THE ORIGINAL'S LANGUAGE IS NOT CORRECTED, AND THERE IS NOWHERE HERE TO CORRECT
 * IT. Prohibition F names «На основі викладеного» (В, against Г's «На підставі»),
 * «посада,номер» without its space and the state file's «Притітка» typo as
 * strings a formatter must not "fix". None of the three is in this file, because
 * all three belong to the В.1/В.2 field list and that list is not committed. The
 * standing rule for whoever commits it: THE TEXT IS COPIED BYTE FOR BYTE AND
 * PASSES THROUGH THIS RENDERER UNTOUCHED — there is no normalisation step here,
 * no trim of an interior space, no spell pass, and no `.normalize()`. If a
 * normalisation is ever wanted it is applied deliberately at the point the field
 * list is committed and recorded in the row that carries it, never here.
 */
export function renderStatutoryAct(
  version: StatutoryActVersionView, template: FormTemplate | null,
): RenderOutcome {
  const blockers: ActRenderBlocker[] = [];

  if (template === null) {
    blockers.push({
      code: "form_template_unknown",
      detail: `no render template is registered for key "${version.formTemplateKey}" `
        + `version "${version.formTemplateVersion}"`,
      closedBy: "register the template in apps/app/src/lib/statutory-act-form.ts, "
        + "or compose the act against a template that exists",
    });
  }

  if (version.status !== "frozen") {
    blockers.push({
      code: "act_version_not_frozen",
      detail: "the act version is still a draft, and a draft is not a document to hand over",
      closedBy: "freeze the version with statutory_act_versions.freeze",
    });
  }

  // INV-073, render half. The storage half already makes the partial
  // combination unstorable (three NOT NULL columns), so reaching this is a
  // defect rather than a workflow state — and it is still checked, because the
  // rule is that an unsourced normative string is UNRENDERABLE, not that it is
  // unstorable and therefore trusted.
  if (version.formCitation.text.trim() === "" || version.formCitation.source.trim() === "") {
    blockers.push({
      code: "form_citation_unsourced",
      detail: "the act's form citation reached the renderer without its verification tag "
        + "or its source",
      closedBy: "investigate: statutory_act_versions makes this combination unstorable, "
        + "so a row carrying it is a defect upstream of the renderer",
    });
  }

  // The ladder's standing rule: a document that cannot state the level of a
  // decision it carries must not render that decision. Not «renders it without a
  // level» — must not render it.
  const unstatable = version.decisions.filter((d) => d.assuranceLevel === null);
  if (unstatable.length > 0) {
    blockers.push({
      code: "decision_assurance_level_unknown",
      detail: `${unstatable.length} decision block(s) carry an assurance label this `
        + "renderer cannot map to a ladder level",
      closedBy: "extend the ladder mapping in assuranceLevelOf() once the new mechanism "
        + "has a level in hidden-works-content-rules.md",
    });
  }

  // ── the two gates the repository's own open items impose ──────────────────
  if (DBN_RETRIEVAL_RECORD === null) {
    blockers.push({
      code: "dbn_retrieval_record_absent",
      detail: "every VERIFIED_PRIMARY string this act would print rests on a single ДБН "
        + "download with no recorded URL, retrieval date or hash, so its tag is "
        + "asserted and its source is gone",
      closedBy: "commit the ДБН file, or a retrieval record carrying the exact URL, the "
        + "retrieval date and a SHA-256 of the bytes, under technical/requirements/ "
        + "(M0 gate 10; hidden-works-content-rules.md §\"Open items\"), then populate "
        + "DBN_RETRIEVAL_RECORD",
    });
  }

  if (template !== null && template.fieldList === null) {
    blockers.push({
      code: "dodatok_v_field_list_not_committed",
      detail: "the enumerated В.1/В.2 field list — the form's own fields, in the "
        + "standard's order, with the standard's own captions — is committed nowhere "
        + "in this repository, so the form cannot be laid out without typing captions "
        + "from memory",
      closedBy: "commit the В.1/В.2 field list under technical/requirements/ with its "
        + "verification tag and its source, then populate DODATOK_V_TEMPLATE.fieldList "
        + "from it (docs/delivery/test-strategy.md:139-152)",
    });
  }

  // The two null tests are redundant with the blockers above and are written out
  // so the narrowing below is the compiler's and not a comment's: past this line
  // `template` and `template.fieldList` are non-null because the type says so.
  if (blockers.length > 0 || template === null || template.fieldList === null) {
    return { ok: false, blockers };
  }

  // ── everything below is reached only when the form is renderable ──────────
  //
  // THE LAYOUT IS THE FIELD LIST. Every caption below comes from
  // `template.fieldList`, carrying that list's own verification tag and source;
  // there is no literal caption in this function and no place to add one without
  // adding a field to the committed list. That is prohibition E made structural:
  // «never add fields to Додаток В that are not in it», and a caption typed here
  // would be exactly such a field.
  //
  // WHAT GOES UNDER EACH CAPTION IS THE FIELD'S OWN BINDING, also from the
  // committed list. Which field of Додаток В takes the performed quantity and
  // which takes each signatory is part of knowing what the fields are; this
  // function reads that decision rather than making it.
  const registryCheckedOn = version.registryCheckedOn ?? "";
  const fields = [...template.fieldList].sort((a, b) => a.ordinal - b.ordinal);

  function blocksFor(f: FormFieldDefinition): RenderBlock[] {
    switch (f.binding.kind) {
      case "static":
        // The form fills this field with its own fixed text. The caption prints
        // and this database has nothing to place under it.
        return [];

      case "quantity_lines":
        return version.quantityLines.map((q) => fact(
          `${f.fieldId}.line.${q.lineNo}`,
          `${q.printedQuantity} ${q.unitCode}`,
          `progress_entries.quantity#${q.rootProgressEntryId} × ${q.share}`));

      case "decision_blocks": {
        const out: RenderBlock[] = [];
        for (const d of version.decisions) {
          out.push(fact(`${f.fieldId}.${d.requirementOccurrenceId}.criterion`,
            d.acceptanceCriterion,
            `requirement_occurrences.acceptance_criterion#${d.requirementOccurrenceId}`));
          if (d.normRef !== null) {
            out.push(normative(`${f.fieldId}.${d.requirementOccurrenceId}.norm`,
              d.normRef.text, d.normRef.verification, d.normRef.source));
          }
          // Non-null by the `decision_assurance_level_unknown` blocker above,
          // which returned before this point if any level was unstatable. The
          // throw is not defensive programming — it is the one place a future
          // edit that removed that blocker would otherwise print an unlabelled
          // decision, and the standing rule is that such a decision MUST NOT be
          // rendered rather than rendered bare.
          const level = d.assuranceLevel;
          if (level === null) {
            throw new Error(
              "unreachable: a decision with no assurance level must not be rendered");
          }
          // §"Required disclaimers": «Next to every rendered decision or
          // signatory block», on the same page as the actor and the server time.
          out.push(disclaimer(`${f.fieldId}.${d.requirementOccurrenceId}.assurance`,
            `Рівень підтвердження: ${ASSURANCE_LEVEL_LABEL[level]}.`,
            RULE_REQUIRED_DISCLAIMERS, true));
          if (level === "authenticated_acceptance_record") {
            // «and, for level 3 only, immediately after it». THE ORDER IS THE
            // RULE'S, so the denial cannot drift away from the level it denies.
            out.push(disclaimer(`${f.fieldId}.${d.requirementOccurrenceId}.not-a-signature`,
              LEVEL_3_NOT_A_SIGNATURE_TEXT, RULE_REQUIRED_DISCLAIMERS, true));
          }
        }
        if (out.length > 0) {
          // §"Required disclaimers": «Under every generated requirement list»,
          // never collapsed. This is the list, so this is where it goes — and
          // only when a list was actually printed.
          out.push(disclaimer(`${f.fieldId}.dovidkovyi`, DOVIDKOVYI_DISCLAIMER_TEXT,
            RULE_REQUIRED_DISCLAIMERS, true));
          // «and, only on a list that also carries project-sourced items,
          // immediately after it». AT LEAST ONE, which is what «also carries»
          // says — not «strictly mixed»: a list whose every item came from the
          // site's own робоча документація carries project-sourced items too,
          // and it is the list that most needs the note. The ORDER IS THE
          // RULE'S, so the push sits directly after the довідковий one above
          // and cannot drift away from the list it qualifies.
          //
          // The tag is read off the DECISION'S OWN citation, which is the
          // occurrence's `norm_ref_verification` copied at materialisation and
          // carried here by `loadActVersionView` — the renderer decides nothing
          // about provenance, it reports what the frozen occurrence recorded.
          if (version.decisions.some(
            (d) => d.normRef?.verification === "PROJECT_DOCUMENTATION")) {
            out.push(disclaimer(`${f.fieldId}.project-sourced`,
              PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT, RULE_REQUIRED_DISCLAIMERS, true));
          }
        }
        return out;
      }

      case "recorded_fact": {
        // ONE VALUE, NAMED BY WHAT IT IS. An unresolvable value prints nothing
        // rather than an empty string, for the same reason an unfilled
        // signatory slot does: the caption still prints, and the form does not
        // pretend the field was answered.
        switch (f.binding.fact) {
          case "act_date": {
            // The act's own date. `frozenAt` once it is a document, `composedAt`
            // while it is still a draft — a draft render is what the composer
            // shows back, and dating it with the freeze that has not happened
            // would be a lie about the document's age.
            const iso = version.frozenAt ?? version.composedAt;
            const day = iso.slice(0, 10);
            return [fact(`${f.fieldId}.value`, day,
              version.frozenAt === null
                ? "statutory_act_versions.composed_at"
                : "statutory_act_versions.frozen_at")];
          }
          case "builder_organisation_name": {
            // Read off the BUILDER SIGNATORY's frozen organisation name, which
            // is the only place the view carries an organisation at all — and
            // the right place: the form asks whose works were inspected, and
            // that is the party who signs for them. Frozen at composition, so
            // a later rename of the party does not rewrite a printed act.
            const b = version.signatories.find((x) => x.slot === "builder");
            if (b === undefined) return [];
            return [fact(`${f.fieldId}.value`, b.frozenOrganizationName,
              "statutory_act_version_signatories.frozen_organization_name")];
          }
          case "work_item_description":
            // «(найменування робіт)». The contract line the act is FOR, read
            // live off `public.work_items` — a line an act can name belongs to a
            // published contract version and cannot be edited again, which is
            // the guarantee `unit_code` on the quantity lines already rides on.
            return [fact(`${f.fieldId}.value`, version.workItemDescription,
              `work_items.description#${version.workItemId}`)];

          case "construction_object": {
            // «(найменування і місце розташування об'єкта будівництва)» — the
            // caption asks for TWO things, so two blocks rather than one string
            // joined by a separator this renderer would have had to invent. The
            // address is absent from many projects and prints nothing when it
            // is: the caption still prints, and the form does not pretend the
            // field was fully answered.
            //
            // The provenance carries the project version these were read at, the
            // way a signatory's does. It is never absent — see the view's own
            // note: a draft that reported no version would render a provenance
            // the frozen row then contradicts, and the act would diverge from
            // its own hash without anybody touching it.
            const at = `@v${version.sourceProjectVersion}`;
            const blocks = [fact(`${f.fieldId}.name`, version.projectName,
              `projects.name#${version.projectId}${at}`)];
            if (version.projectAddress !== null) {
              blocks.push(fact(`${f.fieldId}.address`, version.projectAddress,
                `projects.address#${version.projectId}${at}`));
            }
            return blocks;
          }
        }
      }

      case "signatory": {
        const slot = f.binding.slot;
        const s = version.signatories.find((x) => x.slot === slot);
        // AN EMPTY SLOT PRINTS ITS CAPTION AND NOTHING ELSE. авторський нагляд is
        // optional at freeze (schema-v0.1.sql:1656-1657; migration 0047 §11
        // item 8), so a two-signatory act is representable and the third field
        // must still print — a form that silently dropped an unfilled field
        // would print as though the form had three fields only sometimes.
        if (s === undefined) return [];
        return [
          // The ROLE from п. 8.4.3.5, which is NOT the form's caption for the
          // field — the caption is `f.caption`, above, from the committed list.
          normative(`${f.fieldId}.role`, SLOT_ROLE_NAME[slot] ?? slot,
            "VERIFIED_PRIMARY", SLOT_ROLE_SOURCE),
          fact(`${f.fieldId}.organization`, s.frozenOrganizationName,
            `${s.frozenOrganizationNameSource}#${s.partyId}@v${s.sourcePartyVersion}`),
          // «посада,номер» — prohibition F names that missing space as the
          // ORIGINAL'S, in a caption of the form. This is the VALUE, not the
          // caption, and it is composed from two recorded columns; nothing here
          // reproduces or repairs the form's own punctuation.
          fact(`${f.fieldId}.person`,
            s.frozenPersonRoleTitle === null
              ? s.frozenPersonName
              : `${s.frozenPersonRoleTitle}, ${s.frozenPersonName}`,
            `party_contacts#${s.partyContactId}@v${s.sourceContactVersion}`),
          // NOTHING FOR THE КВАЛІФІКАЦІЙНИЙ СЕРТИФІКАТ, and no column anywhere to
          // read one from. Allow-list item 10 establishes that технагляд HOLDS
          // one; whether Додаток В has a slot for its серія and номер is NOT
          // established, and prohibition E bans the adjacent «ким видана».
        ];
      }
    }
  }

  const sections: RenderedStatutoryAct["sections"] = [];
  for (const sectionId of ["В.1", "В.2"] as const) {
    const inSection = fields.filter((f) => f.section === sectionId);
    if (inSection.length === 0) continue;
    sections.push({
      sectionId,
      // «В.1» and «В.2» are the section labels allow-list item 3 names in terms
      // — «every field of В.1 and В.2, in the standard's order» — and they carry
      // that item's provenance and no more.
      caption: normative(`section.${sectionId}`, sectionId,
        "VERIFIED_PRIMARY", DBN_SINGLE_FETCH_SOURCE),
      fields: inSection.map((f) => ({
        fieldId: f.fieldId,
        caption: normative(`field.${f.fieldId}`, f.caption, f.verification, f.source),
        blocks: blocksFor(f),
      })),
    });
  }

  // RENDER-LEVEL LABELS, IN THEIR OWN ARRAY SO THEY ARE NOT FIELDS.
  //
  // ADR-005 decision 10 and prohibition G: «the mapping of a Н.14/Н.15 position
  // to form В or form Г is the product's assumption and is labelled as such in
  // the UI and in the render; no source establishes it». `actFormBasis` has only
  // two values, both of which say «the product chose this», so the label is a
  // read of the row and never a claim about the norm.
  //
  // THE WORDING IS NOT SOURCED, AND THAT IS A REPORTED GAP.
  // technical/copy-catalog.csv is this repository's home for Ukrainian product
  // copy and carries NO row for the act render — not this label, not the title,
  // not a disclaimer. The sentence below asserts nothing about the standard; it
  // DENIES that the standard establishes the mapping, which is the same class as
  // «офіційним виданням норми не є». It is still product copy that no reviewer
  // has approved, and the catalog is owed the row.
  const notes: RenderBlock[] = [
    disclaimer("note.form-assumption",
      version.actFormBasis === "product_assumption"
        ? "Відповідність позиції Додатка Н формі акта — припущення продукту, а не вимога норми."
        : "Форму акта обрав користувач; відповідність позиції Додатка Н формі акта нормою не встановлена.",
      "docs/product/hidden-works-content-rules.md prohibition G; ADR-005 decision 10", true),
  ];
  // The hash is taken over the document WITHOUT its own hash field, so it is a
  // digest of the content rather than of a placeholder somebody has to remember
  // to zero out. `hashable` is the whole document minus `contentHash`, built
  // explicitly rather than by rest-destructuring so that a field added to the
  // document but forgotten here is a type error.
  const hashable: Omit<RenderedStatutoryAct, "contentHash"> = {
    statutoryActVersionId: version.statutoryActVersionId,
    status: "frozen",
    actForm: "dodatok_v",
    rendererVersion: RENDERER_VERSION,
    formTemplateKey: template.key,
    formTemplateVersion: template.version,
    formTemplateHash: formTemplateHashOf(template),
    title: normative("title", template.title.text, template.title.verification, template.title.source),
    sections,
    notes,
    pageFooter: disclaimer("page-footer", pageFooterText(registryCheckedOn),
      RULE_REQUIRED_DISCLAIMERS, true),
    pageFooterRepeatsOnEveryPage: true,
  };

  // Re-parsed before it leaves this function, the pattern `requirement_library.list`
  // established: a block that somehow evaded the type system and reached here
  // without a provenance fails loudly instead of printing.
  return {
    ok: true,
    document: renderedStatutoryAct.parse({
      ...hashable, contentHash: sha256Hex(canonicalJson(hashable)),
    }),
  };
}
