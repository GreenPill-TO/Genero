import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  VoucherRuntimePaymentRecordResponse,
  VoucherRuntimePortfolioResponse,
  VoucherRuntimeRouteResponse,
} from "./voucherRuntime";

export async function getVoucherPortfolioRuntime(
  input?: { citySlug?: string; wallet?: string | null; chainId?: number | null; appContext?: AppScopeInput | null }
): Promise<VoucherRuntimePortfolioResponse> {
  const params = new URLSearchParams();
  if (input?.citySlug) {
    params.set("citySlug", input.citySlug);
  }
  if (input?.wallet) {
    params.set("wallet", input.wallet);
  }
  if (typeof input?.chainId === "number" && input.chainId > 0) {
    params.set("chainId", String(input.chainId));
  }

  return invokeEdgeFunction<VoucherRuntimePortfolioResponse>(
    "voucher-runtime",
    `/portfolio${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}

export async function getVoucherRouteRuntime(
  input: {
    citySlug?: string;
    amount: number;
    recipientWallet?: string | null;
    recipientUserId?: number | null;
    chainId?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<VoucherRuntimeRouteResponse> {
  const params = new URLSearchParams();
  if (input.citySlug) {
    params.set("citySlug", input.citySlug);
  }
  params.set("amount", String(input.amount));
  if (input.recipientWallet) {
    params.set("recipientWallet", input.recipientWallet);
  }
  if (typeof input.recipientUserId === "number" && input.recipientUserId > 0) {
    params.set("recipientUserId", String(input.recipientUserId));
  }
  if (typeof input.chainId === "number" && input.chainId > 0) {
    params.set("chainId", String(input.chainId));
  }

  return invokeEdgeFunction<VoucherRuntimeRouteResponse>(
    "voucher-runtime",
    `/route${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input.appContext,
    }
  );
}

export async function createVoucherPaymentRecordRuntime(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<VoucherRuntimePaymentRecordResponse> {
  return invokeEdgeFunction<VoucherRuntimePaymentRecordResponse>("voucher-runtime", "/payment-record", {
    method: "POST",
    body: payload,
    appContext,
  });
}
