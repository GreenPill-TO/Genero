import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  CancelPaymentRequestInput,
  CreatePaymentRequestInput,
  DismissPaymentRequestInput,
  IncomingPaymentRequestsResponse,
  MarkPaymentRequestPaidInput,
  OutgoingPaymentRequestsResponse,
  PaymentRequestRecord,
  RecentPaymentRequestParticipantsResponse,
} from "./paymentRequests";

function buildScopeInput(input?: { citySlug?: string | null; appContext?: AppScopeInput | null }) {
  if (!input?.citySlug) {
    return input?.appContext ?? null;
  }

  return {
    ...(input.appContext ?? {}),
    citySlug: input.citySlug,
  };
}

export async function getIncomingPaymentRequests(input?: {
  citySlug?: string | null;
  appContext?: AppScopeInput | null;
}): Promise<IncomingPaymentRequestsResponse> {
  return invokeEdgeFunction<IncomingPaymentRequestsResponse>("payment-requests", "/incoming", {
    method: "GET",
    appContext: buildScopeInput(input),
  });
}

export async function getOutgoingPaymentRequests(input?: {
  citySlug?: string | null;
  includeClosed?: boolean;
  appContext?: AppScopeInput | null;
}): Promise<OutgoingPaymentRequestsResponse> {
  const params = new URLSearchParams();
  if (input?.includeClosed) {
    params.set("includeClosed", "true");
  }

  return invokeEdgeFunction<OutgoingPaymentRequestsResponse>(
    "payment-requests",
    `/outgoing${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: buildScopeInput(input),
    }
  );
}

export async function getRecentPaymentRequestParticipants(input?: {
  citySlug?: string | null;
  appContext?: AppScopeInput | null;
}): Promise<RecentPaymentRequestParticipantsResponse> {
  return invokeEdgeFunction<RecentPaymentRequestParticipantsResponse>(
    "payment-requests",
    "/recent-participants",
    {
      method: "GET",
      appContext: buildScopeInput(input),
    }
  );
}

export async function createPaymentRequest(
  input: CreatePaymentRequestInput
): Promise<{ request: PaymentRequestRecord }> {
  return invokeEdgeFunction<{ request: PaymentRequestRecord }>("payment-requests", "/create", {
    method: "POST",
    body: {
      requestFrom: input.requestFrom ?? null,
      amountRequested: input.amountRequested ?? null,
    },
    appContext: buildScopeInput(input),
  });
}

export async function markPaymentRequestPaid(
  input: MarkPaymentRequestPaidInput
): Promise<{ request: PaymentRequestRecord }> {
  return invokeEdgeFunction<{ request: PaymentRequestRecord }>("payment-requests", "/mark-paid", {
    method: "POST",
    body: {
      requestId: input.requestId,
      transactionId: input.transactionId ?? null,
    },
    appContext: buildScopeInput(input),
  });
}

export async function dismissPaymentRequest(
  input: DismissPaymentRequestInput
): Promise<{ request: PaymentRequestRecord }> {
  return invokeEdgeFunction<{ request: PaymentRequestRecord }>("payment-requests", "/dismiss", {
    method: "POST",
    body: {
      requestId: input.requestId,
    },
    appContext: buildScopeInput(input),
  });
}

export async function cancelPaymentRequest(
  input: CancelPaymentRequestInput
): Promise<{ request: PaymentRequestRecord }> {
  return invokeEdgeFunction<{ request: PaymentRequestRecord }>("payment-requests", "/cancel", {
    method: "POST",
    body: {
      requestId: input.requestId,
    },
    appContext: buildScopeInput(input),
  });
}
