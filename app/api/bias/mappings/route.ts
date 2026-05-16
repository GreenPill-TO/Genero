import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return proxyEdgeRequest({
    req,
    functionName: "bia-service",
    path: `/mappings${url.search}`,
    method: "GET",
    appContext: {
      citySlug: url.searchParams.get("citySlug") ?? undefined,
    },
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return proxyEdgeRequest({
    req,
    functionName: "bia-service",
    path: "/mappings",
    method: "POST",
    body,
    appContext: {
      citySlug: typeof body.citySlug === "string" ? body.citySlug : undefined,
    },
  });
}
