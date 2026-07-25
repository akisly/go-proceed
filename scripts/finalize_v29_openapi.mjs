import fs from "node:fs";

const path = new URL("../technical/openapi.yaml", import.meta.url);
const api = JSON.parse(fs.readFileSync(path, "utf8"));
const schemas = api.components.schemas;
const operationById = (operationId) => {
  for (const pathItem of Object.values(api.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.operationId === operationId) return operation;
    }
  }
  return undefined;
};

operationById("recordAcceptance").description =
  "Append a versioned commercial acceptance record against the exact current package and acceptance head. A successor is rejected while any non-cancelled receivable, allocation, payment or retention consequence depends on that head; compensation must be completed explicitly before retry.";
operationById("createReceivable").description =
  "Create one receivable only after serializably locking the package current acceptance head and matching expectedAcceptanceRecordVersion. The receivable remains bound to that immutable record and is never silently retargeted by a later acceptance correction.";
operationById("confirmEstimateImport").description =
  "Publish the verified measured positive-quantity baseline and its single-head work-item lineages. Every availability and reservation calculation spans lineageRootId; unresolved open assignments on a superseded row block activation or require an exact migration plan, preventing double planning across re-imports.";

schemas.CaptureSession.required = Array.from(new Set([
  ...schemas.CaptureSession.required,
  "claimedReportingDate",
]));
schemas.CaptureSession.properties.authorizationDisposition = {
  type: "string",
  enum: [
    "pending", "lease_valid", "pre_invalidation_proven",
    "first_seen_after_invalidation", "recovery_approved", "recovery_rejected",
  ],
};
schemas.CaptureSession.properties.dateReviewState = {
  type: "string",
  enum: ["not_required", "required", "confirmed", "rejected"],
};
schemas.CaptureSession.properties.claimedReportingDate = {
  oneOf: [{ type: "string", format: "date" }, { type: "null" }],
};

schemas.ReportingPeriod.required = Array.from(new Set([
  ...schemas.ReportingPeriod.required,
  "closeCycleNo",
]));
schemas.ReportingPeriod.properties.closeCycleNo = {
  type: "integer",
  minimum: 0,
  description: "Last committed numbered close cycle; zero means the period has never closed.",
};

schemas.PackageDecisionIssue = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "packageVersionId", "decisionSetId", "targetType", "issueType",
    "severity", "reasonCode", "code", "correctionOwnerId", "correctionDueAt",
    "state", "version", "createdAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    packageVersionId: { type: "string", format: "uuid" },
    decisionSetId: { type: "string", format: "uuid" },
    decisionItemId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    targetType: {
      type: "string",
      enum: ["package", "package_line", "requirement_occurrence", "evidence_object"],
    },
    occurrenceId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    evidenceObjectId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    issueType: {
      type: "string",
      enum: [
        "missing_line", "duplicate_line", "invalid_amount", "unmatched_reference",
        "unsupported_decision", "total_mismatch", "correction_required",
      ],
    },
    severity: { type: "string", enum: ["warning", "blocking"] },
    reasonCode: { type: "string", minLength: 1, maxLength: 80 },
    code: { type: "string", minLength: 1, maxLength: 80 },
    comment: {
      oneOf: [{ type: "string", maxLength: 2000 }, { type: "null" }],
    },
    details: { type: "object", additionalProperties: true },
    correctionOwnerId: { type: "string", format: "uuid" },
    correctionDueAt: { type: "string", format: "date-time" },
    state: { type: "string", enum: ["open", "resolved", "cancelled"] },
    version: { type: "integer", minimum: 1 },
    resolutionNote: {
      oneOf: [{ type: "string", minLength: 1, maxLength: 2000 }, { type: "null" }],
    },
    resolvedAt: {
      oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    createdAt: { type: "string", format: "date-time" },
  },
  allOf: [
    {
      if: {
        properties: { targetType: { const: "requirement_occurrence" } },
        required: ["targetType"],
      },
      then: {
        required: ["occurrenceId"],
        properties: {
          occurrenceId: { type: "string", format: "uuid" },
          evidenceObjectId: { type: "null" },
        },
      },
    },
    {
      if: {
        properties: { targetType: { const: "evidence_object" } },
        required: ["targetType"],
      },
      then: {
        required: ["evidenceObjectId"],
        properties: {
          evidenceObjectId: { type: "string", format: "uuid" },
          occurrenceId: { type: "null" },
        },
      },
    },
  ],
};

schemas.PackageDecisionIssueResolutionCommand = {
  type: "object",
  additionalProperties: false,
  required: ["clientOperationId", "expectedVersion", "resolutionNote"],
  properties: {
    clientOperationId: { type: "string", format: "uuid" },
    expectedVersion: { type: "integer", minimum: 1 },
    resolutionNote: { type: "string", minLength: 1, maxLength: 2000 },
  },
};
schemas.PackageDecisionIssueResolutionReceipt = {
  type: "object",
  additionalProperties: false,
  required: ["issue", "receiptHash"],
  properties: {
    issue: { $ref: "#/components/schemas/PackageDecisionIssue" },
    receiptHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
};

const responseHeaders = {
  "X-Request-Id": { $ref: "#/components/headers/RequestId" },
  "Idempotency-Replay-Until": { $ref: "#/components/headers/IdempotencyReplayUntil" },
};
api.paths["/package-decision-issues/{packageDecisionIssueId}/resolution"] = {
  post: {
    tags: ["Packages"],
    operationId: "resolvePackageDecisionIssue",
    summary: "Resolve one normalized package decision issue",
    description: "Resolve one exact-version warning or blocker while its decision set is still pending reconciliation. The command records an actor and note, never deletes the issue, and blocking open issues continue to prevent package reconciliation.",
    "x-release": "Pilot",
    "x-flow-id": "F22",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      {
        name: "packageDecisionIssueId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      { $ref: "#/components/parameters/IdempotencyKey" },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PackageDecisionIssueResolutionCommand" },
        },
      },
    },
    responses: {
      "200": {
        description: "Resolved issue and immutable receipt",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PackageDecisionIssueResolutionReceipt" },
          },
        },
        headers: responseHeaders,
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "409": { $ref: "#/components/responses/Conflict" },
      "422": { $ref: "#/components/responses/Validation" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
    "x-idempotency-class": "standard_30d",
  },
};

// Bounded composite work detail. The first request returns a small page for every
// section; subsequent requests page one named section without inventing endpoints.
const detailSections = [
  "assignments", "quantity_ledger", "evidence_timeline", "requirements",
  "occurrences", "review_history", "baseline_lineage", "package_references",
  "audit_timeline",
];
for (const propertyName of [
  "assignments", "quantityLedger", "evidenceTimeline", "requirements",
  "occurrences", "reviewHistory", "baselineLineage", "packageReferences",
  "auditTimeline",
]) {
  schemas.WorkItemDetail.properties[propertyName].maxItems = 100;
}
schemas.WorkItemDetail.required = Array.from(new Set([
  ...schemas.WorkItemDetail.required,
  "nextCursors",
]));
schemas.WorkItemDetail.properties.nextCursors = {
  type: "object",
  additionalProperties: false,
  required: detailSections,
  properties: Object.fromEntries(detailSections.map((name) => [
    name,
    { oneOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
  ])),
};
const workDetailOperation = operationById("getWorkItemDetail");
for (const parameter of [
  {
    name: "section",
    in: "query",
    schema: { type: "string", enum: detailSections },
    description: "When present, continue only this section; all other section arrays are empty.",
  },
  { $ref: "#/components/parameters/Cursor" },
  { $ref: "#/components/parameters/Limit" },
]) {
  if (!workDetailOperation.parameters.some((item) =>
    item.$ref === parameter.$ref ||
    (parameter.name && item.name === parameter.name && item.in === parameter.in)
  )) workDetailOperation.parameters.push(parameter);
}
workDetailOperation.description =
  "Return a bounded, scope-filtered work-item composite. Without section, every section contains its first page of at most 100 rows and nextCursors exposes continuation. With section/cursor, only that section is paged and all other arrays are empty. Authorization and tenant scope are applied before counts, ordering and cursor construction.";
schemas.ReadinessBlocker.required = Array.from(new Set([
  ...schemas.ReadinessBlocker.required,
  "ownerUserId", "dueAt",
]));
for (const propertyName of ["acceptanceRecordIds", "receivableIds", "paymentIds"]) {
  schemas.PackageReference.properties[propertyName] = {
    type: "array",
    maxItems: 100,
    items: { type: "string", format: "uuid" },
    uniqueItems: true,
  };
}
schemas.PackageReference.required = Array.from(new Set([
  ...schemas.PackageReference.required,
  "acceptanceRecordIds", "receivableIds", "paymentIds",
]));

// Strategy schemas carry lifecycle semantics, not only a discriminator.
Object.assign(schemas.CalendarOccurrenceStrategy.properties, {
  startPolicy: { type: "string", const: "assignment_start_at_or_after_anchor" },
  endPolicy: { type: "string", const: "earlier_of_assignment_due_or_completion" },
  lateTriggerPolicy: { type: "string", const: "materialize_with_original_due_while_assignment_open" },
});
schemas.CalendarOccurrenceStrategy.required = Array.from(new Set([
  ...schemas.CalendarOccurrenceStrategy.required,
  "startPolicy", "endPolicy", "lateTriggerPolicy",
]));
schemas.MaterialBatchOccurrenceStrategy.properties.outOfOrderPolicy = {
  type: "string",
  const: "append_once_by_normalized_batch_key",
};
schemas.MaterialBatchOccurrenceStrategy.required = Array.from(new Set([
  ...schemas.MaterialBatchOccurrenceStrategy.required,
  "outOfOrderPolicy",
]));
Object.assign(schemas.QuantityThresholdOccurrenceStrategy.properties, {
  crossingPolicy: { type: "string", const: "first_authoritative_upward_crossing" },
  correctionPolicy: { type: "string", const: "never_delete_materialized_threshold" },
});
schemas.QuantityThresholdOccurrenceStrategy.required = Array.from(new Set([
  ...schemas.QuantityThresholdOccurrenceStrategy.required,
  "crossingPolicy", "correctionPolicy",
]));
operationById("declareOccurrenceTrigger").description =
  "Idempotently materialize a canonical trigger against the assignment's frozen rule version. A field actor may declare only a material batch for an own active assignment; calendar triggers are scheduler-owned and quantity-threshold triggers are emitted by the authoritative quantity transaction, which recomputes the threshold instead of trusting request values. Replays and out-of-order inputs reuse the canonical trigger key. A late calendar trigger materializes with its original due date only while the assignment is open; terminal-assignment input is rejected. Quantity correction never deletes a threshold obligation that was historically materialized.";
schemas.RequirementOccurrence.required = Array.from(new Set([
  ...schemas.RequirementOccurrence.required,
  "requirementId", "workItemId", "locationId", "occurrenceKey",
  "occurrenceType", "triggerSnapshot", "materialBatch", "quantityFrom", "quantityTo",
]));
Object.assign(schemas.RequirementOccurrence.properties, {
  requirementId: { type: "string", format: "uuid" },
  workItemId: { type: "string", format: "uuid" },
  locationId: { type: "string", format: "uuid" },
  occurrenceKey: { type: "string", minLength: 1, maxLength: 300 },
  occurrenceType: {
    type: "string",
    enum: ["once", "date", "batch", "quantity_threshold"],
  },
  triggerSnapshot: { type: "object", additionalProperties: true },
  materialBatch: {
    oneOf: [{ type: "string", minLength: 1, maxLength: 200 }, { type: "null" }],
  },
  quantityFrom: {
    oneOf: [
      { type: "string", pattern: "^-?[0-9]+(?:\\.[0-9]{1,6})?$" },
      { type: "null" },
    ],
  },
  quantityTo: {
    oneOf: [
      { type: "string", pattern: "^-?[0-9]+(?:\\.[0-9]{1,6})?$" },
      { type: "null" },
    ],
  },
});
schemas.RequirementOccurrence.allOf = [
  {
    if: {
      properties: { occurrenceType: { enum: ["once", "date"] } },
      required: ["occurrenceType"],
    },
    then: {
      properties: {
        materialBatch: { type: "null" },
        quantityFrom: { type: "null" },
        quantityTo: { type: "null" },
      },
    },
  },
  {
    if: {
      properties: { occurrenceType: { const: "batch" } },
      required: ["occurrenceType"],
    },
    then: {
      properties: {
        materialBatch: { type: "string", minLength: 1, maxLength: 200 },
        quantityFrom: { type: "null" },
        quantityTo: { type: "null" },
      },
    },
  },
  {
    if: {
      properties: { occurrenceType: { const: "quantity_threshold" } },
      required: ["occurrenceType"],
    },
    then: {
      properties: {
        materialBatch: { type: "null" },
        quantityFrom: { type: "string", pattern: "^-?[0-9]+(?:\\.[0-9]{1,6})?$" },
        quantityTo: { type: "string", pattern: "^-?[0-9]+(?:\\.[0-9]{1,6})?$" },
      },
    },
  },
];
schemas.OccurrenceTriggerReceipt = {
  type: "object",
  additionalProperties: false,
  required: [
    "triggerEventId", "clientOperationId", "triggerKey",
    "triggerHash", "replayed", "occurrence",
  ],
  properties: {
    triggerEventId: { type: "string", format: "uuid" },
    clientOperationId: { type: "string", format: "uuid" },
    triggerKey: { type: "string", minLength: 1, maxLength: 300 },
    triggerHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    replayed: { type: "boolean" },
    occurrence: { $ref: "#/components/schemas/RequirementOccurrence" },
  },
};
operationById("declareOccurrenceTrigger")
  .responses["201"].content["application/json"].schema = {
    $ref: "#/components/schemas/OccurrenceTriggerReceipt",
  };

schemas.WorkAssignmentImpactPreview = {
  type: "object",
  additionalProperties: false,
  required: ["preview", "rows"],
  properties: {
    preview: { $ref: "#/components/schemas/ImpactPreview" },
    rows: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "clientOperationId", "workItemId", "lineageRootId", "lineageVersion",
          "requestedQuantity", "contractQuantityAcrossLineage",
          "plannedOpenAcrossLineage", "performedAcrossLineage",
          "availableAcrossLineage", "occurrenceCount", "state", "codes",
        ],
        properties: {
          clientOperationId: { type: "string", format: "uuid" },
          workItemId: { type: "string", format: "uuid" },
          lineageRootId: { type: "string", format: "uuid" },
          lineageVersion: { type: "integer", minimum: 1 },
          requestedQuantity: {
            type: "string",
            pattern: "^(?:0\\.[0-9]*[1-9][0-9]*|[1-9][0-9]*(?:\\.[0-9]{1,6})?)$",
          },
          contractQuantityAcrossLineage: {
            type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,6})?$",
          },
          plannedOpenAcrossLineage: {
            type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,6})?$",
          },
          performedAcrossLineage: {
            type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,6})?$",
          },
          availableAcrossLineage: {
            type: "string", pattern: "^[0-9]+(?:\\.[0-9]{1,6})?$",
          },
          occurrenceCount: { type: "integer", minimum: 0 },
          state: { type: "string", enum: ["valid", "warning", "blocked"] },
          codes: {
            type: "array",
            items: { type: "string", maxLength: 80 },
            uniqueItems: true,
          },
        },
      },
    },
  },
};
operationById("previewWorkAssignments")
  .responses["200"].content["application/json"].schema = {
    $ref: "#/components/schemas/WorkAssignmentImpactPreview",
  };
operationById("previewWorkAssignments").description =
  "Persist a hash-bound preview and return typed per-row allocation results. Contract, open planned and performed quantities are recomputed across lineageRootId, so a superseding BOQ row cannot expose the old head's quantity again. Each row also returns deterministic occurrence count, scope/reference state and stable codes.";

// A security exception disposition and an accounting/reporting date are separate
// decisions and therefore use separate commands and records.
schemas.CaptureAuthorizationResolutionCommand = {
  type: "object",
  additionalProperties: false,
  required: [
    "clientOperationId", "captureVersion", "decision",
    "reasonCode", "evidenceSummary", "recentAuthProof",
  ],
  properties: {
    clientOperationId: { type: "string", format: "uuid" },
    captureVersion: { type: "integer", minimum: 1 },
    decision: { type: "string", enum: ["release_to_scan_and_review", "reject"] },
    reasonCode: { type: "string", minLength: 1, maxLength: 80 },
    evidenceSummary: { type: "string", minLength: 1, maxLength: 2000 },
    recentAuthProof: { type: "string", minLength: 16, maxLength: 2048, writeOnly: true },
  },
};
schemas.CaptureAuthorizationResolutionReceipt = {
  type: "object",
  additionalProperties: false,
  required: [
    "captureSessionId", "captureVersion", "decision",
    "authorizationDisposition", "resultingState", "receiptHash",
  ],
  properties: {
    captureSessionId: { type: "string", format: "uuid" },
    captureVersion: { type: "integer", minimum: 1 },
    decision: { type: "string", enum: ["release_to_scan_and_review", "reject"] },
    authorizationDisposition: {
      type: "string",
      enum: ["recovery_approved", "recovery_rejected"],
    },
    resultingState: { type: "string", enum: ["scanning", "terminal_failed"] },
    receiptHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
  allOf: [
    {
      if: {
        properties: { decision: { const: "release_to_scan_and_review" } },
        required: ["decision"],
      },
      then: {
        properties: {
          authorizationDisposition: { const: "recovery_approved" },
          resultingState: { const: "scanning" },
        },
      },
    },
    {
      if: { properties: { decision: { const: "reject" } }, required: ["decision"] },
      then: {
        properties: {
          authorizationDisposition: { const: "recovery_rejected" },
          resultingState: { const: "terminal_failed" },
        },
      },
    },
  ],
};
operationById("resolveCaptureAuthorizationException").description =
  "Resolve one exact quarantined first receipt after independent Security Admin review. The command requires a minimized evidence summary and recent authentication, appends one immutable disposition and either releases the object to scanning or rejects it. It never proves the client capture time and never sets the authoritative reporting date; that remains a separate guarded command.";

schemas.ReportingDateConfirmationCommand = {
  type: "object",
  additionalProperties: false,
  required: [
    "clientOperationId", "captureVersion",
    "claimedOccurredOn", "decision", "reasonCode",
  ],
  properties: {
    clientOperationId: { type: "string", format: "uuid" },
    captureVersion: { type: "integer", minimum: 1 },
    claimedOccurredOn: { type: "string", format: "date" },
    decision: { type: "string", enum: ["confirm", "reject"] },
    authoritativeReportingDate: {
      oneOf: [{ type: "string", format: "date" }, { type: "null" }],
    },
    reasonCode: { type: "string", minLength: 1, maxLength: 80 },
    comment: { oneOf: [{ type: "string", maxLength: 2000 }, { type: "null" }] },
  },
  allOf: [
    {
      if: { properties: { decision: { const: "confirm" } }, required: ["decision"] },
      then: {
        required: ["authoritativeReportingDate"],
        properties: { authoritativeReportingDate: { type: "string", format: "date" } },
      },
    },
    {
      if: { properties: { decision: { const: "reject" } }, required: ["decision"] },
      then: {
        properties: { authoritativeReportingDate: { type: "null" } },
      },
    },
  ],
};
schemas.ReportingDateConfirmationReceipt = {
  type: "object",
  additionalProperties: false,
  required: [
    "captureSessionId", "decision", "reportingDate",
    "dateReviewState", "affectedQuantityEntryIds", "receiptHash",
  ],
  properties: {
    captureSessionId: { type: "string", format: "uuid" },
    decision: { type: "string", enum: ["confirm", "reject"] },
    reportingDate: { oneOf: [{ type: "string", format: "date" }, { type: "null" }] },
    dateReviewState: { type: "string", enum: ["confirmed", "rejected"] },
    affectedQuantityEntryIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
      uniqueItems: true,
    },
    receiptHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
  allOf: [
    {
      if: { properties: { decision: { const: "confirm" } }, required: ["decision"] },
      then: {
        properties: {
          reportingDate: { type: "string", format: "date" },
          dateReviewState: { const: "confirmed" },
        },
      },
    },
    {
      if: { properties: { decision: { const: "reject" } }, required: ["decision"] },
      then: {
        properties: {
          reportingDate: { type: "null" },
          dateReviewState: { const: "rejected" },
        },
      },
    },
  ],
};

// Decision-item outcome is financial-line-only. Exact requirement/evidence targets
// live in the separate many-issue aggregate.
const issueInputSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["targetType", "reasonCode", "correctionOwnerId", "correctionDueAt"],
  properties: {
    targetType: {
      type: "string",
      enum: ["package_line", "requirement_occurrence", "evidence_object"],
    },
    occurrenceId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    evidenceObjectId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    reasonCode: { type: "string", minLength: 1, maxLength: 80 },
    comment: { oneOf: [{ type: "string", maxLength: 2000 }, { type: "null" }] },
    correctionOwnerId: { type: "string", format: "uuid" },
    correctionDueAt: { type: "string", format: "date-time" },
  },
  allOf: [
    {
      if: { properties: { targetType: { const: "package_line" } }, required: ["targetType"] },
      then: {
        properties: { occurrenceId: { type: "null" }, evidenceObjectId: { type: "null" } },
      },
    },
    {
      if: { properties: { targetType: { const: "requirement_occurrence" } }, required: ["targetType"] },
      then: {
        required: ["occurrenceId"],
        properties: {
          occurrenceId: { type: "string", format: "uuid" },
          evidenceObjectId: { type: "null" },
        },
      },
    },
    {
      if: { properties: { targetType: { const: "evidence_object" } }, required: ["targetType"] },
      then: {
        required: ["evidenceObjectId"],
        properties: {
          occurrenceId: { type: "null" },
          evidenceObjectId: { type: "string", format: "uuid" },
        },
      },
    },
  ],
});
const decisionInput = schemas.PackageLineDecisionBatchCreate.properties.items.items;
decisionInput.properties.issues.items = issueInputSchema();
for (const conditional of decisionInput.allOf) {
  const issueSchema = conditional.then?.properties?.issues?.items;
  if (issueSchema) conditional.then.properties.issues.items = issueInputSchema();
}

Object.assign(schemas.PackageDecisionIssue.properties, {
  resolvedBy: {
    oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
  },
  cancelledAt: {
    oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
  },
  cancellationReasonCode: {
    oneOf: [{ type: "string", minLength: 1, maxLength: 80 }, { type: "null" }],
  },
});
schemas.PackageDecisionIssue.required = Array.from(new Set([
  ...schemas.PackageDecisionIssue.required,
  "decisionItemId", "occurrenceId", "evidenceObjectId", "comment", "details",
  "resolvedBy", "resolutionNote", "resolvedAt",
  "cancelledAt", "cancellationReasonCode",
]));
schemas.PackageDecisionIssue.allOf = [
  {
    if: { properties: { targetType: { const: "package" } }, required: ["targetType"] },
    then: {
      properties: {
        decisionItemId: { type: "null" },
        occurrenceId: { type: "null" },
        evidenceObjectId: { type: "null" },
      },
    },
  },
  {
    if: { properties: { targetType: { const: "package_line" } }, required: ["targetType"] },
    then: {
      properties: {
        decisionItemId: { type: "string", format: "uuid" },
        occurrenceId: { type: "null" },
        evidenceObjectId: { type: "null" },
      },
    },
  },
  {
    if: { properties: { targetType: { const: "requirement_occurrence" } }, required: ["targetType"] },
    then: {
      properties: {
        occurrenceId: { type: "string", format: "uuid" },
        evidenceObjectId: { type: "null" },
      },
    },
  },
  {
    if: { properties: { targetType: { const: "evidence_object" } }, required: ["targetType"] },
    then: {
      properties: {
        occurrenceId: { type: "null" },
        evidenceObjectId: { type: "string", format: "uuid" },
      },
    },
  },
  {
    if: { properties: { state: { const: "open" } }, required: ["state"] },
    then: {
      properties: {
        resolvedBy: { type: "null" }, resolutionNote: { type: "null" },
        resolvedAt: { type: "null" }, cancelledAt: { type: "null" },
        cancellationReasonCode: { type: "null" },
      },
    },
  },
  {
    if: { properties: { state: { const: "resolved" } }, required: ["state"] },
    then: {
      properties: {
        resolvedBy: { type: "string", format: "uuid" },
        resolutionNote: { type: "string", minLength: 1, maxLength: 2000 },
        resolvedAt: { type: "string", format: "date-time" },
        cancelledAt: { type: "null" }, cancellationReasonCode: { type: "null" },
      },
    },
  },
  {
    if: { properties: { state: { const: "cancelled" } }, required: ["state"] },
    then: {
      properties: {
        resolvedBy: { type: "null" }, resolutionNote: { type: "null" },
        resolvedAt: { type: "null" },
        cancelledAt: { type: "string", format: "date-time" },
        cancellationReasonCode: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
  },
];

// Offboarding dependencies may be organization-scoped (integration owner) or
// project-scoped. The discriminator makes this explicit instead of inventing a
// fake project for an organization-level responsibility.
const offboardingProjectTypes = [
  "work_assignment", "review_task_assignee", "review_task_escalation",
  "evidence_request", "package_decision_issue", "approval_responsibility",
  "offline_authorization_lease", "project_scope",
];
schemas.OffboardingResolution.required =
  schemas.OffboardingResolution.required.filter((name) => name !== "projectId");
schemas.OffboardingResolution.properties.resolution.enum =
  schemas.OffboardingResolution.properties.resolution.enum.filter(
    (value) => value !== "retain_system_owner"
  );
schemas.OffboardingResolution.properties.projectId = {
  oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
};
schemas.OffboardingResolution.allOf = [
  {
    if: {
      properties: { resourceType: { enum: offboardingProjectTypes } },
      required: ["resourceType"],
    },
    then: {
      required: ["projectId"],
      properties: { projectId: { type: "string", format: "uuid" } },
    },
  },
  {
    if: {
      properties: { resourceType: { const: "integration_connection" } },
      required: ["resourceType"],
    },
    then: {
      required: ["projectId"],
      properties: {
        projectId: { type: "null" },
      },
    },
  },
  {
    if: {
      properties: { resolution: { const: "block_revoke" } },
      required: ["resolution"],
    },
    then: {
      properties: {
        replacementUserId: { type: "null" },
        offlineCapturePolicy: { type: "null" },
      },
    },
  },
  {
    if: {
      properties: { resolution: { const: "reassign" } },
      required: ["resolution"],
    },
    then: {
      required: ["replacementUserId"],
      properties: {
        resourceType: {
          enum: [
            "work_assignment", "review_task_assignee", "review_task_escalation",
            "evidence_request", "package_decision_issue", "approval_responsibility",
          ],
        },
        replacementUserId: { type: "string", format: "uuid" },
      },
    },
  },
  {
    if: {
      properties: {
        resolution: { const: "reassign" },
        resourceType: { const: "work_assignment" },
      },
      required: ["resolution", "resourceType"],
    },
    then: {
      required: ["offlineCapturePolicy"],
      properties: {
        offlineCapturePolicy: {
          type: "string",
          enum: [
            "quarantine_first_seen_after_invalidation",
            "reject_first_seen_after_invalidation",
          ],
        },
      },
    },
  },
  {
    if: {
      properties: {
        resolution: { const: "reassign" },
        resourceType: {
          enum: [
            "review_task_assignee", "review_task_escalation", "evidence_request",
            "package_decision_issue", "approval_responsibility",
          ],
        },
      },
      required: ["resolution", "resourceType"],
    },
    then: { properties: { offlineCapturePolicy: { type: "null" } } },
  },
  {
    if: {
      properties: { resolution: { const: "transfer_admin" } },
      required: ["resolution"],
    },
    then: {
      required: ["replacementUserId"],
      properties: {
        resourceType: { const: "integration_connection" },
        replacementUserId: { type: "string", format: "uuid" },
        offlineCapturePolicy: { type: "null" },
      },
    },
  },
  {
    if: {
      properties: { resolution: { const: "invalidate_lease" } },
      required: ["resolution"],
    },
    then: {
      properties: {
        resourceType: { const: "offline_authorization_lease" },
        replacementUserId: { type: "null" },
        offlineCapturePolicy: { type: "null" },
      },
    },
  },
  {
    if: {
      properties: { resolution: { const: "remove_scope" } },
      required: ["resolution"],
    },
    then: {
      properties: {
        resourceType: { const: "project_scope" },
        replacementUserId: { type: "null" },
        offlineCapturePolicy: { type: "null" },
      },
    },
  },
];
schemas.OffboardingDependency.required =
  schemas.OffboardingDependency.required.filter((name) => name !== "projectId");
schemas.OffboardingDependency.properties.projectId = {
  oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
};
schemas.OffboardingDependency.allOf = [
  {
    if: {
      properties: { resourceType: { enum: offboardingProjectTypes } },
      required: ["resourceType"],
    },
    then: {
      required: ["projectId"],
      properties: { projectId: { type: "string", format: "uuid" } },
    },
  },
  {
    if: {
      properties: { resourceType: { const: "integration_connection" } },
      required: ["resourceType"],
    },
    then: {
      required: ["projectId"],
      properties: { projectId: { type: "null" } },
    },
  },
];

// A staged plan must be resumable from its persisted rows, not only from a
// freshly recomputed membership-wide dependency scan.
schemas.MemberOffboardingPlanItem = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "planId", "projectId", "resourceType", "resourceId",
    "expectedVersion", "state", "resolution", "codes", "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    planId: { type: "string", format: "uuid" },
    projectId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    resourceType: { $ref: "#/components/schemas/OffboardingResourceType" },
    resourceId: { type: "string", format: "uuid" },
    expectedVersion: { type: "integer", minimum: 1 },
    state: { type: "string", enum: ["unresolved", "resolved", "blocked", "stale"] },
    resolution: {
      oneOf: [
        { $ref: "#/components/schemas/OffboardingResolution" },
        { type: "null" },
      ],
    },
    codes: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 80 },
      uniqueItems: true,
    },
    updatedAt: { type: "string", format: "date-time" },
  },
  allOf: [
    {
      if: {
        properties: { resourceType: { enum: offboardingProjectTypes } },
        required: ["resourceType"],
      },
      then: { properties: { projectId: { type: "string", format: "uuid" } } },
    },
    {
      if: {
        properties: { resourceType: { const: "integration_connection" } },
        required: ["resourceType"],
      },
      then: { properties: { projectId: { type: "null" } } },
    },
    {
      if: {
        properties: { state: { enum: ["unresolved", "stale"] } },
        required: ["state"],
      },
      then: { properties: { resolution: { type: "null" } } },
    },
    {
      if: { properties: { state: { const: "resolved" } }, required: ["state"] },
      then: {
        properties: {
          resolution: { $ref: "#/components/schemas/OffboardingResolution" },
        },
      },
    },
    {
      if: { properties: { state: { const: "blocked" } }, required: ["state"] },
      then: {
        properties: {
          resolution: {
            allOf: [
              { $ref: "#/components/schemas/OffboardingResolution" },
              {
                type: "object",
                properties: { resolution: { const: "block_revoke" } },
                required: ["resolution"],
              },
            ],
          },
        },
      },
    },
  ],
};
schemas.MemberOffboardingPlanItemPage = {
  type: "object",
  additionalProperties: false,
  required: [
    "planId", "planVersion", "dependencyHash", "totalCount", "data", "nextCursor",
  ],
  properties: {
    planId: { type: "string", format: "uuid" },
    planVersion: { type: "integer", minimum: 1 },
    dependencyHash: {
      oneOf: [
        { type: "string", pattern: "^[a-f0-9]{64}$" },
        { type: "null" },
      ],
    },
    totalCount: { type: "integer", minimum: 0 },
    data: {
      type: "array",
      maxItems: 500,
      items: { $ref: "#/components/schemas/MemberOffboardingPlanItem" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/member-offboarding-plans/{offboardingPlanId}/items"] = {
  get: {
    tags: ["Access"],
    operationId: "listMemberOffboardingPlanItems",
    summary: "List persisted staged offboarding rows",
    description:
      "Page the exact persisted rows, saved resolutions, stale markers and blocker choices of one organization-level offboarding plan. Authorization is applied before ordering and cursor construction; this read never substitutes a fresh dependency scan for the versioned plan.",
    "x-release": "Pilot",
    "x-flow-id": "F14",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      { $ref: "#/components/parameters/OffboardingPlanId" },
      { $ref: "#/components/parameters/Cursor" },
      { $ref: "#/components/parameters/Limit" },
    ],
    responses: {
      "200": {
        description: "Version-bound persisted offboarding plan item page",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/MemberOffboardingPlanItemPage" },
          },
        },
        headers: {
          "X-Request-Id": { $ref: "#/components/headers/RequestId" },
        },
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "409": { $ref: "#/components/responses/Conflict" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
  },
};

// Review undo is a correction receipt that reopens work. The eventual new
// approve/return is the actual review-decision lineage successor.
schemas.ReviewDecision.required = Array.from(new Set([
  ...schemas.ReviewDecision.required,
  "supersedesDecisionId", "lineageRootId", "lineageVersion", "isCurrent",
]));
Object.assign(schemas.ReviewDecision.properties, {
  supersedesDecisionId: {
    oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
  },
  lineageRootId: { type: "string", format: "uuid" },
  lineageVersion: { type: "integer", minimum: 1 },
  isCurrent: { type: "boolean" },
});
schemas.ReviewDecisionCorrectionReceipt = {
  type: "object",
  additionalProperties: false,
  required: [
    "correctionId", "invalidatedDecisionId", "lineageRootId",
    "reopenedCaptureVersion", "captureSessionId", "resultingCaptureState",
    "reviewTaskId", "receiptHash",
  ],
  properties: {
    correctionId: { type: "string", format: "uuid" },
    invalidatedDecisionId: { type: "string", format: "uuid" },
    lineageRootId: { type: "string", format: "uuid" },
    reopenedCaptureVersion: { type: "integer", minimum: 1 },
    captureSessionId: { type: "string", format: "uuid" },
    resultingCaptureState: { type: "string", const: "pending_review" },
    reviewTaskId: { type: "string", format: "uuid" },
    receiptHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
};
operationById("correctReviewDecision").description =
  "Inside the bounded safe window, append one immutable correction receipt, mark the exact current review decision non-current as a projection change, reopen the capture and create one new review task. No replacement approve/return is fabricated by this command. The later decideCaptureSession call appends the actual lineage successor. Any package claim, acceptance, successor capture, stale version or SoD violation blocks this shortcut and requires the relevant business compensation.";
operationById("decideCaptureSession").description =
  "Append approve or structured return. For a first review, create the lineage root; after a guarded correction receipt, automatically link the new decision as the successor of the invalidated prior head. The command is replay-safe, checks the exact capture version and separation of duties, and returns lineage identity.";

const numberingOperation = operationById("retireNumberingSeries");
numberingOperation.summary = "Retire an unreferenced numbering series";
numberingOperation.description =
  "Retire an active stable series, whether unused or previously used, only when no active contract terms select it and no package reservation is pending. Issued or voided numbers and nextSequence remain immutable; a formatting change always creates a new series key.";

// Management surfaces must be reconstructible after navigation. Commands that
// target invitations, transfers, shares or numbering series therefore have
// bounded read-back collections instead of depending on a one-time receipt.
schemas.InvitationSummary = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "email", "role", "allProjects", "projectScopes",
    "state", "expiresAt", "acceptedAt", "createdAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email", maxLength: 254 },
    role: { $ref: "#/components/schemas/AssignableTenantRole" },
    allProjects: { type: "boolean" },
    projectScopes: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/ProjectAccessScope" },
    },
    state: {
      type: "string",
      enum: ["draft", "queued", "sent", "accepted", "expired", "revoked", "delivery_failed"],
    },
    expiresAt: { type: "string", format: "date-time" },
    acceptedAt: {
      oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    createdAt: { type: "string", format: "date-time" },
  },
};
schemas.InvitationSummaryPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/InvitationSummary" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/invitations"].get = {
  tags: ["Access"],
  operationId: "listInvitations",
  summary: "List scoped organization invitations",
  description:
    "Return a bounded, scope-filtered invitation register so authorized administrators can safely reissue or revoke an unused capability after navigation or response loss. Token hashes, raw tokens and unrelated organizations never appear.",
  "x-release": "Pilot",
  "x-flow-id": "F14",
  parameters: [
    { $ref: "#/components/parameters/RequestId" },
    { $ref: "#/components/parameters/OrgId" },
    {
      name: "state",
      in: "query",
      schema: {
        type: "string",
        enum: ["draft", "queued", "sent", "accepted", "expired", "revoked", "delivery_failed"],
      },
    },
    { $ref: "#/components/parameters/Cursor" },
    { $ref: "#/components/parameters/Limit" },
  ],
  responses: {
    "200": {
      description: "Authorized invitation register page",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/InvitationSummaryPage" },
        },
      },
      headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    default: { $ref: "#/components/responses/Unexpected" },
  },
};

schemas.OwnershipTransferSummary = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "currentOwnerUserId", "successorUserId", "state",
    "requestedAt", "expiresAt", "completedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    currentOwnerUserId: { type: "string", format: "uuid" },
    successorUserId: { type: "string", format: "uuid" },
    state: {
      type: "string",
      enum: ["requested", "successor_confirmed", "completed", "cancelled", "expired"],
    },
    requestedAt: { type: "string", format: "date-time" },
    expiresAt: { type: "string", format: "date-time" },
    completedAt: {
      oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
  },
};
schemas.OwnershipTransferSummaryPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/OwnershipTransferSummary" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/ownership-transfers"].get = {
  tags: ["Access"],
  operationId: "listOwnershipTransfers",
  summary: "List visible ownership transfers",
  description:
    "Return current and historical two-party transfers visible to the current owner, named successor or authorized security administrator. Scope is enforced before state filters and cursor construction.",
  "x-release": "GA",
  "x-flow-id": "F14",
  parameters: [
    { $ref: "#/components/parameters/RequestId" },
    { $ref: "#/components/parameters/OrgId" },
    {
      name: "state",
      in: "query",
      schema: {
        type: "string",
        enum: ["requested", "successor_confirmed", "completed", "cancelled", "expired"],
      },
    },
    { $ref: "#/components/parameters/Cursor" },
    { $ref: "#/components/parameters/Limit" },
  ],
  responses: {
    "200": {
      description: "Visible ownership transfer page",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/OwnershipTransferSummaryPage" },
        },
      },
      headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    default: { $ref: "#/components/responses/Unexpected" },
  },
};

schemas.ExternalShareSummary = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "resourceType", "packageVersionId", "variationVersionId",
    "state", "permissions", "otpRequired", "expiresAt", "revokedAt", "createdAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    resourceType: { type: "string", enum: ["package", "variation"] },
    packageVersionId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    variationVersionId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    state: {
      type: "string",
      enum: ["created", "active", "otp_challenged", "opened", "decided", "expired", "revoked", "locked"],
    },
    permissions: {
      type: "array",
      minItems: 1,
      items: { type: "string", enum: ["read", "comment", "decide", "download"] },
      uniqueItems: true,
    },
    otpRequired: { type: "boolean" },
    expiresAt: { type: "string", format: "date-time" },
    revokedAt: {
      oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    createdAt: { type: "string", format: "date-time" },
  },
  allOf: [
    {
      if: { properties: { resourceType: { const: "package" } }, required: ["resourceType"] },
      then: {
        properties: {
          packageVersionId: { type: "string", format: "uuid" },
          variationVersionId: { type: "null" },
        },
      },
    },
    {
      if: { properties: { resourceType: { const: "variation" } }, required: ["resourceType"] },
      then: {
        properties: {
          packageVersionId: { type: "null" },
          variationVersionId: { type: "string", format: "uuid" },
        },
      },
    },
  ],
};
schemas.ExternalShareSummaryPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/ExternalShareSummary" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/external-shares"].get = {
  tags: ["ExternalReview"],
  operationId: "listExternalShares",
  summary: "List manageable external review shares",
  description:
    "Return bounded metadata for shares the actor may administer. The one-time URL, token and token hash are never replayed; this register exists so a capability can still be inspected or revoked after its creation response is gone.",
  "x-release": "GA",
  "x-flow-id": "F12",
  parameters: [
    { $ref: "#/components/parameters/RequestId" },
    { $ref: "#/components/parameters/OrgId" },
    {
      name: "resourceType",
      in: "query",
      schema: { type: "string", enum: ["package", "variation"] },
    },
    {
      name: "resourceId",
      in: "query",
      schema: { type: "string", format: "uuid" },
    },
    { $ref: "#/components/parameters/Cursor" },
    { $ref: "#/components/parameters/Limit" },
  ],
  responses: {
    "200": {
      description: "Manageable external share metadata page",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ExternalShareSummaryPage" },
        },
      },
      headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "422": { $ref: "#/components/responses/Validation" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    default: { $ref: "#/components/responses/Unexpected" },
  },
};

schemas.NumberingSeries.required = Array.from(new Set([
  ...schemas.NumberingSeries.required,
  "createdUnderContractVersion", "createdAt",
]));
Object.assign(schemas.NumberingSeries.properties, {
  createdUnderContractVersion: { type: "integer", minimum: 1 },
  createdAt: { type: "string", format: "date-time" },
});
schemas.NumberingSeriesCreate = {
  type: "object",
  additionalProperties: false,
  required: [
    "clientOperationId", "expectedContractVersion", "seriesKey", "prefix", "padding",
  ],
  properties: {
    clientOperationId: { type: "string", format: "uuid" },
    expectedContractVersion: { type: "integer", minimum: 1 },
    seriesKey: { type: "string", pattern: "^[A-Z0-9_.-]{1,40}$" },
    prefix: { type: "string", maxLength: 40 },
    padding: { type: "integer", minimum: 1, maximum: 10 },
  },
};
schemas.NumberingSeriesCreateReceipt = {
  type: "object",
  additionalProperties: false,
  required: ["series", "receiptHash"],
  properties: {
    series: { $ref: "#/components/schemas/NumberingSeries" },
    receiptHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
};
schemas.NumberingSeriesPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/NumberingSeries" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/contracts/{contractId}/numbering-series"] = {
  get: {
    tags: ["Projects"],
    operationId: "listNumberingSeries",
    summary: "List stable contract numbering series",
    description:
      "Return the stable server-owned series available to contract terms, including read-only nextSequence and lifecycle state. Authorization is applied before state filtering and cursor construction.",
    "x-release": "Pilot",
    "x-flow-id": "F19",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      {
        name: "contractId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      {
        name: "state",
        in: "query",
        schema: { type: "string", enum: ["active", "retired"] },
      },
      { $ref: "#/components/parameters/Cursor" },
      { $ref: "#/components/parameters/Limit" },
    ],
    responses: {
      "200": {
        description: "Visible stable numbering series page",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/NumberingSeriesPage" },
          },
        },
        headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
  },
  post: {
    tags: ["Projects"],
    operationId: "createNumberingSeries",
    summary: "Create a new stable numbering format",
    description:
      "Create a new active series under an exact contract version. The key and format are immutable after first reservation; duplicate keys conflict, nextSequence always starts server-side at one, and this command never edits or resets another series.",
    "x-release": "GA",
    "x-flow-id": "F19",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      {
        name: "contractId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      { $ref: "#/components/parameters/IdempotencyKey" },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/NumberingSeriesCreate" },
        },
      },
    },
    responses: {
      "201": {
        description: "New immutable-format numbering series and receipt",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/NumberingSeriesCreateReceipt" },
          },
        },
        headers: responseHeaders,
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "409": { $ref: "#/components/responses/Conflict" },
      "422": { $ref: "#/components/responses/Validation" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
    "x-idempotency-class": "standard_30d",
  },
};

// Commercial and export registers must survive response loss and navigation.
// Aggregate summaries expose current balances; immutable ledgers expose causes.
schemas.PaymentAllocation = {
  type: "object",
  additionalProperties: false,
  required: ["receivableId", "amountMinor"],
  properties: {
    receivableId: { type: "string", format: "uuid" },
    amountMinor: { type: "integer", minimum: 1 },
  },
};
schemas.Payment.required = Array.from(new Set([
  ...schemas.Payment.required,
  "reference", "sourceFingerprint", "reversalTotalMinor", "netAmountMinor", "allocations",
]));
Object.assign(schemas.Payment.properties, {
  reference: {
    oneOf: [{ type: "string", maxLength: 200 }, { type: "null" }],
  },
  sourceFingerprint: { type: "string", minLength: 16, maxLength: 256 },
  reversalTotalMinor: { type: "integer", minimum: 0 },
  netAmountMinor: { type: "integer", minimum: 0 },
  allocations: {
    type: "array",
    minItems: 1,
    maxItems: 500,
    items: { $ref: "#/components/schemas/PaymentAllocation" },
  },
});
schemas.PaymentCreate.properties.allocations.maxItems = 500;
schemas.PaymentCreate.properties.allocations.uniqueItems = true;
schemas.PaymentCreate.properties.allocations.description =
  "Each receivableId may appear once. The server rejects duplicate targets and requires the allocation sum to equal the payment amount.";
schemas.PaymentPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/Payment" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/payments"].get = {
  tags: ["Receivables"],
  operationId: "listPayments",
  summary: "List scoped project payments",
  description:
    "Return immutable payment facts, business fingerprints, allocations and reversal totals under project/receivable scope. Authorization is applied before filters and cursor construction; no bank credential or raw imported row is exposed.",
  "x-release": "GA",
  "x-flow-id": "F12",
  parameters: [
    { $ref: "#/components/parameters/RequestId" },
    { $ref: "#/components/parameters/OrgId" },
    {
      name: "projectId",
      in: "query",
      schema: { type: "string", format: "uuid" },
    },
    {
      name: "receivableId",
      in: "query",
      schema: { type: "string", format: "uuid" },
    },
    {
      name: "paidOnFrom",
      in: "query",
      schema: { type: "string", format: "date" },
    },
    {
      name: "paidOnTo",
      in: "query",
      schema: { type: "string", format: "date" },
    },
    { $ref: "#/components/parameters/Cursor" },
    { $ref: "#/components/parameters/Limit" },
  ],
  responses: {
    "200": {
      description: "Scoped immutable payment page",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PaymentPage" },
        },
      },
      headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "422": { $ref: "#/components/responses/Validation" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    default: { $ref: "#/components/responses/Unexpected" },
  },
};
api.paths["/payments/{paymentId}"] = {
  get: {
    tags: ["Receivables"],
    operationId: "getPayment",
    summary: "Get one immutable payment and allocations",
    description:
      "Return one authorized payment with normalized business fingerprint, exact allocations and aggregate reversals. Existence-safe authorization precedes lookup disclosure.",
    "x-release": "GA",
    "x-flow-id": "F12",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      {
        name: "paymentId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      "200": {
        description: "Authorized immutable payment",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Payment" },
          },
        },
        headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
  },
};

schemas.Receivable.required = Array.from(new Set([
  ...schemas.Receivable.required,
  "version", "adjustmentTotalMinor", "releasedRetentionMinor",
  "paidMinor", "reversedPaymentMinor", "outstandingMinor",
]));
Object.assign(schemas.Receivable.properties, {
  version: { type: "integer", minimum: 1 },
  adjustmentTotalMinor: { type: "integer" },
  releasedRetentionMinor: { type: "integer", minimum: 0 },
  paidMinor: { type: "integer", minimum: 0 },
  reversedPaymentMinor: { type: "integer", minimum: 0 },
  outstandingMinor: { type: "integer", minimum: 0 },
});
schemas.ReceivableLedgerEntry = {
  type: "object",
  additionalProperties: false,
  required: [
    "entryId", "entryType", "sourceId", "amountMinor", "currency",
    "occurredAt", "reasonCode", "relatedPaymentId",
    "relatedAdjustmentId", "relatedRetentionReleaseId",
    "relatedPaymentReversalId", "balanceAfterMinor",
  ],
  properties: {
    entryId: { type: "string", minLength: 1, maxLength: 200 },
    entryType: {
      type: "string",
      enum: ["adjustment", "retention_release", "payment_allocation", "payment_reversal"],
    },
    sourceId: { type: "string", format: "uuid" },
    amountMinor: {
      type: "integer",
      not: { const: 0 },
      description:
        "Signed effect on outstanding balance: positive increases the balance and negative decreases it.",
    },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    occurredAt: { type: "string", format: "date-time" },
    reasonCode: {
      oneOf: [{ type: "string", minLength: 1, maxLength: 80 }, { type: "null" }],
    },
    relatedPaymentId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    relatedAdjustmentId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    relatedRetentionReleaseId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    relatedPaymentReversalId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    balanceAfterMinor: { type: "integer", minimum: 0 },
  },
  allOf: [
    {
      if: { properties: { entryType: { const: "adjustment" } }, required: ["entryType"] },
      then: {
        properties: {
          relatedPaymentId: { type: "null" },
          relatedAdjustmentId: { type: "string", format: "uuid" },
          relatedRetentionReleaseId: { type: "null" },
          relatedPaymentReversalId: { type: "null" },
        },
      },
    },
    {
      if: {
        properties: { entryType: { const: "retention_release" } },
        required: ["entryType"],
      },
      then: {
        properties: {
          relatedPaymentId: { type: "null" },
          relatedAdjustmentId: { type: "string", format: "uuid" },
          relatedRetentionReleaseId: { type: "string", format: "uuid" },
          relatedPaymentReversalId: { type: "null" },
        },
      },
    },
    {
      if: {
        properties: { entryType: { const: "payment_allocation" } },
        required: ["entryType"],
      },
      then: {
        properties: {
          relatedPaymentId: { type: "string", format: "uuid" },
          relatedAdjustmentId: { type: "null" },
          relatedRetentionReleaseId: { type: "null" },
          relatedPaymentReversalId: { type: "null" },
        },
      },
    },
    {
      if: {
        properties: { entryType: { const: "payment_reversal" } },
        required: ["entryType"],
      },
      then: {
        properties: {
          relatedPaymentId: { type: "string", format: "uuid" },
          relatedAdjustmentId: { type: "null" },
          relatedRetentionReleaseId: { type: "null" },
          relatedPaymentReversalId: { type: "string", format: "uuid" },
        },
      },
    },
  ],
};
schemas.ReceivableLedgerPage = {
  type: "object",
  additionalProperties: false,
  required: ["receivableId", "receivableVersion", "data", "nextCursor"],
  properties: {
    receivableId: { type: "string", format: "uuid" },
    receivableVersion: { type: "integer", minimum: 1 },
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/ReceivableLedgerEntry" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/receivables/{receivableId}/ledger"] = {
  get: {
    tags: ["Receivables"],
    operationId: "listReceivableLedger",
    summary: "List immutable receivable ledger effects",
    description:
      "Return a chronological, cursor-paged union of adjustments, retention releases, payment allocations and reversals with a server-derived balance after each entry. Scope filtering occurs before ordering and cursor construction.",
    "x-release": "GA",
    "x-flow-id": "F12",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      {
        name: "receivableId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      { $ref: "#/components/parameters/Cursor" },
      { $ref: "#/components/parameters/Limit" },
    ],
    responses: {
      "200": {
        description: "Version-bound immutable receivable ledger page",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ReceivableLedgerPage" },
          },
        },
        headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
  },
};

schemas.ExportJobSummary = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "projectId", "requestedBy", "scope", "format", "state",
    "version", "artifactSha256", "artifactByteSize", "artifactMimeType",
    "expiresAt", "createdAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: {
      oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    requestedBy: { type: "string", format: "uuid" },
    scope: { type: "string", enum: ["current_view", "project", "organization"] },
    format: { type: "string", enum: ["xlsx", "csv", "zip_json", "pdf"] },
    state: {
      type: "string",
      enum: [
        "requested", "authorized", "collecting", "packaging", "cancel_requested",
        "ready", "expired", "failed", "cancelled",
      ],
    },
    version: { type: "integer", minimum: 1 },
    artifactSha256: {
      oneOf: [
        { type: "string", pattern: "^[a-f0-9]{64}$" },
        { type: "null" },
      ],
    },
    artifactByteSize: {
      oneOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
    },
    artifactMimeType: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
    expiresAt: {
      oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    createdAt: { type: "string", format: "date-time" },
  },
};
schemas.ExportJobSummaryPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/ExportJobSummary" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/exports"].get = {
  tags: ["Operations"],
  operationId: "listExportJobs",
  summary: "List visible export jobs",
  description:
    "Return resumable export state, exact version and safe artifact metadata for jobs visible to the actor. Storage keys are never exposed; ready downloads still require a short-lived download grant.",
  "x-release": "Pilot",
  "x-flow-id": "F17",
  parameters: [
    { $ref: "#/components/parameters/RequestId" },
    { $ref: "#/components/parameters/OrgId" },
    {
      name: "state",
      in: "query",
      schema: {
        type: "string",
        enum: [
          "requested", "authorized", "collecting", "packaging", "cancel_requested",
          "ready", "expired", "failed", "cancelled",
        ],
      },
    },
    { $ref: "#/components/parameters/Cursor" },
    { $ref: "#/components/parameters/Limit" },
  ],
  responses: {
    "200": {
      description: "Visible resumable export job page",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ExportJobSummaryPage" },
        },
      },
      headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    default: { $ref: "#/components/responses/Unexpected" },
  },
};

// Remove a legacy scope conditional accidentally copied from Membership and
// expose the active closure aggregate so closing can resume after response loss.
delete schemas.Organization.allOf;
schemas.Organization.required = Array.from(new Set([
  ...schemas.Organization.required,
  "activeDeletionJobId",
]));
schemas.Organization.properties.activeDeletionJobId = {
  oneOf: [{ type: "string", format: "uuid" }, { type: "null" }],
  description:
    "The current nonterminal closure job visible to the actor; null outside a resumable closing workflow.",
};

schemas.SaasPayment.required = Array.from(new Set([
  ...schemas.SaasPayment.required,
  "sourceFingerprint", "recordedBy", "reversalTotalMinor", "netAmountMinor",
]));
Object.assign(schemas.SaasPayment.properties, {
  sourceFingerprint: { type: "string", minLength: 16, maxLength: 256 },
  recordedBy: { type: "string", format: "uuid" },
  reversalTotalMinor: { type: "integer", minimum: 0 },
  netAmountMinor: { type: "integer", minimum: 0 },
});
schemas.SaasPaymentPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/SaasPayment" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
api.paths["/saas-payments"] = {
  get: {
    tags: ["Subscription"],
    operationId: "listSaasPayments",
    summary: "List read-only SaaS settlement history",
    description:
      "Return scoped settlement facts and aggregate reversals for tenant billing history and the isolated platform billing plane. Tenant roles can read authorized history but cannot issue, settle, reverse or credit invoices.",
    "x-release": "Pilot",
    "x-flow-id": "F13",
    parameters: [
      { $ref: "#/components/parameters/RequestId" },
      { $ref: "#/components/parameters/OrgId" },
      {
        name: "saasInvoiceId",
        in: "query",
        schema: { type: "string", format: "uuid" },
      },
      { $ref: "#/components/parameters/Cursor" },
      { $ref: "#/components/parameters/Limit" },
    ],
    responses: {
      "200": {
        description: "Authorized read-only SaaS settlement page",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SaasPaymentPage" },
          },
        },
        headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
      },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "422": { $ref: "#/components/responses/Validation" },
      "429": { $ref: "#/components/responses/TooManyRequests" },
      default: { $ref: "#/components/responses/Unexpected" },
    },
  },
};

schemas.SupportGrantPage = {
  type: "object",
  additionalProperties: false,
  required: ["data", "nextCursor"],
  properties: {
    data: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/components/schemas/SupportGrant" },
    },
    nextCursor: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
};
schemas.SupportGrant.required = Array.from(new Set([
  ...schemas.SupportGrant.required,
  "approvedBy", "revokedAt", "createdAt",
]));
Object.assign(schemas.SupportGrant.properties, {
  approvedBy: { type: "string", format: "uuid" },
  revokedAt: {
    oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
  },
  createdAt: { type: "string", format: "date-time" },
});
api.paths["/support-grants"].get = {
  tags: ["Operations"],
  operationId: "listSupportGrants",
  summary: "List visible scoped support grants",
  description:
    "Return requested, active and historical time-bound grants visible to the tenant approver or isolated platform support audience. This read powers the tenant banner and makes revoke possible after navigation without granting content access.",
  "x-release": "GA",
  "x-flow-id": "F18",
  parameters: [
    { $ref: "#/components/parameters/RequestId" },
    { $ref: "#/components/parameters/OrgId" },
    {
      name: "status",
      in: "query",
      schema: { type: "string", enum: ["requested", "active", "revoked", "expired"] },
    },
    { $ref: "#/components/parameters/Cursor" },
    { $ref: "#/components/parameters/Limit" },
  ],
  responses: {
    "200": {
      description: "Visible scoped support grant page",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/SupportGrantPage" },
        },
      },
      headers: { "X-Request-Id": { $ref: "#/components/headers/RequestId" } },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "429": { $ref: "#/components/responses/TooManyRequests" },
    default: { $ref: "#/components/responses/Unexpected" },
  },
};

// Every collection must remain traversable after it grows beyond a single UI
// screen. These five legacy list operations returned bare arrays, which made
// records beyond an implicit server cap unreachable. Promote them to the same
// cursor contract used by the rest of the API.
const cursorPage = (schemaName, itemSchemaName) => {
  schemas[schemaName] = {
    type: "object",
    additionalProperties: false,
    required: ["data", "nextCursor"],
    properties: {
      data: {
        type: "array",
        maxItems: 100,
        items: { $ref: `#/components/schemas/${itemSchemaName}` },
      },
      nextCursor: {
        oneOf: [{ type: "string", minLength: 1 }, { type: "null" }],
      },
    },
  };
};
const addParameterRef = (operation, ref) => {
  operation.parameters ??= [];
  if (!operation.parameters.some((parameter) => parameter?.$ref === ref)) {
    operation.parameters.push({ $ref: ref });
  }
};
for (const [operationId, pageSchemaName, itemSchemaName] of [
  ["listContractTermsVersions", "ContractTermsVersionPage", "ContractTermsVersion"],
  ["listWorkAssignments", "WorkAssignmentPage", "WorkAssignment"],
  ["listReferenceDocumentVersions", "ReferenceDocumentVersionPage", "ReferenceDocumentVersion"],
  ["listReviewTasks", "ReviewTaskPage", "ReviewTask"],
  ["listSavedViews", "SavedViewPage", "SavedView"],
]) {
  cursorPage(pageSchemaName, itemSchemaName);
  const operation = operationById(operationId);
  addParameterRef(operation, "#/components/parameters/Cursor");
  addParameterRef(operation, "#/components/parameters/Limit");
  operation.responses["200"].content["application/json"].schema = {
    $ref: `#/components/schemas/${pageSchemaName}`,
  };
}
addParameterRef(operationById("searchProjectRecords"), "#/components/parameters/Cursor");
addParameterRef(operationById("searchProjectRecords"), "#/components/parameters/Limit");

// Command and aggregate arrays are bounded deliberately. Large business
// batches keep their documented operational ceiling; UI pages use the global
// limit of 100. This prevents accidental unbounded validation, memory and
// response costs without silently making older collection records unreachable.
const setArrayCap = (schemaName, propertyName, maxItems) => {
  const property = schemas[schemaName]?.properties?.[propertyName];
  if (!property || property.type !== "array") {
    throw new Error(`Cannot bound missing array ${schemaName}.${propertyName}`);
  }
  property.maxItems = maxItems;
};
for (const [schemaName, propertyName, maxItems] of [
  ["Problem", "fieldErrors", 100],
  ["Membership", "projectScopes", 1000],
  ["Readiness", "reasonCodes", 100],
  ["WorkItem", "locationIds", 1000],
  ["WorkItem", "assignedUserIds", 100],
  ["WorkItemCreate", "locationIds", 1000],
  ["UploadGrant", "parts", 10000],
  ["UploadComplete", "parts", 10000],
  ["ImportRowResult", "errorCodes", 100],
  ["EstimateImportConfirm", "warningAcknowledgements", 100],
  ["RuleImpactRequest", "draftRules", 500],
  ["RuleImpactPreview", "warnings", 1000],
  ["Requirement", "reasonCodes", 100],
  ["Requirement", "remediation", 100],
  ["CaptureSessionInput", "quantityEntries", 500],
  ["CaptureSessionInput", "evidenceLinks", 1000],
  ["CaptureSessionInput", "occurrenceResponses", 500],
  ["CaptureSession", "decisionTimeline", 1000],
  ["ReviewQueueItem", "reasonCodes", 100],
  ["PeriodPreflight", "hardBlockers", 1000],
  ["PeriodPreflight", "warnings", 1000],
  ["PeriodCloseRequest", "warningAcknowledgements", 100],
  ["PeriodCloseRequest", "waiverIds", 500],
  ["PackageGenerateRequest", "workItemIds", 5000],
  ["PackageGenerateRequest", "exclusions", 5000],
  ["PackageGenerateRequest", "waiverIds", 500],
  ["PackageVersion", "artifacts", 100],
  ["PackageComparison", "sourceChanges", 5000],
  ["PackageComparison", "artifactChanges", 5000],
  ["PlanChangePreview", "entitlementChanges", 1000],
  ["PlanChangePreview", "impactedResources", 1000],
  ["VariationCreate", "locationIds", 1000],
  ["ExternalShareCreate", "permissions", 4],
  ["ExternalSession", "permissions", 4],
  ["PaymentReversalCreate", "allocationCorrections", 500],
  ["NotificationPreferences", "availableChannels", 10],
  ["NotificationPreferences", "mandatoryEventKeys", 500],
  ["IntegrationCreate", "eventKeys", 500],
  ["IntegrationMappingPreviewCreate", "allowedEventKeys", 500],
  ["IntegrationMappingPreview", "warnings", 1000],
  ["SupportGrantCreate", "scopes", 100],
  ["SupportGrantCreate", "projectIds", 1000],
  ["SupportGrant", "scopes", 100],
  ["SupportGrant", "projectIds", 1000],
  ["MemberOffboardingPreview", "projectIds", 1000],
  ["AssignmentExecutionBundle", "occurrences", 500],
  ["AssignmentExecutionBundle", "formSchemas", 100],
  ["AssignmentExecutionBundle", "referenceMetadata", 500],
  ["SavedViewFilters", "states", 100],
  ["SavedViewFilters", "locationIds", 1000],
  ["SavedViewFilters", "requirementStates", 100],
  ["SavedViewFilters", "ruleKeys", 500],
  ["SavedViewFilters", "missingTypes", 100],
  ["SavedView", "sort", 10],
  ["ImpactPreviewConfirm", "confirmationCodes", 100],
  ["EvidenceRuleDraft", "requiredEvidenceKinds", 100],
  ["ContractTermsPublish", "requiredDocumentRules", 100],
  ["ContractTermsPublish", "confirmationCodes", 100],
  ["WorkAssignment", "occurrenceIds", 500],
  ["WorkAssignmentBatchReceipt", "committed", 500],
  ["WorkAssignmentBatchReceipt", "rejected", 500],
  ["RequirementOccurrence", "typedEvidence", 100],
  ["ConcealmentEventCreate", "evidenceObjectIds", 500],
  ["PackageDecisionItem", "issues", 500],
  ["EvidenceTimelineItem", "evidenceObjectIds", 500],
  ["EvidenceTimelineItem", "occurrenceIds", 500],
  ["ReadinessBlocker", "reasonCodes", 100],
  ["ReadinessBlocker", "evidenceObjectIds", 500],
  ["PackageVersionLine", "evidenceObjectIds", 1000],
  ["PackageVersionLine", "occurrenceIds", 1000],
  ["PackageVersionLine", "issues", 500],
  ["ReportingDateConfirmationReceipt", "affectedQuantityEntryIds", 500],
  ["MemberOffboardingPlan", "projectIds", 1000],
  ["OffboardingDependency", "codes", 100],
  ["ProjectScopeRemovalReceipt", "remainingProjectIds", 1000],
  ["MemberOffboardingPlanItem", "codes", 100],
  ["ExternalShareSummary", "permissions", 4],
]) {
  setArrayCap(schemaName, propertyName, maxItems);
}

schemas.ImpactPreview.properties.result.properties.rows.maxItems = 1000;
schemas.ImpactPreview.properties.result.properties.rows.items.properties.codes.maxItems = 100;
schemas.SearchResultPage.properties.data.items.properties.highlights.maxItems = 20;
schemas.WorkAssignmentBatchReceipt.properties.rejected.items.properties.fieldPointers.maxItems = 100;
schemas.WorkAssignmentImpactPreview.properties.rows.items.properties.codes.maxItems = 100;

for (const [schemaName, schema] of Object.entries(schemas)) {
  const data = schema?.properties?.data;
  if (schemaName.endsWith("Page") && data?.type === "array") {
    data.maxItems = 100;
  }
}

for (const parameterName of [
  "ProjectStatusFilter", "WorkStateFilter", "ReadinessFilter",
  "ImportRowStateFilter", "ReceivableStateFilter",
]) {
  api.components.parameters[parameterName].schema.maxItems = 50;
}
for (const parameter of operationById("searchProjectRecords").parameters) {
  if (parameter?.schema?.type === "array") parameter.schema.maxItems = 50;
}

// Defensive final pass: future component or inline arrays receive a safe
// default until an explicit larger/smaller business ceiling is specified.
const boundRemainingArrays = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) boundRemainingArrays(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (value.type === "array" && value.maxItems === undefined) {
    value.maxItems = 100;
  }
  for (const child of Object.values(value)) boundRemainingArrays(child);
};
boundRemainingArrays(api);

fs.writeFileSync(path, `${JSON.stringify(api, null, 2)}\n`);
