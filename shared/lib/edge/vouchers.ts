export type VoucherPreferencesResponse = {
  citySlug: string;
  appInstanceId: number;
  preferences: Array<Record<string, unknown>>;
};
