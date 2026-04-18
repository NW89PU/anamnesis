import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useSearchParams } from 'react-router';
import { IconCircleCheck, IconList, IconUrgent, IconFlagFilled, IconCalendar, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { PageContainer } from '@/shared/layout/PageContainer';
import { EmptyState, SkeletonList, Button } from '@/shared/ui';
import { usePlan, useTogglePlanStatus } from './hooks/usePlan';
import { PlanTabs, type PlanTab } from './components/PlanTabs';
import { PlanChecklistItem } from './components/PlanChecklistItem';
import { PRIORITY_LABELS, PRIORITY_ORDER, groupByPriority } from './lib/plan-helpers';
import type { PlanItem, Priority } from '@/shared/types';

/**
 * Plan page — список задач с табами pending/done + route-based детали.
 *
 * Чтение url `?tab=done` поддерживается (для клика со StatCard на Dashboard).
 */
export function PlanPage() {
  const { data, isLoading, error, refetch } = usePlan();
  const toggle = useTogglePlanStatus();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab: PlanTab = searchParams.get('tab') === 'done' ? 'done' : 'pending';
  const [tab, setTab] = useState<PlanTab>(initialTab);

  const { pendingItems, doneItems } = useMemo(() => {
    const all = data ?? [];
    return {
      pendingItems: all.filter((i) => i.status !== 'done'),
      doneItems: all.filter((i) => i.status === 'done'),
    };
  }, [data]);

  const currentItems = tab === 'pending' ? pendingItems : doneItems;
  const grouped = useMemo(() => groupByPriority(currentItems), [currentItems]);

  const openItem = (item: PlanItem) => navigate(`/plan/${item.id}`);

  if (isLoading && !data) {
    return (
      <PageContainer>
        <SkeletonList count={4} height={72} />
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

  return (
    <PageContainer>
      <PlanTabs
        active={tab}
        pendingCount={pendingItems.length}
        doneCount={doneItems.length}
        onChange={setTab}
      />

      {currentItems.length === 0 ? (
        <EmptyState
          icon={tab === 'pending'
            ? <IconCircleCheck size={48} color="var(--text-secondary)" />
            : <IconList size={48} color="var(--text-secondary)" />}
          text={tab === 'pending' ? 'Все задачи выполнены!' : 'Нет выполненных задач'}
        />
      ) : (
        PRIORITY_ORDER.map((priority: Priority) => {
          const group = grouped[priority];
          if (group.length === 0) return null;
          return (
            <div key={priority}>
              <div className="section-subtitle">
                {priority === 'urgent' && <IconUrgent size={14} style={{ marginRight: 4 }} />}
                {priority === 'high' && <IconFlagFilled size={14} style={{ marginRight: 4 }} />}
                {(priority === 'medium' || priority === 'low') && (
                  <IconCalendar size={14} style={{ marginRight: 4 }} />
                )}
                {PRIORITY_LABELS[priority]} ({group.length})
              </div>
              {group.map((item) => (
                <PlanChecklistItem
                  key={item.id}
                  item={item}
                  onToggle={(i) => toggle.mutate(i)}
                  onOpen={openItem}
                />
              ))}
            </div>
          );
        })
      )}

      <Outlet />
    </PageContainer>
  );
}
