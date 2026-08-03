// The `/` route. It renders the screen body and holds no markup of its own, so
// the deliverable stays in one place (src/screens/token-proof.tsx) and this file
// stays a route declaration.
import { TokenProof } from "../screens/token-proof";

export default function Index() {
  return <TokenProof />;
}
