import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type { Diagnosis, AiRequest } from '@/shared/types';

export const fetchDiagnoses = (): Promise<Diagnosis[]> => api.get<Diagnosis[]>(EP.diagnoses);

/**
 * Список pending AI-запросов (используется для отображения «отправлено»)
 */
export const fetchPendingAiRequests = (): Promise<AiRequest[]> =>
  api.get<AiRequest[]>(`${EP.aiRequests}?status=pending`);

/**
 * Создать AI-запрос для сущности (диагноз, препарат, визит, ...)
 */
export const createAiRequest = (entity_type: string, entity_id: number): Promise<AiRequest> =>
  api.post<AiRequest>(EP.aiRequests, { entity_type, entity_id });
