import type { ISODateString } from './common';

export type VaccinationStatus = 'scheduled' | 'done' | 'skipped' | 'postponed';

export interface Vaccination {
  id: number;
  patient_id: number;
  name: string;
  vaccine_name: string | null;
  dose_number: number | null;
  batch_number: string | null;
  administered_by: string | null;
  scheduled_date: ISODateString | null;
  actual_date: ISODateString | null;
  status: VaccinationStatus;
  clinic: string | null;
  reaction: string | null;
  notes: string | null;
  /** В бэкенде поле называется `photos` — массив URL'ов */
  photos: string[] | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
