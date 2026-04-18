import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type { MedicalError } from '@/shared/types';

export const fetchErrors = (): Promise<MedicalError[]> => api.get<MedicalError[]>(EP.errors);

export const updateError = (id: number, patch: Partial<MedicalError>): Promise<MedicalError> =>
  api.put<MedicalError>(EP.errorItem(id), patch);
