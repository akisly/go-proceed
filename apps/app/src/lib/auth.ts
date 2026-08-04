import { problem } from "@goproceed/contracts";
import { HttpProblem } from "./http";
import { supabaseAnon, supabaseServer } from "./supabase-server";

function bearerTokenFrom(req?: Request): string | null {
  const header = req?.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export async function requireUser(requestId: string, req?: Request): Promise<{ userId: string }> {
  const bearer = bearerTokenFrom(req);

  // Both paths call supabase.auth.getUser(), which re-validates against the
  // Supabase Auth server on every call (unlike getSession()/decoding the JWT
  // locally, which only reads claims without verification). Never trust a
  // client-supplied user id.
  //
  // An inbound `Authorization: Bearer <jwt>` takes priority over the cookie
  // session so BFF callers that hold a token (curl, mobile, staging
  // verification per infra/README-staging.md) don't need a browser cookie
  // jar; a browser session still authenticates via the cookie-based fallback.
  const { data, error } = bearer
    ? await supabaseAnon().auth.getUser(bearer)
    : await (await supabaseServer()).auth.getUser();

  if (error || !data.user) {
    throw new HttpProblem(
      401,
      problem("AUTH_REQUIRED", "Потрібна автентифікація.", {
        requestId,
        retryable: false,
        userAction: "sign_in",
      }),
    );
  }
  return { userId: data.user.id };
}
