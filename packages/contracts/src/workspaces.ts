import { z } from "zod";

export const createWorkspaceRequest = z.object({
  displayName: z.string().trim().min(1).max(200),
  timezone: z.string().trim().min(1).max(64).default("Europe/Kyiv"),
  locale: z.string().trim().min(2).max(16).default("uk-UA"),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequest>;

export interface CreateWorkspaceResponse {
  workspaceId: string;
  membershipId: string;
  role: "owner";
  version: number;
}
