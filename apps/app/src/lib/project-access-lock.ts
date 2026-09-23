import type { Tx } from "@goproceed/database";

/**
 * Serializes every change to one member's grants on one project (DEV-043).
 *
 * `project_access.grant` decides from a plain read whether `project.view` is
 * already held, and `project_access.revoke` decides from a locked read which
 * rows a `project.view` cascade revokes. Neither read sees a row the other
 * inserts or revokes concurrently, so a grant racing a cascade could insert an
 * action capability after the cascade had chosen its rows and leave the member
 * an action with no view (gp-security S1-01, gp-reviewer R1-04; INV-111). Both
 * routes take this transaction advisory lock before their first read of the
 * member's grants; under READ COMMITTED each statement after it sees what the
 * other transaction committed.
 */
export async function projectAccessMemberLock(tx: Tx, projectId: string, memberId: string): Promise<void> {
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`project_access:${projectId.toLowerCase()}:${memberId.toLowerCase()}`]);
}
