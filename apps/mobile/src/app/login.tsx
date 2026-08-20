// The `/login` route. Renders the screen body and holds no markup of its
// own — see src/app/index.tsx's comment for why this directory stays a
// route table and nothing else.
import { Login } from "../screens/login";

export default function LoginRoute() {
  return <Login />;
}
