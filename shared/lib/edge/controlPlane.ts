export type ControlPlaneAccess = {
  citySlug: string;
  appInstanceId: number;
  isAdminOrOperator: boolean;
  canAccessAdminDashboard: boolean;
  canAccessCityManager: boolean;
};
