import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { BlockedReason } from "@goproceed/contracts";

import { DOVIDKOVYI_DISCLAIMER_TEXT, PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT } from "../../lib/required-disclaimers";
import { BlockedReasonsList } from "./blocked-reasons-list";

/**
 * BL-156: the blocked-reasons list prints requirements in the standard's own
 * wording with their citations, so it carries the requirement-list
 * disclaimers of `hidden-works-content-rules.md` §"Required disclaimers":
 * the довідковий text under the list, and the project-sourced note right after
 * it when an item is labelled «за робочою документацією об'єкта».
 *
 * The markup is compared as escaped text: `renderToStaticMarkup` escapes the
 * apostrophes both texts carry.
 */

function escaped(text: string): string {
  return renderToStaticMarkup(<>{text}</>);
}

function reason(overrides: Partial<BlockedReason> = {}): BlockedReason {
  return {
    requirementOccurrenceId: "00000000-0000-4000-8000-000000000001",
    ruleVersionId: "00000000-0000-4000-8000-000000000002",
    workAssignmentId: "00000000-0000-4000-8000-000000000003",
    workStageId: "00000000-0000-4000-8000-000000000004",
    stageKey: "hidden_works",
    workItemId: "00000000-0000-4000-8000-000000000005",
    code: "SUPERVISION_SIGNATURE_MISSING",
    codeVocabularyVersion: "v1",
    missingEvidence: [],
    awaitingApproverRole: "technical_supervision",
    since: "2026-09-20T10:00:00Z",
    blockedValue: null,
    unvaluedQuantity: "1.000000",
    valueAttribution: "unvalued",
    acceptanceCriterion: "Підготовка ніш, каналів та борозен.",
    normRef: { text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY", source: "джерело" },
    ...overrides,
  };
}

const project = reason({
  requirementOccurrenceId: "00000000-0000-4000-8000-000000000011",
  acceptanceCriterion: "Крок стрижнів за кресленням.",
  normRef: { text: "Робоча документація об'єкта", verification: "PROJECT_DOCUMENTATION", source: "РД-014, арк. 12" },
});

describe("BlockedReasonsList disclaimers", () => {
  it("prints the довідковий disclaimer once under the list, and no project note on a seeded list", () => {
    const html = renderToStaticMarkup(<BlockedReasonsList reasons={[reason()]} />);

    expect(html.split(escaped(DOVIDKOVYI_DISCLAIMER_TEXT))).toHaveLength(2);
    expect(html.indexOf(escaped(DOVIDKOVYI_DISCLAIMER_TEXT))).toBeGreaterThan(html.lastIndexOf("</ul>"));
    expect(html).not.toContain(escaped(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT));
  });

  it("prints the project-sourced note immediately after it when an item is project-sourced", () => {
    const html = renderToStaticMarkup(<BlockedReasonsList reasons={[reason(), project]} />);
    const dovidkovyi = html.indexOf(escaped(DOVIDKOVYI_DISCLAIMER_TEXT));
    const note = html.indexOf(escaped(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT));

    expect(dovidkovyi).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(dovidkovyi);
    // Nothing but the closing and opening paragraph tags between the two.
    expect(html.slice(dovidkovyi + escaped(DOVIDKOVYI_DISCLAIMER_TEXT).length, note)).toMatch(/^<\/p><p[^>]*>$/);
  });

  it("never collapses them behind a disclosure", () => {
    // «never collapsed»: a <details> would hide both texts until opened.
    const html = renderToStaticMarkup(<BlockedReasonsList reasons={[reason(), project]} />);

    expect(html).not.toContain("<details");
  });

  it("adds no project note for a reason whose citation was withheld", () => {
    const html = renderToStaticMarkup(<BlockedReasonsList reasons={[reason({ normRef: null })]} />);

    expect(html).toContain(escaped(DOVIDKOVYI_DISCLAIMER_TEXT));
    expect(html).not.toContain(escaped(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT));
  });

  it("prints no disclaimer when there is no list", () => {
    const html = renderToStaticMarkup(<BlockedReasonsList reasons={[]} />);

    expect(html).not.toContain(escaped(DOVIDKOVYI_DISCLAIMER_TEXT));
  });
});
