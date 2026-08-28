import { z } from "zod";

export const createProjectRequest = z.object({
  name: z.string().trim().min(1).max(300),
  code: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequest>;

export const projectStatus = z.enum(["draft", "active", "archived"]);
export const fieldCommunicationChannel = z.literal("telegram");
export const configureProjectFieldChannelRequest = z.object({
  channel: fieldCommunicationChannel,
  expectedVersion: z.number().int().positive(),
}).strict();
export const activateProjectRequest = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();
export const projectFieldChannelResponse = z.object({
  projectId: z.string().guid(),
  projectStatus,
  channel: fieldCommunicationChannel.nullable(),
  channelState: z.enum(["unbound", "connected", "active", "unhealthy", "archived"]).nullable(),
  lockedAt: z.string().datetime().nullable(),
  version: z.number().int().positive(),
}).strict();
export type ProjectFieldChannelResponse = z.infer<typeof projectFieldChannelResponse>;

export interface CreateProjectResponse { projectId: string; version: number }

export interface ProjectListRow {
  projectId: string;
  workspaceId: string;
  name: string;
  code: string | null;
}
export interface ProjectsListResponse { projects: ProjectListRow[] }
