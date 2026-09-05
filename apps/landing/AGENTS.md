<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Pilot form delivery

`POST /api/pilot` (`app/api/pilot/route.ts`) forwards the pilot request to the
owner and stores nothing. Configure at least one channel in the Vercel project
`goproceed-landing`: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (a bot and the
chat it may write to) and/or `RESEND_API_KEY` + `PILOT_TO_EMAIL` (+
`PILOT_FROM_EMAIL` on a verified domain). Copy `.env.example` to `.env.local`
for a local run. With no channel the handler answers 503 and the page falls
back to copying the request text and opening the mail client to the address
in `content/pilot-request.ts`. The rate limit (5 per 10 min per IP) is per
instance, bounded at 500 keys, and resets on a cold start; rejected requests
cost the limiter nothing. Both outbound calls and the browser's own fetch carry
an `AbortSignal.timeout` (8 s / 15 s). The contact field feeds Resend's
`reply_to` only when it is a single well-formed address. The form also carries
`method="post" action="/api/pilot"`, so a visitor without JavaScript never
puts their name into a URL — they land on the handler's JSON problem (a 4xx,
nothing delivered) and have to go back; the visible pilot address next to the
form is the no-script path that works. Tests: `tests/pilot-route.test.ts`,
`tests/pilot-form.test.tsx`.
