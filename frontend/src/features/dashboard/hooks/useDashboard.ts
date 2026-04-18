import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchDashboard, fetchAiSummary } from '../api';

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: fetchDashboard,
  });
}

export function useAiSummary() {
  return useQuery({
    queryKey: qk.dashboardAiSummary,
    queryFn: fetchAiSummary,
    retry: false,
  });
}
