import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchErrors, updateError } from '../api';
import { haptic } from '@/shared/lib/haptic';
import type { MedicalError } from '@/shared/types';

export function useErrors() {
  return useQuery({
    queryKey: qk.errors,
    queryFn: fetchErrors,
  });
}

export function useToggleErrorStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (error: MedicalError) => {
      const newStatus: MedicalError['status'] = error.status === 'resolved' ? 'open' : 'resolved';
      return updateError(error.id, { ...error, status: newStatus });
    },
    onSuccess: () => {
      haptic('success');
      void qc.invalidateQueries({ queryKey: qk.errors });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: () => haptic('error'),
  });
}
