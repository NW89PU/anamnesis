import type { Diagnosis } from './diagnosis';
import type { Medication } from './medication';
import type { Specialist } from './specialist';
import type { MedicalError } from './error';
import type { Reminder } from './reminder';
import type { Patient } from './patient';
import type { PlanItem } from './plan';
import type { Vaccination } from './vaccination';
import type { GrowthMeasurement } from './growth';
import type { LabResult } from './lab-result';

/**
 * Реальная форма ответа GET /api/dashboard (подтверждено через
 * backend/src/routes/dashboard.js).
 *
 * ВАЖНО: `stats.plan_total` — это count «осталось» (status != 'done'),
 * а НЕ общее количество. Плохо названное поле, но не меняем для совместимости.
 */
export interface DashboardResponse {
  patient: Patient | null;
  active_diagnoses: Diagnosis[];
  active_medications: Medication[];
  active_specialists: Specialist[];
  upcoming_reminders: Reminder[];
  urgent_plan_items: PlanItem[];
  open_errors: MedicalError[];
  upcoming_vaccinations: Vaccination[];
  latest_growth: GrowthMeasurement | null;
  lab_anomalies: LabResult[];
  stats: {
    documents: number | string;
    plan_total: number | string; // на самом деле «осталось»
    plan_done: number | string;
    errors_open: number | string;
    diagnoses: number;
    specialists: number;
    reminders: number;
  };
}

/**
 * GET /api/dashboard/ai-summary — может вернуть пустой `{ summary: '', updated_at: null }`
 * если AI ещё не прогнал.
 */
export interface DashboardAiSummary {
  summary: string;
  priorities?: string[] | null;
  next_steps?: string[] | null;
  warnings?: string[] | null;
  updated_at: string | null;
}
