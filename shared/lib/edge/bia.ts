export type BiaRecord = {
  id: string;
  code: string;
  name: string;
  status?: string;
  center_lat?: number | null;
  center_lng?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type UserBiaAffiliation = {
  id: string | number;
  biaId: string;
  source?: string | null;
  effectiveFrom?: string | null;
};

export type BiaListResponse = {
  citySlug: string;
  appInstanceId: number;
  activeAffiliation: UserBiaAffiliation | null;
  secondaryAffiliations: UserBiaAffiliation[];
  bias: BiaRecord[];
  mappings: unknown[];
  controls: unknown[];
  canAdminister: boolean;
};
