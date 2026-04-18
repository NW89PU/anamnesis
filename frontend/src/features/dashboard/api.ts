import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type { DashboardResponse, DashboardAiSummary } from '@/shared/types';

export const fetchDashboard = (): Promise<DashboardResponse> => api.get<DashboardResponse>(EP.dashboard);

export const fetchAiSummary = (): Promise<DashboardAiSummary | null> =>
  api.get<DashboardAiSummary | null>(EP.dashboardAiSummary).catch(() => null);
