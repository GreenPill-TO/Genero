import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type { CreateUserRequestInput } from "./userRequests";

export async function createUserRequest(
  input: CreateUserRequestInput,
  appContext?: AppScopeInput | null
): Promise<{ success: true }> {
  return invokeEdgeFunction<{ success: true }>("user-requests", "/create", {
    method: "POST",
    body: input as unknown as Record<string, unknown>,
    appContext,
  });
}
