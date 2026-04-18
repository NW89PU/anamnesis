import { useState, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router';
import {
  IconAlertCircle,
  IconStethoscope,
  IconRefresh,
  IconUpload,
  IconFolderOpen,
} from '@tabler/icons-react';
import { PageContainer } from '@/shared/layout/PageContainer';
import { EmptyState, SkeletonList, Button } from '@/shared/ui';
import { useTimeline, useAllDocuments } from './hooks/useTimeline';
import { usePendingAiRequests } from './hooks/useVisitMutations';
import { FilterTabs } from './components/FilterTabs';
import { VisitCard } from './components/VisitCard';
import { StandaloneDocCard } from './components/StandaloneDocCard';
import {
  filterTimeline,
  groupByYear,
  buildUnifiedEntries,
  groupEntriesByYear,
  groupDocsByYear,
  type DocumentsFilter,
} from './lib/doc-helpers';
import { haptic } from '@/shared/lib/haptic';
import type { Timeline, Document } from '@/shared/types';

/**
 * Documents page — timeline визитов и документов.
 *
 * MVP (этот PR): список с фильтрами + клик открывает route-based модалку
 * `/documents/visit/:visitId`.
 *
 * Будущее (Sonnet): формы создания визита, загрузки документа, редактирования,
 * транскрипции, запроса AI. См. комментарий в router.tsx.
 */
export function DocumentsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<DocumentsFilter>('all');
  const { data, isLoading, error, refetch, isRefetching } = useTimeline();
  const { data: allDocs = [] } = useAllDocuments();
  const { data: pendingAi = [] } = usePendingAiRequests();

  // Set pending AI entity IDs for quick lookup in VisitCard
  const pendingAiVisitIds = useMemo(
    () =>
      new Set(
        (pendingAi ?? [])
          .filter((r) => r.entity_type === 'timeline')
          .map((r) => r.entity_id)
      ),
    [pendingAi]
  );

  // Standalone docs = документы не привязанные ни к одному визиту
  const standaloneDocs = useMemo(() => {
    const linked = new Set<number>();
    for (const t of data ?? []) {
      for (const d of t.documents ?? []) linked.add(d.id);
    }
    return allDocs.filter((d) => !d.timeline_id || !linked.has(d.id));
  }, [data, allDocs]);

  // Для фильтра "Все" — объединённая хронология visits + standalone docs
  // отсортированная по дате DESC (самое свежее сверху). Иначе недавние
  // лабораторные анализы (standalone) попадали в самый низ списка.
  const unifiedGrouped = useMemo(() => {
    if (!data) return [];
    const visits = filterTimeline(data, 'visits');
    const entries = buildUnifiedEntries(visits, standaloneDocs);
    return groupEntriesByYear(entries);
  }, [data, standaloneDocs]);

  // Для фильтра "Приёмы" — только timeline visits по годам (legacy behavior)
  const visitsGrouped = useMemo(() => {
    if (!data) return [];
    const visits = filterTimeline(data, 'visits');
    return groupByYear(visits);
  }, [data]);

  // Для фильтра "Документы" — standalone docs по годам
  const docsGrouped = useMemo(() => {
    return groupDocsByYear(standaloneDocs);
  }, [standaloneDocs]);

  const handleItemClick = (item: Timeline) => {
    haptic('light');
    navigate(`/documents/visit/${item.id}`);
  };

  const handleDocClick = (doc: Document) => {
    haptic('light');
    navigate(`/documents/doc/${doc.id}`);
  };

  const hasAnyContent =
    filter === 'all'
      ? unifiedGrouped.length > 0
      : filter === 'visits'
        ? visitsGrouped.length > 0
        : docsGrouped.length > 0;

  if (isLoading && !data) {
    return (
      <PageContainer>
        <FilterTabs active={filter} onChange={setFilter} />
        <SkeletonList count={5} height={100} />
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

  return (
    <PageContainer>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button
          size="sm"
          block
          icon={<IconStethoscope size={14} />}
          onClick={() => {
            haptic('light');
            navigate('/documents/new');
          }}
        >
          Новый приём
        </Button>
        <Button
          size="sm"
          variant="secondary"
          block
          icon={<IconUpload size={14} />}
          onClick={() => {
            haptic('light');
            navigate('/documents/upload');
          }}
        >
          Загрузить док.
        </Button>
      </div>

      <FilterTabs active={filter} onChange={setFilter} />

      {!hasAnyContent ? (
        <EmptyState
          icon={<IconFolderOpen size={48} color="var(--text-secondary)" />}
          title="Пусто"
          text={
            filter === 'visits'
              ? 'Приёмов пока нет'
              : filter === 'docs'
                ? 'Отдельных документов нет'
                : 'Добавьте приём или загрузите документ'
          }
        />
      ) : filter === 'all' ? (
        // Фильтр "Все" — объединённая хронология visits + standalone docs
        // отсортированная по дате DESC. Самое свежее всегда сверху,
        // независимо от того, привязан документ к визиту или нет.
        unifiedGrouped.map((group) => (
          <div key={group.year}>
            <div className="section-subtitle">{group.year}</div>
            <div className="timeline-group">
              {group.items.map((entry) =>
                entry.kind === 'visit' ? (
                  <VisitCard
                    key={`v-${entry.visit.id}`}
                    item={entry.visit}
                    onClick={handleItemClick}
                    aiPending={pendingAiVisitIds.has(entry.visit.id)}
                  />
                ) : (
                  <StandaloneDocCard
                    key={`d-${entry.doc.id}`}
                    doc={entry.doc}
                    onClick={handleDocClick}
                  />
                )
              )}
            </div>
          </div>
        ))
      ) : filter === 'visits' ? (
        // Фильтр "Приёмы" — только timeline visits по годам
        visitsGrouped.map((group) => (
          <div key={group.year}>
            <div className="section-subtitle">{group.year}</div>
            <div className="timeline-group">
              {group.items.map((item) => (
                <VisitCard
                  key={item.id}
                  item={item}
                  onClick={handleItemClick}
                  aiPending={pendingAiVisitIds.has(item.id)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        // Фильтр "Документы" — только standalone docs по годам, сортировка по дате
        docsGrouped.map((group) => (
          <div key={group.year}>
            <div className="section-subtitle">{group.year}</div>
            <div className="timeline-group">
              {group.items.map((doc) => (
                <StandaloneDocCard key={doc.id} doc={doc} onClick={handleDocClick} />
              ))}
            </div>
          </div>
        ))
      )}

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

      {/* Route-based модалки (VisitDetailsModal и т.п.) */}
      <Outlet />
    </PageContainer>
  );
}
