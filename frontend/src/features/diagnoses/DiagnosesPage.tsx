import { Outlet, useNavigate } from 'react-router';
import { IconAlertCircle, IconCircleCheck, IconStethoscope, IconRefresh } from '@tabler/icons-react';
import { PageContainer } from '@/shared/layout/PageContainer';
import { EmptyState, SkeletonList, Button } from '@/shared/ui';
import { useDiagnoses } from './hooks/useDiagnoses';
import { DiagnosisCard } from './components/DiagnosisCard';
import type { Diagnosis } from '@/shared/types';

export function DiagnosesPage() {
  const { data, isLoading, error, refetch } = useDiagnoses();
  const navigate = useNavigate();

  if (isLoading && !data) {
    return (
      <PageContainer>
        <SkeletonList count={3} height={80} />
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
          action={<Button icon={<IconRefresh size={16} />} onClick={() => refetch()}>Повторить</Button>}
        />
      </PageContainer>
    );
  }

  const all = data ?? [];
  const active = all.filter((d) => d.status === 'active');
  const other = all.filter((d) => d.status !== 'active');

  if (all.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={<IconStethoscope size={48} color="var(--text-secondary)" />}
          text="Нет диагнозов"
        />
        <Outlet />
      </PageContainer>
    );
  }

  const handleClick = (d: Diagnosis) => navigate(`/diagnoses/${d.id}`);

  return (
    <PageContainer>
      {active.length > 0 && (
        <>
          <div className="section-subtitle">
            <IconAlertCircle size={14} style={{ marginRight: 4 }} /> Активные ({active.length})
          </div>
          {active.map((d) => (
            <DiagnosisCard key={d.id} diagnosis={d} onClick={handleClick} />
          ))}
        </>
      )}
      {other.length > 0 && (
        <>
          <div className="section-subtitle" style={{ marginTop: 16 }}>
            <IconCircleCheck size={14} style={{ marginRight: 4 }} /> Закрытые ({other.length})
          </div>
          {other.map((d) => (
            <DiagnosisCard key={d.id} diagnosis={d} onClick={handleClick} />
          ))}
        </>
      )}
      <Outlet />
    </PageContainer>
  );
}
