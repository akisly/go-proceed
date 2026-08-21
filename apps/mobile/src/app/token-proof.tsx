// The `/token-proof` route. Renders the screen body and holds no markup of
// its own — see src/app/index.tsx's comment for why this directory stays a
// route table and nothing else. Moved off `/` (its original route) when task
// 4 gave that root route to `MyAssignments`; the screen file itself
// (src/screens/token-proof.tsx) is unchanged.
import { TokenProof } from "../screens/token-proof";

export default function TokenProofRoute() {
  return <TokenProof />;
}
