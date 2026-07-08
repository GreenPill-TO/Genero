import { resolveCorsHeaders } from "./cors.ts";

export function jsonResponse(req: Request, body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...resolveCorsHeaders(req),
      ...(init?.headers ?? {}),
    },
  });
}
