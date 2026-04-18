import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchPlan, updatePlanItem } from '../api';
import { haptic } from '@/shared/lib/haptic';
import type { PlanItem } from '@/shared/types';

export function usePlan() {
  return useQuery({
    queryKey: qk.plan,
    queryFn: fetchPlan,
  });
}

/**
 * Toggle plan item status (pending ↔ done) с optimistic update.
 * Порт из vanilla `plan.js:187-193`.
 */
export function useTogglePlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: PlanItem) => {
      const newStatus: PlanItem['status'] = item.status === 'done' ? 'pending' : 'done';
      return updatePlanItem(item.id, { ...item, status: newStatus });
    },
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: qk.plan });
      const previous = qc.getQueryData<PlanItem[]>(qk.plan);
      qc.setQueryData<PlanItem[]>(qk.plan, (old) =>
        (old ?? []).map((p) =>
          p.id === item.id
            ? { ...p, status: p.status === 'done' ? 'pending' : 'done' }
            : p
        )
      );
      return { previous };
    },
    onError: (_err, _item, ctx) => {
      haptic('error');
      if (ctx?.previous) qc.setQueryData(qk.plan, ctx.previous);
    },
    onSuccess: () => {
      haptic('success');
      // Инвалидируем dashboard — там тоже есть plan_total / plan_done счётчики
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.plan });
    },
  });
}
