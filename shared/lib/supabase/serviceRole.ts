import "server-only";
import { createServiceRoleClientCore } from "./serviceRoleCore";

export function createServiceRoleClient(options?: { context?: string }) {
  return createServiceRoleClientCore(options);
}
