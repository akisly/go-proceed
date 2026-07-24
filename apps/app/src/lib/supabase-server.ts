import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
