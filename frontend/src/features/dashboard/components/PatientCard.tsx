import {
  IconRuler2,
  IconScale,
  IconBabyCarriage,
  IconAlertCircle,
} from '@tabler/icons-react';
import { formatDate, calcAge } from '@/shared/lib/date';
import type { Patient } from '@/shared/types';

/**
 * Карточка пациента на Dashboard. Порт из vanilla `dashboard.js:210-235`.
 * Использует класс `.patient-card` из app.css.
 */
export function PatientCard({ patient }: { patient: Patient | null }) {
  if (!patient) return null;
  const age = calcAge(patient.date_of_birth);

  return (
    <div className="patient-card">
      <div className="patient-name">{patient.full_name ?? 'Пациент'}</div>
      <div className="patient-info">
        {patient.date_of_birth && formatDate(patient.date_of_birth)}
        {age && ` (${age})`}
        {patient.gender && ` / ${patient.gender}`}
        {patient.city && ` / ${patient.city}`}
      </div>
      <div className="patient-meta">
        {patient.current_height_cm != null && (
          <span>
            <IconRuler2 size={14} style={{ marginRight: 4 }} />
            {patient.current_height_cm} см
          </span>
        )}
        {patient.current_weight_kg != null && (
          <span>
            <IconScale size={14} style={{ marginRight: 4 }} />
            {patient.current_weight_kg} кг
          </span>
        )}
        {patient.birth_weight_g != null && (
          <span>
            <IconBabyCarriage size={14} style={{ marginRight: 4 }} />
            {patient.birth_weight_g} г
          </span>
        )}
      </div>
      {patient.allergies && (
        <div className="patient-meta" style={{ marginTop: 8 }}>
          <span>
            <IconAlertCircle size={14} style={{ marginRight: 4 }} />
            Аллергии: {patient.allergies}
          </span>
        </div>
      )}
    </div>
  );
}
