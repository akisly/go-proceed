import { z } from "zod";
import { verificationTag } from "./requirement-library";

/**
 * ADR-010: a workspace may author a requirement from its own робоча
 * документація, in a table of its own, alongside the shipped Додаток Н
 * library and without touching it — two different relations, so no row typed
 * here can ever become a line of Н.14 or Н.15. ADR-010 supersedes one clause
 * of ADR-006 decision 4.1 alone (the shipped library is no longer the only
 * rule source in v0.1) and leaves the rest of decision 4 standing.
 *
 * The catalogued operations, all on the member plane
 * (technical/openapi/scope-v0.1.csv), governed by one workspace capability,
 * `project_requirements.manage`, held by exactly the roles that hold
 * `requirement_rules.manage`. `create` and `archive` are commands and carry an
 * `Idempotency-Key` HEADER; `list` is a query and carries neither a key nor a
 * request body:
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
 * prevent. This module imports `verificationTag` from ./requirement-library
 * and reuses it as-is instead of restating its values, so it accepts whatever
 * that constant accepts, unchanged by anything in this file — including a
 * widening that lands in a parallel change (ADR-010 decision 2) and is not
 * assumed here.
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
  itemTextUk: z.string().min(1),
  sourceDocument: z.string().min(1),
  sourceSheet: z.string().min(1),
  sourceDrawingNo: z.string().min(1),
  sourceRevision: z.string().min(1).nullable(),
  verification: verificationTag,
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
