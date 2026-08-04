import type { CreateOrganizationRequest } from "@goproceed/contracts";

export interface OrganizationRow {
  id: string; legal_name: string; display_name: string; edrpou: string | null;
  base_currency: string; timezone: string; status: "trial"; version: number;
}
export interface LegalEntityRow { id: string; organization_id: string; legal_name: string; registration_code: string | null; country_code: string }
export interface MembershipRow {
  id: string; organization_id: string; user_id: string;
  role: "owner"; status: "active"; all_projects: boolean; version: number;
}
export interface AuditIntent {
  action: string; object_type: string; object_id: string; details: Record<string, unknown>;
}
export interface OutboxIntent {
  topic: string; aggregate_type: string; aggregate_id: string;
  payload_version: number; payload: Record<string, unknown>;
}
export interface OrganizationCreationIds {
  organizationId: string; legalEntityId: string; membershipId: string;
}
export interface OrganizationCreation {
  organization: OrganizationRow; legalEntity: LegalEntityRow;
  membership: MembershipRow; audit: AuditIntent; outbox: OutboxIntent;
}

export function buildOrganizationCreation(
  input: CreateOrganizationRequest,
  actorUserId: string,
  ids: OrganizationCreationIds,
): OrganizationCreation {
  const edrpou = input.edrpou ?? null;
  const organization: OrganizationRow = {
    id: ids.organizationId, legal_name: input.legalName, display_name: input.displayName,
    edrpou, base_currency: input.baseCurrency, timezone: input.timezone, status: "trial", version: 1,
  };
  const legalEntity: LegalEntityRow = {
    id: ids.legalEntityId, organization_id: ids.organizationId,
    legal_name: input.legalName, registration_code: edrpou, country_code: "UA",
  };
  const membership: MembershipRow = {
    id: ids.membershipId, organization_id: ids.organizationId, user_id: actorUserId,
    role: "owner", status: "active", all_projects: true, version: 1,
  };
  return {
    organization, legalEntity, membership,
    audit: {
      action: "organization.created", object_type: "organization",
      object_id: ids.organizationId, details: { legalName: input.legalName },
    },
    outbox: {
      topic: "organization.created", aggregate_type: "organization",
      aggregate_id: ids.organizationId, payload_version: 1,
      payload: { organizationId: ids.organizationId, ownerUserId: actorUserId },
    },
  };
}
