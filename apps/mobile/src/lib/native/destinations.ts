/** Protected destinations only. Parsing is not authorization: screens re-fetch access. */
export function nativeNext(value: unknown): string {
  if (typeof value !== "string" || /[\\%?#@:\s]/u.test(value.replace(/^goproceed:\/\//, ""))) return "/";
  const path = value.startsWith("goproceed://")
    ? `/${value.slice("goproceed://".length).replace(/^\//, "")}`
    : value;
  if (["/", "/queue", "/profile"].includes(path)) return path;
  const id = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
  return new RegExp(`^/a/${id}$`).test(path) ? path : "/";
}
