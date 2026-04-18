import type { ISODateString } from './common';

/**
 * Patient — реальная форма из бэкенда PostgreSQL.
 * ВАЖНО: поля роста/веса именуются `current_height_cm`, `current_weight_kg`
 * (не `height_cm`/`weight_kg`) и есть ещё `birth_weight_g`.
 */
export interface Patient {
  id: number;
  full_name: string | null;
  date_of_birth: ISODateString | null;
  gender: string | null;
  city: string | null;
  allergies: string | null;
  current_height_cm: number | string | null;
  current_weight_kg: number | string | null;
  birth_weight_g: number | string | null;
  notes: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
