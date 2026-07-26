/**
 * Capability claims that must never appear in the shipped bundle (spec A.4.20).
 * The ported prototype Landing.jsx contains all four. Shared by the unit test
 * and the QA harness so a claim cannot slip past one of them.
 */
export const FORBIDDEN_CLAIM_PATTERNS = [
  { id: 'pricing', pattern: /₴\s*\/\s*міс|грн\s*\/\s*міс|\bтариф/iu },
  { id: 'mobile-app', pattern: /\biOS\b|\bAndroid\b/iu },
  { id: 'security-enforcement', pattern: /гаранту[єм].{0,40}(доступ|безпек)/iu },
  { id: 'data-export', pattern: /експорт\s+(усіх|всіх)\s+даних|гарантований\s+експорт/iu },
]
