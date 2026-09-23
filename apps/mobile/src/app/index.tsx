// The `/` route. It renders the screen body and holds no markup of its own, so
// the deliverable stays in one place (src/screens/my-assignments.tsx) and this
// file stays a route declaration. TokenProof — B0's original `/` deliverable —
// moved to src/app/token-proof.tsx for a while; that route and its screen are
// gone since DEV-042 (2026-09-23), and git keeps their history.
import { MyAssignments } from "../screens/my-assignments";

export default function Index() {
  return <MyAssignments />;
}
