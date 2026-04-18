import { useParams } from 'react-router';
import {
  IconCircleCheck,
  IconClock,
  IconUrgent,
  IconFlagFilled,
  IconCalendar,
  IconInfoCircle,
  IconBulb,
  IconBrain,
} from '@tabler/icons-react';
import { Modal, Badge, Spinner, ExpandableText } from '@/shared/ui';
import { usePlan } from '../hooks/usePlan';
import { formatDate } from '@/shared/lib/date';
import { CommentsSection } from '@/features/comments/CommentsSection';
import { PRIORITY_LABELS } from '../lib/plan-helpers';
import type { PlanItem, Priority } from '@/shared/types';
import type { BadgeColor } from '@/shared/ui';

/**
 * Route-based модалка детали пункта плана. `/plan/:itemId`
 */
export default function PlanItemModal() {
  const { itemId } = useParams();
  const id = itemId ? parseInt(itemId, 10) : null;
  const { data: items } = usePlan();
  const item: PlanItem | undefined = items?.find((p) => p.id === id);

  if (!id) return null;

  if (!item) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  const priority: Priority = (item.priority ?? 'medium') as Priority;
  const priorityColor: BadgeColor =
    priority === 'urgent' ? 'red' : priority === 'high' ? 'orange' : 'blue';
  const priorityIcon = priority === 'urgent' ? <IconUrgent size={12} /> : priority === 'high' ? <IconFlagFilled size={12} /> : <IconCalendar size={12} />;

  return (
    <Modal title={item.title}>
      {/* Status + Priority badges */}
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Badge
          color={item.status === 'done' ? 'green' : 'orange'}
          icon={item.status === 'done' ? <IconCircleCheck size={12} /> : <IconClock size={12} />}
        >
          {item.status === 'done' ? 'Выполнено' : 'В ожидании'}
        </Badge>
        <Badge color={priorityColor} icon={priorityIcon}>
          {PRIORITY_LABELS[priority]}
        </Badge>
      </div>

      {item.description && (
        <p style={{ fontSize: 15, color: 'var(--text)', marginBottom: 16, lineHeight: 1.6 }}>
          {item.description}
        </p>
      )}

      {item.detail && (
        <Section color="var(--text)" icon={<IconInfoCircle size={14} />} title="Подробная информация">
          {item.detail}
        </Section>
      )}

      {item.advice && (
        <Section color="var(--green)" icon={<IconBulb size={14} />} title="Совет" bg="#F3FBF5">
          {item.advice}
        </Section>
      )}

      {item.ai_assessment && (
        <Section
          color="var(--purple)"
          icon={<IconBrain size={14} />}
          title="Независимая оценка AI"
          bg="#F8F1FC"
        >
          {item.ai_assessment}
        </Section>
      )}

      {item.deadline && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <IconCalendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Срок: {formatDate(item.deadline)}
        </div>
      )}

      <CommentsSection entityType="plan" entityId={item.id} />
    </Modal>
  );
}

function Section({
  color,
  icon,
  title,
  children,
  bg,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  children: string;
  bg?: string;
}) {
  const effectiveBg = bg ?? 'var(--bg)';
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {icon} {title}
      </div>
      <div
        style={{
          background: effectiveBg,
          border: bg ? `1px solid ${color}22` : undefined,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <ExpandableText
          text={children}
          bg={effectiveBg}
          textStyle={{ lineHeight: 1.8 }}
          actionColor={color}
        />
      </div>
    </div>
  );
}
