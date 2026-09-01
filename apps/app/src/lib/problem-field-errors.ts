/**
 * A problem+json document's per-field errors, in the shape `FieldError` takes.
 *
 * The server emits `fieldErrors: [{ path, message }]` on every zod failure and
 * NOTHING in this product has ever read them — a 422 renders as one banner
 * today. `path` is dot-joined (`items.1.qty`), pinned by `command.test.ts`.
 *
 * It never throws. A refusal that cannot be parsed must still reach the user
 * through the banner, so every unexpected shape degrades to «no field errors»
 * rather than to an exception inside a submit handler.
 */
interface FieldErrorEntry { path: string; message: string }

function entriesOf(problem: unknown): FieldErrorEntry[] {
  if (!problem || typeof problem !== "object") return [];
  const raw = (problem as { fieldErrors?: unknown }).fieldErrors;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const { path, message } = e as { path?: unknown; message?: unknown };
    if (typeof path !== "string" || typeof message !== "string") return [];
    return [{ path, message }];
  });
}

export function fieldErrorsFrom(problem: unknown): Record<string, Array<{ message: string }>> {
  const out: Record<string, Array<{ message: string }>> = {};
  for (const { path, message } of entriesOf(problem)) {
    (out[path] ??= []).push({ message });
  }
  return out;
}

/** Messages the form has no field for. They go to the banner, so none is lost. */
export function unmappedFrom(problem: unknown, known: readonly string[]): string[] {
  return entriesOf(problem).filter((e) => !known.includes(e.path)).map((e) => e.message);
}
