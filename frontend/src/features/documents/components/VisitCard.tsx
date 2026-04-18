import {
  IconChevronRight,
  IconUser,
  IconPaperclip,
  IconMicrophone,
  IconBrain,
  IconStethoscope,
  IconTestPipe,
  IconReportMedical,
  IconStar,
  IconCalendar,
  IconClock,
} from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { Badge, EntityId } from '@/shared/ui';
import type { BadgeColor } from '@/shared/ui';
import { DocPreviews } from './DocPreviews';
import { CATEGORY_LABELS, parseEventDate, getSpecialistInfo } from '../lib/doc-helpers';
import type { Timeline } from '@/shared/types';

interface Props {
  item: Timeline;
  onClick: (item: Timeline) => void;
  aiPending?: boolean;
}

/**
 * Карточка элемента timeline — визит, тест, диагноз или milestone.
 * Порт из vanilla `documents.js:81-156` (renderVisitCard + renderEventCard,
 * объединённые в одну функцию с разным иконками по категории).
 */
export function VisitCard({ item, onClick, aiPending = false }: Props) {
  const date = parseEventDate(item.event_date);
  const docs = item.documents ?? [];
  const { name: specName, type: specType } = getSpecialistInfo(item);
  const specialistInfo = specName ?? specType;

  const isVisit = item.category === 'visit' || !item.category;
  const categoryIcon = getCategoryIcon(item.category);
  const categoryLabel =
    (item.category ? CATEGORY_LABELS[item.category] : undefined) ?? item.category ?? 'Приём';

  return (
    <div
      className="timeline-item"
      style={{ cursor: 'pointer' }}
      onClick={() => {
        haptic('light');
        onClick(item);
      }}
    >
      {date && (
        <div className="timeline-date">
          <div className="timeline-date-day">{date.day}</div>
          <div className="timeline-date-month">{date.month}</div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="timeline-title">{item.title}</div>
            {isVisit && specialistInfo ? (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconUser size={13} />
                {specName ?? ''}
                {specName && specType ? ' — ' : ''}
                {specType ?? ''}
              </div>
            ) : (
              item.description && <div className="timeline-category">{item.description}</div>
            )}
          </div>
          <IconChevronRight
            size={18}
            style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}
          />
        </div>

        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, alignItems: 'center' }}
        >
          {item.badge_text && (
            <Badge color={coerceBadgeColor(item.badge_color)}>{item.badge_text}</Badge>
          )}
          <Badge color="gray" icon={categoryIcon}>
            {categoryLabel}
          </Badge>
          {docs.length > 0 && (
            <Badge color="blue" icon={<IconPaperclip size={11} />}>
              {docs.length}
            </Badge>
          )}
          {item.transcription && (
            <Badge color="green" icon={<IconMicrophone size={11} />}>
              Запись
            </Badge>
          )}
          {item.ai_assessment && (
            <Badge color="purple" icon={<IconBrain size={11} />}>
              AI
            </Badge>
          )}
          {!item.ai_assessment && aiPending && (
            <Badge color="orange" icon={<IconClock size={11} />}>
              Ожидает AI
            </Badge>
          )}
          <EntityId id={item.id} />
        </div>

        <DocPreviews docs={docs} />
      </div>
    </div>
  );
}

function getCategoryIcon(category: string | null) {
  switch (category) {
    case 'visit':
      return <IconStethoscope size={11} />;
    case 'test':
      return <IconTestPipe size={11} />;
    case 'diagnosis':
      return <IconReportMedical size={11} />;
    case 'milestone':
      return <IconStar size={11} />;
    default:
      return <IconCalendar size={11} />;
  }
}

function coerceBadgeColor(color: string | null): BadgeColor {
  if (!color) return 'gray';
  const valid: BadgeColor[] = ['blue', 'green', 'orange', 'red', 'purple', 'gray'];
  return valid.includes(color as BadgeColor) ? (color as BadgeColor) : 'gray';
}
