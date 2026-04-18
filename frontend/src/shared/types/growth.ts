import type { ISODateString } from './common';

export interface GrowthMeasurement {
  id: number;
  patient_id: number;
  measured_at: ISODateString;
  height_cm: number | null;
  weight_kg: number | null;
  head_circumference_cm: number | null;
  notes: string | null;
  created_at: ISODateString;
}
