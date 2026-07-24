import { problem, type ProblemJson } from "@aktflow/contracts";

export class HttpProblem extends Error {
  status: number;
  body: ProblemJson;

  constructor(status: number, body: ProblemJson) {
    super(body.detail);
    this.status = status;
    this.body = body;
  }
}

export function requestIdFrom(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonProblem(status: number, body: ProblemJson): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/problem+json",
      "x-request-id": body.requestId,
    },
  });
}

export function ok(status: number, body: unknown, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}

export { problem };
