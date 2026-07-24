export interface FieldError { path: string; message: string }
export interface ProblemJson {
  code: string;
  detail: string;
  fieldErrors: FieldError[];
  requestId: string;
  retryable: boolean;
  userAction: string;
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
  };
}
