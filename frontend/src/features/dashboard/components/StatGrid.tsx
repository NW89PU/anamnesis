import { IconListCheck, IconCircleCheck, IconAlertTriangle, IconStethoscope } from '@tabler/icons-react';
import { StatCard } from '@/shared/ui';
import type { DashboardResponse } from '@/shared/types';

/**
 * 4 карточки статистики. Порядок фиксированный:
 * Осталось | Выполнено | Ошибки | Диагнозы
 *
 * В новом layout (§9 плана) ЭТО ПЕРВОЕ ЧТО ВИДИТ ПОЛЬЗОВАТЕЛЬ после PatientCard.
 *
 * `plan_total` в API на самом деле означает «осталось» (плохое имя в vanilla,
 * сохраняем для совместимости).
 */
export function StatGrid({ stats }: { stats: DashboardResponse['stats'] }) {
  return (
    <div className="stats-grid">
      <StatCard
        value={stats.plan_total ?? 0}
        label="Осталось"
        icon={<IconListCheck size={14} style={{ marginRight: 4 }} />}
        color="orange"
        to="/plan"
      />
      <StatCard
        value={stats.plan_done ?? 0}
        label="Выполнено"
        icon={<IconCircleCheck size={14} style={{ marginRight: 4 }} />}
        color="green"
        to="/plan?tab=done"
      />
      <StatCard
        value={stats.errors_open ?? 0}
        label="Ошибки"
        icon={<IconAlertTriangle size={14} style={{ marginRight: 4 }} />}
        color="red"
        to="/errors"
      />
      <StatCard
        value={stats.diagnoses ?? 0}
        label="Диагнозы"
        icon={<IconStethoscope size={14} style={{ marginRight: 4 }} />}
        color="purple"
        to="/diagnoses"
      />
    </div>
  );
}
