export type GovernanceActionRecord = {
  id: string | number;
  action_type: string;
  reason: string | null;
  store_id?: number | null;
  bia_id?: string | null;
  created_at: string | null;
  payload?: Record<string, unknown> | null;
};

export type GovernanceActionsResponse = {
  citySlug: string;
  appInstanceId: number;
  actions: GovernanceActionRecord[];
};
