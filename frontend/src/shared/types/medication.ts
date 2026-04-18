import type { ISODateString } from './common';

export type MedicationStatus = 'active' | 'completed' | 'stopped';

export interface Medication {
  id: number;
  patient_id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: ISODateString | null;
  end_date: ISODateString | null;
  prescribed_by: string | null;
  specialist_id: number | null;
  status: MedicationStatus;
  stop_reason: string | null;
  notes: string | null;
  detail: string | null;
  ai_assessment: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  /** Добавляется бэкендом при JOIN со specialists */
  prescribed_by_name?: string | null;
  prescribed_by_spec?: string | null;
}
