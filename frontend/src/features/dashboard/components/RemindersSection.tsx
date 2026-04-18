import { IconChevronRight, IconClock, IconBell } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { formatDate } from '@/shared/lib/date';
import { EntityId } from '@/shared/ui';
import type { Reminder } from '@/shared/types';

interface Props {
  reminders: Reminder[];
  onSelect: (reminder: Reminder) => void;
}

/**
 * Ближайшие напоминания. НЕ collapsible (всегда видны, т.к. самое срочное).
 * Порт из vanilla `dashboard.js:318-333`.
 */
export function RemindersSection({ reminders, onSelect }: Props) {
  if (reminders.length === 0) return null;

  return (
    <>
      <div className="section-subtitle">
        <IconBell size={14} style={{ marginRight: 4 }} /> Ближайшие напоминания
      </div>
      {reminders.map((r) => (
        <div
          key={r.id}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => {
            haptic('light');
            onSelect(r);
          }}
        >
          <IconClock size={20} color="var(--orange)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {r.title}
              <EntityId id={r.id} style={{ marginLeft: 6 }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {formatDate(r.remind_at)}
              {r.message && ` — ${r.message}`}
            </div>
          </div>
          <IconChevronRight
            size={16}
            style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}
          />
        </div>
      ))}
    </>
  );
}
