/**
 * Local declaration for `psl` (ER-4).
 *
 * psl 1.15 ships `types/index.d.ts`, but its package.json `exports` map does not
 * expose that path, so `moduleResolution: "Bundler"` cannot resolve it (TS7016).
 * `@types/psl` is a deprecated stub with no definitions and yields TS2688, so it
 * is not the fix. We declare only the surface this package actually uses.
 */
declare module "psl" {
  /** Registrable domain, or null when the input is itself a public suffix. */
  export function get(domain: string): string | null;
  export function isValid(domain: string): boolean;

  const psl: {
    get(domain: string): string | null;
    isValid(domain: string): boolean;
  };
  export default psl;
}
