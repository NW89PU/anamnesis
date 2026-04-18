import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type { PlanItem } from '@/shared/types';

export const fetchPlan = (): Promise<PlanItem[]> => api.get<PlanItem[]>(EP.plan);

export const fetchPlanItem = (id: number): Promise<PlanItem> =>
  api.get<PlanItem>(EP.planItem(id));

export const updatePlanItem = (id: number, patch: Partial<PlanItem>): Promise<PlanItem> =>
  api.put<PlanItem>(EP.planItem(id), patch);
