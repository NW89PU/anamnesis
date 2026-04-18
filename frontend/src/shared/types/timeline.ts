import type { ISODateString, Severity } from './common';
import type { Document } from './document';

export type TimelineCategory = 'visit' | 'test' | 'diagnosis' | 'milestone';

export interface Timeline {
  id: number;
  patient_id: number;
  title: string;
  description: string | null;
  category: TimelineCategory | string | null;
  event_date: ISODateString;
  severity: Severity | null;
  badge_text: string | null;
  badge_color: string | null;
  notes: string | null;
  specialist_id: number | null;
  specialist_name: string | null;
  specialist_type: string | null;
  transcription: string | null;
  ai_assessment: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  /** Добавляется бэкендом через JOIN со specialists */
  specialist_name_resolved?: string | null;
  specialist_specialty?: string | null;
  /** Документы, привязанные к этому событию timeline */
  documents?: Document[];
}

export interface VisitDiagnosis {
  visit_id: number;
  diagnosis_id: number;
  relation: string | null;
  patient_id: number;
  visit_title?: string;
  visit_date?: ISODateString;
  diagnosis_name?: string;
}
