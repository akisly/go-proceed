import { problem } from "@aktflow/contracts";
import { HttpProblem } from "./http";
import { supabaseServer } from "./supabase-server";

export async function requireUser(requestId: string): Promise<{ userId: string }> {
  const supabase = await supabaseServer();
  // supabase.auth.getUser() re-validates the access token against the Supabase
  // Auth server on every call (unlike getSession(), which only reads the local
  // cookie without verification). Never trust a client-supplied user id.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new HttpProblem(
      401,
      problem("auth.required", "Потрібна автентифікація.", {
        requestId,
        retryable: false,
        userAction: "Увійдіть у систему.",
      }),
    );
  }
  return { userId: data.user.id };
}
