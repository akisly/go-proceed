import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The top link of DEV-089's chain (BL-034; gp-qa Q1): the evidence page hands
 * the zone the evidence read returns to the screen. Every link below it is
 * tested in `src/components/evidence/`; this one rested on a one-line reading,
 * and a page that passed `"Europe/Kyiv"` instead would have survived every
 * other test while today's workspaces are all in Kyiv. No database: the
 * service is mocked.
 */
vi.mock("../src/services/evidence.service", () => ({
  listEvidenceByAssignment: async () => ({
    kind: "ok",
    evidence: {
      workspaceTimezone: "Europe/Warsaw",
      groups: [{
        occurrenceId: null,
        evidence: [{
          evidenceObjectId: "aaaaaaaa-0000-4000-8000-000000000001",
          mediaType: "image/jpeg",
          byteSize: 1_048_576,
          contentHash: "a".repeat(64),
          originalFilename: "IMG_0142.jpg",
          originMethod: "native_camera",
          captureTimeTrust: "device_claimed",
          claimedCaptureTime: null,
          serverReceivedAt: "2026-08-22T09:30:00.000Z",
        }],
      }],
    },
  }),
}));

describe("/assignments/{assignmentId}", () => {
  it("formats the evidence in the zone the read returns, not Kyiv", async () => {
    const { default: AssignmentEvidencePage } = await import("../app/(dash)/assignments/[assignmentId]/page");
    const html = renderToStaticMarkup(await AssignmentEvidencePage({
      params: Promise.resolve({ assignmentId: "99999999-9999-4999-8999-999999999999" }),
    }));
    // 09:30Z in August: 11:30 in Warsaw (GMT+2), 12:30 in Kyiv.
    expect(html).toContain("11:30 GMT+2");
    expect(html).not.toContain("12:30");
  });
});
