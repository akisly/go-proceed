-- Telegram delivery uses the existing bounded lease functions. The worker is
-- the service principal introduced by Task 6, so grant only those functions;
-- do not grant table updates or weaken general outbox RLS.

grant execute on function app.complete_outbox(uuid, uuid) to goproceed_service;
grant execute on function app.fail_outbox(uuid, uuid, text) to goproceed_service;
