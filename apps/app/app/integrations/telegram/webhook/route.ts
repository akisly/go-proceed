import { acceptTelegramUpdate } from "../../../../src/lib/telegram/ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Provider-authenticated ingress. No member session or tenant selector exists here. */
export async function POST(request: Request): Promise<Response> {
  return acceptTelegramUpdate(request);
}
