import { useParams, useNavigate } from 'react-router';
import {
  IconCalendar,
  IconStethoscope,
  IconUser,
  IconMicrophone,
  IconBrain,
  IconFiles,
  IconEdit,
  IconClock,
} from '@tabler/icons-react';
import { Modal, Badge, Spinner, ExpandableText, Button, CopyButton } from '@/shared/ui';
import { useTimelineItem } from '../hooks/useTimeline';
import { useTimeline } from '../hooks/useTimeline';
import {
  useCreateTimelineAiRequest,
  usePendingAiRequests,
} from '../hooks/useVisitMutations';
import { DocumentBlock } from '../components/DocumentBlock';
import { CommentsSection } from '@/features/comments/CommentsSection';
import { CATEGORY_LABELS } from '../lib/doc-helpers';
import { haptic } from '@/shared/lib/haptic';
import type { Timeline } from '@/shared/types';

/**
 * Route-based модалка деталей визита.
 * Путь: /documents/visit/:visitId
 *
 * Данные берутся из общего кэша `useTimeline()` (массив), а если там нет —
 * делается отдельный запрос /api/timeline/:id. Это экономит сеть: при клике
 * из списка визит уже есть в кэше, грузить ничего не надо.
 */
export default function VisitDetailsModal() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const id = visitId ? parseInt(visitId, 10) : null;

  // 1) Пытаемся найти в общем списке (уже загружен при открытии страницы)
  const { data: timeline } = useTimeline();
  const fromList: Timeline | undefined = timeline?.find((t) => t.id === id);

  // 2) Fallback: отдельный запрос на случай прямого открытия по ссылке/F5
  const { data: fromItem, isLoading } = useTimelineItem(fromList ? null : id);

  const visit = fromList ?? fromItem;

  // AI request state
  const requestAi = useCreateTimelineAiRequest();
  const { data: pendingAi } = usePendingAiRequests();
  const hasAiPending =
    visit != null &&
    (pendingAi ?? []).some(
      (r) => r.entity_type === 'timeline' && r.entity_id === visit.id
    );

  if (!id) return null;

  if (isLoading && !visit) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  if (!visit) {
    return (
      <Modal title="Не найдено">
        <p style={{ color: 'var(--text-secondary)' }}>Визит не найден или был удалён.</p>
      </Modal>
    );
  }

  const dateStr = new Date(visit.event_date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const specName = visit.specialist_name_resolved ?? visit.specialist_name;
  const specType = visit.specialist_specialty ?? visit.specialist_type;
  const specialistInfo = specName ?? specType;
  const docs = visit.documents ?? [];

  return (
    <Modal title={visit.title}>
      {/* Метаинфо: категория + дата */}
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <Badge color="gray" icon={<IconStethoscope size={12} />}>
          {(visit.category && CATEGORY_LABELS[visit.category]) ?? visit.category ?? 'Приём'}
        </Badge>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <IconCalendar size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> {dateStr}
        </span>
      </div>

      {/* Специалист */}
      {specialistInfo && (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(0,122,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconUser size={20} color="var(--blue)" />
          </div>
          <div>
            {specName && (
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{specName}</div>
            )}
            {specType && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{specType}</div>
            )}
          </div>
        </div>
      )}

      {/* Описание */}
      {visit.description && (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <ExpandableText text={visit.description} bg="var(--bg)" textStyle={{ fontSize: 14, lineHeight: 1.7 }} />
        </div>
      )}

      {visit.notes && (
        <div style={{ marginBottom: 16 }}>
          <ExpandableText
            text={visit.notes}
            bg="var(--card)"
            textStyle={{ fontSize: 13, color: 'var(--text-secondary)' }}
          />
        </div>
      )}

      {/* Транскрипция */}
      {visit.transcription && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconMicrophone size={14} /> Расшифровка приёма
            </span>
            <CopyButton text={visit.transcription} />
          </div>
          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <ExpandableText
              text={visit.transcription}
              bg="var(--bg)"
              textStyle={{ lineHeight: 1.8 }}
              actionColor="var(--text)"
            />
          </div>
        </div>
      )}

      {/* AI-анализ */}
      {visit.ai_assessment && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--purple)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IconBrain size={14} /> Анализ AI
          </div>
          <div
            style={{
              background: '#F8F1FC',
              border: '1px solid rgba(175,82,222,0.15)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <ExpandableText
              text={visit.ai_assessment}
              bg="#F8F1FC"
              textStyle={{ lineHeight: 1.8 }}
              actionColor="var(--purple)"
            />
          </div>
        </div>
      )}

      {/* Документы */}
      {docs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IconFiles size={14} /> Документы ({docs.length})
          </div>
          {docs.map((d) => (
            <DocumentBlock key={d.id} doc={d} />
          ))}
        </div>
      )}

      {/* Кнопки действий: Редактировать / Добавить расшифровку / Запросить AI */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <Button
          variant="secondary"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            haptic('light');
            navigate(`/documents/visit/${visit.id}/edit`);
          }}
        >
          Редактировать
        </Button>
        {!visit.transcription && (
          <Button
            size="sm"
            icon={<IconMicrophone size={14} />}
            onClick={() => {
              haptic('light');
              navigate(`/documents/visit/${visit.id}/transcription`);
            }}
            style={{
              background: 'rgba(52,199,89,0.12)',
              color: 'var(--green)',
            }}
          >
            Добавить расшифровку
          </Button>
        )}
        {!visit.ai_assessment && (
          <Button
            size="sm"
            icon={hasAiPending || requestAi.isSuccess ? <IconClock size={14} /> : <IconBrain size={14} />}
            disabled={hasAiPending || requestAi.isPending || requestAi.isSuccess}
            loading={requestAi.isPending}
            onClick={() => {
              haptic('light');
              requestAi.mutate(visit.id);
            }}
            style={{
              background:
                hasAiPending || requestAi.isSuccess
                  ? 'rgba(255,149,0,0.12)'
                  : 'rgba(175,82,222,0.12)',
              color:
                hasAiPending || requestAi.isSuccess
                  ? 'var(--orange)'
                  : 'var(--purple)',
            }}
          >
            {hasAiPending || requestAi.isSuccess
              ? 'Ожидает анализа AI'
              : 'Запросить анализ AI'}
          </Button>
        )}
      </div>

      <CommentsSection entityType="timeline" entityId={visit.id} />
    </Modal>
  );
}
