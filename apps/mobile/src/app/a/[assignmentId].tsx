// The `/a/[assignmentId]` route — the obligation screen a foreman lands on
// after tapping a row in `../index.tsx`'s list. Renders the screen body and
// holds no markup of its own — see `../index.tsx`'s comment for why this
// directory stays a route table and nothing else.
import { Assignment } from "../../screens/assignment";

export default function AssignmentRoute() {
  return <Assignment />;
}
