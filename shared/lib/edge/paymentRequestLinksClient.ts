import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  ConsumePaymentRequestLinkInput,
  CreatePaymentRequestLinkInput,
  PaymentRequestLinkResponse,
} from "./paymentRequestLinks";

function buildScopeInput(input?: { citySlug?: string | null; appContext?: AppScopeInput | null }) {
  if (!input?.citySlug) {
    return input?.appContext ?? null;
  }

  return {
    ...(input.appContext ?? {}),
    citySlug: input.citySlug,
  };
}

export async function createPaymentRequestLink(
  input: CreatePaymentRequestLinkInput
): Promise<PaymentRequestLinkResponse> {
  return invokeEdgeFunction<PaymentRequestLinkResponse>("payment-links", "/create", {
    method: "POST",
    body: {
      amountRequested: input.amountRequested ?? null,
      mode: input.mode ?? "rotating_multi_use",
    },
    appContext: buildScopeInput(input),
  });
}

export async function resolvePaymentRequestLink(
  token: string
): Promise<PaymentRequestLinkResponse> {
  return invokeEdgeFunction<PaymentRequestLinkResponse>(
    "payment-links",
    `/resolve/${encodeURIComponent(token)}`,
    {
      method: "GET",
    }
  );
}

export async function consumePaymentRequestLink(
  input: ConsumePaymentRequestLinkInput
): Promise<PaymentRequestLinkResponse> {
  return invokeEdgeFunction<PaymentRequestLinkResponse>("payment-links", "/consume", {
    method: "POST",
    body: {
      token: input.token,
      transactionId: input.transactionId ?? null,
    },
    appContext: buildScopeInput(input),
  });
}
