import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchDiagnoses, fetchPendingAiRequests, createAiRequest } from '../api';
import { haptic } from '@/shared/lib/haptic';

export function useDiagnoses() {
  return useQuery({
    queryKey: qk.diagnoses,
    queryFn: fetchDiagnoses,
  });
}

/**
 * Список pending AI-запросов — нужен для рендера статуса «отправлено»
 * на карточке диагноза / препарата.
 */
export function usePendingAiRequests() {
  return useQuery({
    queryKey: qk.aiRequests,
    queryFn: fetchPendingAiRequests,
  });
}

/**
 * Запрос AI-анализа для конкретной сущности (entity_type + entity_id).
 * После успеха инвалидируем pending list чтобы UI показал «отправлено».
 */
export function useCreateAiRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => createAiRequest(type, id),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.aiRequests });
    },
    onError: () => haptic('error'),
  });
}
