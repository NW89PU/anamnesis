import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconBuildingHospital, IconPhone, IconStethoscope, IconChevronRight } from '@tabler/icons-react';
import { Modal, Sheet, EmptyState, SkeletonList, ExpandableText, EntityId } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import { fetchSpecialists } from '../api';
import { CommentsSection } from '@/features/comments/CommentsSection';
import { haptic } from '@/shared/lib/haptic';
import type { Specialist } from '@/shared/types';

export default function SpecialistsModal() {
  const { data, isLoading } = useQuery({ queryKey: qk.specialists, queryFn: fetchSpecialists });
  const [selected, setSelected] = useState<Specialist | null>(null);

  return (
    <>
      <Modal title="Специалисты" desktopStyle="page">
        {isLoading && <SkeletonList count={3} height={72} />}
        {!isLoading && (data ?? []).length === 0 && (
          <EmptyState
            icon={<IconStethoscope size={48} color="var(--text-secondary)" />}
            text="Нет специалистов"
          />
        )}
        {(data ?? []).map((s) => (
          <div
            key={s.id}
            className="list-item"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              haptic('light');
              setSelected(s);
            }}
          >
            <div
              className="list-item-icon"
              style={{ background: 'rgba(0,122,255,0.1)', color: 'var(--blue)' }}
            >
              <IconStethoscope size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {s.full_name ?? s.specialization}
                <EntityId id={s.id} style={{ marginLeft: 6 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {s.full_name && s.specialization}
                {s.clinic && ` · ${s.clinic}`}
              </div>
              {s.phone && (
                <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 2 }}>
                  <IconPhone size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  {s.phone}
                </div>
              )}
            </div>
            <IconChevronRight size={16} className="list-item-chevron" style={{ color: 'var(--text-secondary)' }} />
          </div>
        ))}
      </Modal>

      {/* Sub-sheet для деталей выбранного специалиста */}
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.specialization ?? 'Специалист'}
      >
        {selected && (
          <>
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              {selected.full_name && (
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                  {selected.full_name}
                </div>
              )}
              {selected.clinic && (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <IconBuildingHospital size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {selected.clinic}
                </div>
              )}
              {selected.phone && (
                <div style={{ fontSize: 14, color: 'var(--blue)' }}>
                  <IconPhone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {selected.phone}
                </div>
              )}
            </div>
            {selected.notes && (
              <div style={{ marginBottom: 16 }}>
                <ExpandableText
                  text={selected.notes}
                  bg="var(--card)"
                  textStyle={{ fontSize: 14, lineHeight: 1.6 }}
                />
              </div>
            )}
            <CommentsSection entityType="specialist" entityId={selected.id} />
          </>
        )}
      </Sheet>
    </>
  );
}
