import { useQuery } from '@tanstack/react-query';
import { IconBell } from '@tabler/icons-react';
import { Modal, SkeletonList, EmptyState, EntityId } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import { fetchReminders } from '../api';
import { CommentsSection } from '@/features/comments/CommentsSection';
import { formatDate } from '@/shared/lib/date';

export default function RemindersModal() {
  const { data, isLoading } = useQuery({ queryKey: qk.reminders, queryFn: fetchReminders });

  const all = data ?? [];

  return (
    <Modal title="Напоминания" desktopStyle="page">
      {isLoading && <SkeletonList count={3} height={56} />}
      {!isLoading && all.length === 0 && (
        <EmptyState
          icon={<IconBell size={48} color="var(--text-secondary)" />}
          text="Нет напоминаний"
        />
      )}
      {all.map((r) => (
        <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconBell
            size={20}
            color={r.status === 'sent' ? 'var(--green)' : 'var(--orange)'}
            style={{ flexShrink: 0 }}
          />
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
        </div>
      ))}

      <CommentsSection entityType="reminders" entityId={0} title="Комментарии к разделу" />
    </Modal>
  );
}
