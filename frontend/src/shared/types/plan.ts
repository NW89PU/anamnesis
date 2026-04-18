import type { ISODateString, Priority } from './common';

export type PlanStatus = 'pending' | 'in_progress' | 'done';

export interface PlanItem {
  id: number;
  patient_id: number;
  title: string;
  description: string | null;
  detail: string | null;
  priority: Priority;
  status: PlanStatus;
  advice: string | null;
  deadline: ISODateString | null;
  sort_order: number;
  ai_assessment: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
