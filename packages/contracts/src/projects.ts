import { z } from "zod";

export const createProjectRequest = z.object({
  name: z.string().trim().min(1).max(300),
  code: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequest>;

export interface CreateProjectResponse { projectId: string; version: number }

export interface ProjectListRow {
  projectId: string;
  workspaceId: string;
  name: string;
  code: string | null;
}
export interface ProjectsListResponse { projects: ProjectListRow[] }
