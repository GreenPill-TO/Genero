import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = new URLSearchParams();

  for (const key of ["chainId", "wallet"]) {
    const value = url.searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  const path = `/portfolio${params.size > 0 ? `?${params.toString()}` : ""}`;
  return proxyEdgeRequest({
    req,
    functionName: "voucher-runtime",
    path,
    method: "GET",
  });
}
