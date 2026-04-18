import { IconChevronRight, IconBulb, IconBrain } from '@tabler/icons-react';
import clsx from 'clsx';
import { haptic } from '@/shared/lib/haptic';
import { truncate } from '@/shared/lib/text';
import { EntityId } from '@/shared/ui';
import { PRIORITY_LABELS } from '../lib/plan-helpers';
import type { PlanItem, Priority } from '@/shared/types';

interface Props {
  item: PlanItem;
  onToggle: (item: PlanItem) => void;
  onOpen: (item: PlanItem) => void;
}

/**
 * Одна строка плана. Порт из vanilla `plan.js:92-109` (renderChecklist).
 * Клик на круглую галочку → toggle status.
 * Клик на всю карточку → открыть детали.
 */
export function PlanChecklistItem({ item, onToggle, onOpen }: Props) {
  const done = item.status === 'done';
  const priority: Priority = (item.priority ?? 'medium') as Priority;
  const priorityClass =
    priority === 'high' ? 'priority-important' : priority === 'urgent' ? 'priority-urgent' : 'priority-planned';

  return (
    <div
      className={clsx('checklist-item', done && 'done')}
      onClick={() => {
        haptic('light');
        onOpen(item);
      }}
      style={{ cursor: 'pointer' }}
    >
      <div
        className="checklist-check"
        onClick={(e) => {
          e.stopPropagation();
          haptic(done ? 'light' : 'success');
          onToggle(item);
        }}
      />
      <div className="checklist-text">
        <div className="checklist-text-title">{item.title}</div>
        {item.description && <div className="checklist-text-sub">{item.description}</div>}
        {item.advice && (
          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>
            <IconBulb size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {truncate(item.advice, 60)}
          </div>
        )}
        {item.ai_assessment && (
          <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 2 }}>
            <IconBrain size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {truncate(item.ai_assessment, 60)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexShrink: 0 }}>
        <EntityId id={item.id} />
        <span className={clsx('checklist-priority', priorityClass)} style={{ marginTop: 0 }}>
          {PRIORITY_LABELS[priority]}
        </span>
      </div>
      <IconChevronRight size={16} style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }} />
    </div>
  );
}
