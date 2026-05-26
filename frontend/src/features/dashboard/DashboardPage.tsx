import { useState } from 'react';
import { PageContainer } from '@/shared/layout/PageContainer';
import { EmptyState, Skeleton, Button } from '@/shared/ui';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { useDashboard, useAiSummary } from './hooks/useDashboard';
import { PatientCard } from './components/PatientCard';
import { StatGrid } from './components/StatGrid';
import { CriticalAlerts } from './components/CriticalAlerts';
import { AiSummarySection } from './components/AiSummarySection';
import { DiagnosesSection } from './components/DiagnosesSection';
import { MedicationsSection } from './components/MedicationsSection';
import { RemindersSection } from './components/RemindersSection';
import { DetailSheet } from './components/DetailSheet';
import { useMe } from '@/shared/auth/useAuth';
import type { Diagnosis, Medication, MedicalError, Reminder } from '@/shared/types';

/**
 * Dashboard — главная страница.
 *
 * Layout (§9 REACT_V2_PLAN.md — отличается от vanilla):
 *  1. PatientCard
 *  2. StatGrid (4 карточки) — ПОДНЯТЫ СЮДА НАВЕРХ (в vanilla были ниже)
 *  3. CriticalAlerts (только critical)
 *  4. AiSummarySection — Collapsible, свёрнута по умолчанию
 *  5. DiagnosesSection — Collapsible, свёрнута по умолчанию
 *  6. MedicationsSection — Collapsible, свёрнута по умолчанию
 *  7. RemindersSection (не collapsible)
 *
 * Модалки деталей — локальные (не route-based). Для Dashboard это ок.
 */

type DetailEntity =
  | { type: 'diagnosis'; data: Diagnosis }
  | { type: 'medication'; data: Medication }
  | { type: 'error'; data: MedicalError }
  | { type: 'reminder'; data: Reminder };

export function DashboardPage() {
  const { data, isLoading, error, refetch, isRefetching } = useDashboard();
  const me = useMe();
  const aiEnabled = !me || me.ai_enabled;
  // useAiSummary() запрашиваем только если AI разрешён — иначе пустой
  // запрос лишний (и засоряет логи 200-ми ответами с null summary)
  const { data: aiSummary } = useAiSummary({ enabled: aiEnabled });
  const [detail, setDetail] = useState<DetailEntity | null>(null);

  if (isLoading && !data) {
    return (
      <PageContainer>
        <Skeleton height={120} />
        <div className="stats-grid" style={{ marginTop: 12 }}>
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </div>
        <Skeleton height={80} />
        <Skeleton height={80} />
      </PageContainer>
    );
  }

  if (error && !data) {
    return (
      <PageContainer>
        <EmptyState
          icon={<IconAlertCircle size={48} color="var(--red)" />}
          title="Не удалось загрузить"
          text={(error as Error).message}
          action={
            <Button icon={<IconRefresh size={16} />} onClick={() => refetch()}>
              Повторить
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!data) return null;

  return (
    <PageContainer>
      <PatientCard patient={data.patient} />

      {/* Цифры — ТЕПЕРЬ ВЫШЕ остального (новое требование §9) */}
      <StatGrid stats={data.stats} />

      <CriticalAlerts
        errors={data.open_errors}
        onSelect={(e) => setDetail({ type: 'error', data: e })}
      />

      {/* Напоминания — ВЫШЕ спойлеров, т.к. это самое срочное */}
      <RemindersSection
        reminders={data.upcoming_reminders}
        onSelect={(r) => setDetail({ type: 'reminder', data: r })}
      />

      {aiEnabled && <AiSummarySection data={aiSummary} />}

      <DiagnosesSection
        diagnoses={data.active_diagnoses}
        onSelect={(d) => setDetail({ type: 'diagnosis', data: d })}
      />

      <MedicationsSection
        medications={data.active_medications}
        onSelect={(m) => setDetail({ type: 'medication', data: m })}
      />

      {isRefetching && (
        <div
          style={{
            position: 'fixed',
            top: 8,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-secondary)',
            pointerEvents: 'none',
          }}
        >
          Обновление...
        </div>
      )}

      <DetailSheet entity={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  );
}
