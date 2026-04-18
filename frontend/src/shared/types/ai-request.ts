import type { ISODateString } from './common';

export type AiRequestStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface AiRequest {
  id: number;
  patient_id: number;
  entity_type: string;
  entity_id: number;
  prompt: string | null;
  status: AiRequestStatus;
  response: string | null;
  created_at: ISODateString;
  completed_at: ISODateString | null;
}
