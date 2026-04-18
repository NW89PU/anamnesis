import type { ISODateString } from './common';

/**
 * Статус результата анализа — совпадает с vanilla.
 * - normal: в пределах нормы
 * - low: ниже нормы
 * - high: выше нормы
 * - critical: критическое отклонение
 */
export type LabResultStatus = 'normal' | 'low' | 'high' | 'critical';

export interface LabResult {
  id: number;
  patient_id: number;
  test_name: string;
  parameter: string;
  /** Значение может быть числом или строкой (например "положительно") */
  value: string | number | null;
  unit: string | null;
  /** Минимум нормы (числовое поле из БД) */
  ref_min: number | null;
  /** Максимум нормы (числовое поле из БД) */
  ref_max: number | null;
  status: LabResultStatus | null;
  test_date: ISODateString;
  lab_name: string | null;
  notes: string | null;
  created_at: ISODateString;
}
