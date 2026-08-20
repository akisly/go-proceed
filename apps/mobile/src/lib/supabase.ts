import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * THE ONLY SUPABASE CLIENT IN THIS APP.
 *
 * Options match the current Expo guide (docs.expo.dev/guides/using-supabase/,
 * read 2026-08-20) with one deliberate omission: the guide's example also
 * sets `storage: localStorage` via `expo-sqlite/localStorage/install` for
 * on-device session persistence across app launches — that is NATIVE
 * (iOS/Android) storage and is NOT installed here. This build is the v0.2
 * Plan C pilot, WEB-FIRST ONLY: on web, supabase-js's default storage
 * adapter is `window.localStorage` whenever `window` exists, so persistence
 * already works there with no `storage` option set. AsyncStorage/SecureStore
 * (or `expo-sqlite/localStorage/install`) for native persistence is out of
 * scope until v0.3, when this client is expected to run on a device — do not
 * add either here without also revisiting this comment.
 *
 * `detectSessionInUrl: false` per the same guide: there is no
 * magic-link/OAuth redirect callback URL for this client to parse.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
