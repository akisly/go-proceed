/**
 * Mirrors the 0012 generated column exactly:
 *   upper(regexp_replace(btrim(contract_no), '\s+', ' ', 'g'))
 * Any change here MUST change the DB expression in the same commit.
 */
export function normalizeContractNo(no: string): string {
  return no.trim().replace(/\s+/g, " ").toUpperCase();
}
