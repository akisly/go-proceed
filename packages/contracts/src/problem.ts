export interface FieldError { path: string; message: string }
export interface ProblemJson {
  code: string;
  detail: string;
  fieldErrors: FieldError[];
  requestId: string;
  retryable: boolean;
  userAction: string;
  /**
   * Code-specific structured payload. `docs/22-data-api-contract.md:194` defines
   * it — «`details` is code-specific and allowlisted; tokens, raw content,
   * filenames, storage/provider URLs and secrets are prohibited» — and until
   * v0.1-M3 no refusal needed one, so the field was absent from this type while
   * being present in the wire contract.
   *
   * `stage_closures.create` needs it. version-0.1.md §M3 requires that «every
   * refusal names the requirement, the missing evidence, the role that owes the
   * decision, and the money that waits», and `fieldErrors` — `{path, message}` —
   * cannot carry an object; flattening a `blockedReason` into prose would produce
   * the bare status word ADR-005 decision 6 exists to prevent. `HOLD_POINT_BLOCKED`
   * is the first allow-listed shape (`holdPointBlockedDetails` in
   * ./stage-closures.ts).
   *
   * OPTIONAL, so no existing problem body changes on the wire: `problem()` omits
   * the key entirely unless a caller passes one, and `JSON.stringify` drops
   * `undefined`. «API responses never alternate between JSON error shapes»
   * (docs/22-data-api-contract.md:194) is preserved because this is an addition
   * to the one shape, not a second one.
   */
  details?: Record<string, unknown>;
}
export function problem(
  code: string,
  detail: string,
  opts: Partial<Omit<ProblemJson, "code" | "detail">> = {},
): ProblemJson {
  return {
    code,
    detail,
    fieldErrors: opts.fieldErrors ?? [],
    requestId: opts.requestId ?? "",
    retryable: opts.retryable ?? false,
    userAction: opts.userAction ?? "Перевірте дані та повторіть спробу.",
    ...(opts.details === undefined ? {} : { details: opts.details }),
  };
}
