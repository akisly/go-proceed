// Outbox-drain Edge Function stub (slice 1).
//
// In this slice the drain actually runs via the `outbox-drain` pg_cron job
// (see supabase/migrations/0005_outbox_drain_cron.sql), which calls
// public.drain_outbox() directly in-database on a schedule. This function
// exists for the future path where drained rows fan out to real consumers
// (webhooks, notifications, ...) and the drain needs to happen in an
// environment that can make outbound calls - it is NOT deployed or wired
// to cron in this slice; wiring cron -> Edge Function HTTP is deferred
// until a real consumer exists (spec S4.5).
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SECRET_KEY")!,
  );

  const { data, error } = await supabase.rpc("drain_outbox", { batch: 100 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ drained: data ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
});
