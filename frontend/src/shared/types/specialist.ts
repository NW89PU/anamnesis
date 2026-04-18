import type { ISODateString } from './common';

export type SpecialistStatus = 'active' | 'inactive';

export interface Specialist {
  id: number;
  patient_id: number;
  full_name: string | null;
  specialization: string;
  clinic: string | null;
  phone: string | null;
  notes: string | null;
  status: SpecialistStatus;
  created_at: ISODateString;
  updated_at: ISODateString;
}
