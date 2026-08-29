import { z } from "zod";

/**
 * ADR-010: a workspace may author a requirement from its own робоча
 * документація, in a table of its own, alongside the shipped Додаток Н
 * library and without touching it — two different relations, so no row typed
 * here can ever become a line of Н.14 or Н.15. ADR-010 supersedes one clause
 * of ADR-006 decision 4.1 alone (the shipped library is no longer the only
 * rule source in v0.1) and leaves the rest of decision 4 standing.
 *
 * The catalogued operations, all on the member plane
 * (technical/openapi/scope-v0.1.csv). `create` and `archive` are commands,
 * carry an `Idempotency-Key` HEADER, and are governed by one workspace
 * capability, `project_requirements.manage`, held by exactly the roles that
 * hold `requirement_rules.manage`; `list` is a query, carries neither a key
 * nor a request body, and is governed by ACTIVE MEMBERSHIP rather than the
 * capability (`psri_select` admits any active member; catalog corrected
 * 2026-08-28, TODOS 2026-08-27 residual 6 — this header used to claim one
 * capability governed all three):
 *   `project_requirements.create`
 *     POST /v1/workspaces/{workspaceId}/project-requirements
 *   `project_requirements.archive`
 *     POST /v1/project-requirements/{itemId}/archive
 *   `project_requirements.list`
 *     GET /v1/workspaces/{workspaceId}/project-requirements
 *
 * CREATE OR ARCHIVE ONLY. Text and citation are immutable once written
 * (ADR-010 decision 5): a correction is a new item plus an archive of the old
 * one, never an edit — a rule version may already have copied the content,
 * and no edit could reach that copy. That is why there is no update request
 * in this file and none is planned.
 *
 * `verification` IS NOT ON THE CREATE WIRE. It is returned, never accepted:
 * the command chooses the one tag this table may store, and a caller choosing
 * its own is exactly what INV-073 and hidden-works-content-rules.md exist to
 * prevent. On the way OUT it is `z.literal("PROJECT_DOCUMENTATION")` — the one
 * value this table's CHECK admits — not the shared three-value
 * `verificationTag` an earlier version of this file reused (corrected
 * 2026-08-28, TODOS 2026-08-27 residual 8b: a response typed wider than the
 * storable set is a place a reader mistakes the type for the set).
 *
 * The list response is a zod schema and not a plain interface, like
 * `requirementLibraryListResponse` and unlike most responses in this package:
 * it carries the requirement text and its citation, both regulatory-adjacent
 * strings under hidden-works-content-rules.md, so the route parses it before
 * returning and a row that reaches the wire without its verification tag or
 * its source fails loudly at the boundary instead of rendering. The archive
 * response carries neither and stays a plain interface, the same choice
 * `RetireRequirementRuleVersionResponse` makes.
 */

/**
 * ADR-010: a workspace authors a requirement from its own робоча документація.
 * INV-073's source half is on the wire as three mandatory identifying fields
 * rather than one free-text citation: «робоча документація» without a sheet and
 * a drawing number is a word, not a source.
 *
 * verification is NOT on the wire. It is returned, never accepted — the only
 * storable value is PROJECT_DOCUMENTATION and a caller may not choose a tag.
 */
export const createProjectRequirementRequest = z.object({
  projectId: z.string().guid(),
  itemTextUk: z.string().trim().min(1),
  sourceDocument: z.string().trim().min(1),
  sourceSheet: z.string().trim().min(1),
  sourceDrawingNo: z.string().trim().min(1),
  sourceRevision: z.string().trim().min(1).optional(),
}).strict();
export type CreateProjectRequirementRequest =
  z.infer<typeof createProjectRequirementRequest>;

/** Identity is in the path; replay protection is the Idempotency-Key header. */
export const archiveProjectRequirementRequest = z.object({}).strict();
export type ArchiveProjectRequirementRequest =
  z.infer<typeof archiveProjectRequirementRequest>;

export const projectSourcedRequirementItem = z.object({
  itemId: z.string().guid(),
  projectId: z.string().guid(),
  // `.trim().min(1)` — the same chain the create request runs, so the two
  // directions read the same (TODOS 2026-08-27 residual 8a). Storage already
  // guarantees non-blank — migration 0059 §1's btrim CHECKs on all four
  // mandatory columns and the conditional one on source_revision — so this is
  // a second layer over that guarantee, not the only guard; a whitespace-only
  // value would now fail loudly at the boundary instead of parsing on the way
  // out.
  itemTextUk: z.string().trim().min(1),
  sourceDocument: z.string().trim().min(1),
  sourceSheet: z.string().trim().min(1),
  sourceDrawingNo: z.string().trim().min(1),
  sourceRevision: z.string().trim().min(1).nullable(),
  // The LITERAL, not the shared three-value `verificationTag` (TODOS
  // 2026-08-27 residual 8b): the only value this table's CHECK admits is
  // PROJECT_DOCUMENTATION, and a response typed wider than the storable set
  // invites a reader to handle arms that cannot occur. The create wire is
  // unchanged — `verification` is still returned, never accepted. The library
  // item's own schema keeps the shared constant deliberately;
  // ./requirement-library's header records that asymmetry.
  verification: z.literal("PROJECT_DOCUMENTATION"),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type ProjectSourcedRequirementItemResponse =
  z.infer<typeof projectSourcedRequirementItem>;

export const projectRequirementListResponse = z.object({
  items: z.array(projectSourcedRequirementItem),
});
export type ProjectRequirementListResponse =
  z.infer<typeof projectRequirementListResponse>;

export interface ArchiveProjectRequirementResponse {
  itemId: string;
  status: "archived";
  archivedAt: string;
}
