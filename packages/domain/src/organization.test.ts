import { describe, it, expect } from "vitest";
import { buildOrganizationCreation } from "./organization";

const ids = {
  organizationId: "11111111-1111-1111-1111-111111111111",
  legalEntityId: "22222222-2222-2222-2222-222222222222",
  membershipId: "33333333-3333-3333-3333-333333333333",
};
const actor = "44444444-4444-4444-4444-444444444444";

describe("buildOrganizationCreation", () => {
  it("makes the actor the owner and links all rows to the new org", () => {
    const out = buildOrganizationCreation(
      { legalName: "ТОВ Е", displayName: "Е", baseCurrency: "UAH", timezone: "Europe/Kyiv" },
      actor, ids,
    );
    expect(out.organization.id).toBe(ids.organizationId);
    expect(out.organization.status).toBe("trial");
    expect(out.membership.role).toBe("owner");
    expect(out.membership.status).toBe("active");
    expect(out.membership.user_id).toBe(actor);
    expect(out.membership.organization_id).toBe(ids.organizationId);
    expect(out.legalEntity.organization_id).toBe(ids.organizationId);
    expect(out.legalEntity.registration_code).toBe(null);
    expect(out.legalEntity.country_code).toBe("UA");
  });

  it("maps edrpou to legal entity registration_code", () => {
    const out = buildOrganizationCreation(
      { legalName: "ТОВ Test", displayName: "Test", baseCurrency: "UAH", timezone: "Europe/Kyiv", edrpou: "12345678" },
      actor, ids,
    );
    expect(out.legalEntity.registration_code).toBe("12345678");
    expect(out.legalEntity.country_code).toBe("UA");
    expect(out.organization.edrpou).toBe("12345678");
  });

  it("emits an audit intent and an outbox intent for the creation", () => {
    const out = buildOrganizationCreation(
      { legalName: "a", displayName: "b", baseCurrency: "UAH", timezone: "Europe/Kyiv" },
      actor, ids,
    );
    expect(out.audit.action).toBe("organization.created");
    expect(out.audit.object_id).toBe(ids.organizationId);
    expect(out.outbox.topic).toBe("organization.created");
    expect(out.outbox.aggregate_id).toBe(ids.organizationId);
  });
});
