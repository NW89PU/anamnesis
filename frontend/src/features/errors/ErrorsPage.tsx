import { Outlet, useNavigate } from 'react-router';
import { IconCircleCheck, IconAlertTriangle, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { PageContainer } from '@/shared/layout/PageContainer';
import { EmptyState, SkeletonList, Button } from '@/shared/ui';
import { useErrors } from './hooks/useErrors';
import { ErrorCard } from './components/ErrorCard';
import type { MedicalError } from '@/shared/types';

export function ErrorsPage() {
  const { data, isLoading, error: fetchError, refetch } = useErrors();
  const navigate = useNavigate();

  if (isLoading && !data) {
    return (
      <PageContainer>
        <SkeletonList count={3} height={100} />
      </PageContainer>
    );
  }

  if (fetchError && !data) {
    return (
      <PageContainer>
        <EmptyState
          icon={<IconAlertCircle size={48} color="var(--red)" />}
          title="Не удалось загрузить"
          text={(fetchError as Error).message}
          action={<Button icon={<IconRefresh size={16} />} onClick={() => refetch()}>Повторить</Button>}
        />
      </PageContainer>
    );
  }

  const all = data ?? [];
  if (all.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={<IconCircleCheck size={48} color="var(--green)" />}
          text="Ошибок не обнаружено"
        />
        <Outlet />
      </PageContainer>
    );
  }

  const openErrors = all.filter((e) => e.status !== 'resolved');
  const resolved = all.filter((e) => e.status === 'resolved');

  const handleClick = (err: MedicalError) => navigate(`/errors/${err.id}`);

  return (
    <PageContainer>
      {openErrors.length > 0 && (
        <>
          <div className="section-subtitle">
            <IconAlertTriangle size={14} style={{ marginRight: 4 }} /> Открытые ({openErrors.length})
          </div>
          {openErrors.map((e) => (
            <ErrorCard key={e.id} error={e} onClick={handleClick} />
          ))}
        </>
      )}

      {resolved.length > 0 && (
        <>
          <div className="section-subtitle" style={{ marginTop: 20 }}>
            <IconCircleCheck size={14} style={{ marginRight: 4 }} /> Решённые ({resolved.length})
          </div>
          {resolved.map((e) => (
            <ErrorCard key={e.id} error={e} onClick={handleClick} />
          ))}
        </>
      )}

      <Outlet />
    </PageContainer>
  );
}
