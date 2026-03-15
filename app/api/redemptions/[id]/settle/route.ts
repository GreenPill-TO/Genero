import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return proxyEdgeRequest({
    req,
    functionName: "redemptions",
    path: `/${params.id}/settle`,
    method: "POST",
    body,
    appContext: {
      citySlug: typeof body.citySlug === "string" ? body.citySlug : undefined,
    },
  });
}
