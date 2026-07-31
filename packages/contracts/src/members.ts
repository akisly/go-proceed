import { z } from "zod";

export const governanceRole = z.enum(["owner", "admin", "member", "auditor"]);
export type GovernanceRoleValue = z.infer<typeof governanceRole>;

export interface MemberRow {
  memberId: string;
  userId: string;
  role: string;
  status: string;
}
export interface MembersListResponse { members: MemberRow[] }
