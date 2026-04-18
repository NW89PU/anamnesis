import type { ISODateString, Severity } from './common';

export type MedicalErrorStatus = 'open' | 'resolved';

export interface MedicalError {
  id: number;
  patient_id: number;
  title: string | null;
  description: string;
  detail: string | null;
  advice: string | null;
  /** Коротенький CTA под описанием ошибки ("обратиться к неврологу" и т.п.) */
  action_text: string | null;
  severity: Severity;
  status: MedicalErrorStatus;
  error_date: ISODateString | null;
  ai_assessment: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
