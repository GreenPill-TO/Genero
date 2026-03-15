import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  return proxyEdgeRequest({
    req,
    functionName: "onramp",
    path: `/session/${params.id}${url.search}`,
    method: "GET",
    appContext: {
      citySlug: url.searchParams.get("citySlug") ?? undefined,
    },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return proxyEdgeRequest({
    req,
    functionName: "onramp",
    path: `/session/${params.id}`,
    method: "POST",
    body,
    appContext: {
      citySlug: typeof body.citySlug === "string" ? body.citySlug : undefined,
    },
  });
}
