import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import {
  createVisit,
  updateVisit,
  deleteVisit,
  uploadDocument,
  createAiRequest,
  fetchPendingAiRequests,
  type VisitInput,
  type UploadDocumentInput,
} from '../api';
import { haptic } from '@/shared/lib/haptic';
import { useQuery } from '@tanstack/react-query';

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VisitInput) => createVisit(data),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.timelineAll });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: () => haptic('error'),
  });
}

export function useUpdateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: VisitInput }) => updateVisit(id, data),
    onSuccess: (_data, vars) => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.timelineAll });
      void qc.invalidateQueries({ queryKey: qk.timelineItem(vars.id) });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: () => haptic('error'),
  });
}

export function useDeleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteVisit(id),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.timelineAll });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: () => haptic('error'),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(input),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.timelineAll });
      void qc.invalidateQueries({ queryKey: qk.documents });
    },
    onError: () => haptic('error'),
  });
}

export function useCreateTimelineAiRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      createAiRequest({ entity_type: 'timeline', entity_id: id }),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.aiRequests });
    },
    onError: () => haptic('error'),
  });
}

/**
 * Список pending AI-запросов — используется в Documents для отображения
 * индикатора "ожидает AI" на карточках визитов.
 */
export function usePendingAiRequests() {
  return useQuery({
    queryKey: qk.aiRequests,
    queryFn: fetchPendingAiRequests,
    retry: false,
  });
}
