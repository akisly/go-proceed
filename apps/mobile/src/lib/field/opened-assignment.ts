/**
 * The row the foreman tapped, kept in memory for the detail screen's title.
 * Never read from URL params: a deep link could name any text. A cold deep
 * link therefore shows the generic title.
 */
export type OpenedAssignment = { assignmentId: string; description: string; projectName: string };

const opened = new Map<string, OpenedAssignment>();

export function rememberOpenedAssignment(row: OpenedAssignment): void {
  opened.set(row.assignmentId, row);
}

export function openedAssignment(assignmentId: string): OpenedAssignment | null {
  return opened.get(assignmentId) ?? null;
}
