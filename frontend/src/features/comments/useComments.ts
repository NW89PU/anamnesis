import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchComments, addComment, deleteComment } from './api';
import { haptic } from '@/shared/lib/haptic';

export function useComments(entityType: string, entityId: number) {
  return useQuery({
    queryKey: qk.comments(entityType, entityId),
    queryFn: () => fetchComments({ entity_type: entityType, entity_id: entityId, order: 'desc' }),
  });
}

export function useAddComment(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(entityType, entityId, text),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.comments(entityType, entityId) });
    },
    onError: () => haptic('error'),
  });
}

export function useDeleteComment(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.comments(entityType, entityId) });
    },
    onError: () => haptic('error'),
  });
}
