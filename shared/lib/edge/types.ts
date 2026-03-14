import type { AppScopeInput, ResolvedAppScope } from "./appScope";

export type { AppScopeInput, ResolvedAppScope };

export type EdgeFunctionError = {
  error: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  total?: number;
  nextCursor?: string | null;
};
