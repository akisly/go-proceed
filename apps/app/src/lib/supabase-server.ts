import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Stateless client used only to validate an inbound `Authorization: Bearer`
// token via `auth.getUser(token)`. It never persists or refreshes a
// session/cookie — the token comes from the caller on every request, so
// there is nothing local to cache.
export function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (all) => {
          // cookies().set() throws when called from a plain Server Component. getUser()
          // may refresh the token and trigger this, so swallow that case: the refreshed
          // cookie is re-issued on the next Route Handler / Server Action request.
          try {
            all.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* not writable in this context */
          }
        },
      },
    },
  );
}
