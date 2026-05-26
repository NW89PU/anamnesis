import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchDashboard, fetchAiSummary } from '../api';

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: fetchDashboard,
  });
}

/**
 * @param opts.enabled — пропуск запроса. Используется когда AI-фичи
 *   отключены для текущего юзера (users.ai_enabled=0) — нет смысла
 *   тянуть пустой summary и засорять логи.
 */
export function useAiSummary(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.dashboardAiSummary,
    queryFn: fetchAiSummary,
    retry: false,
    enabled: opts.enabled !== false,
  });
}
