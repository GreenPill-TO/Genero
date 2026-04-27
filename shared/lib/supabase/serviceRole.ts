import "server-only";
import { createServiceRoleClientCore } from "./serviceRoleCore";

export function createServiceRoleClient() {
  return createServiceRoleClientCore();
}
