import type { ISODateString } from './common';

export type DiagnosisStatus = 'active' | 'resolved' | 'suspected';

export interface Diagnosis {
  id: number;
  patient_id: number;
  icd_code: string | null;
  name: string;
  status: DiagnosisStatus;
  diagnosed_date: ISODateString | null;
  source: string | null;
  notes: string | null;
  ai_assessment: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
