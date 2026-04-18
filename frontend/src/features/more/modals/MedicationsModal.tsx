import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconPill, IconChevronRight, IconCalendar, IconBrain } from '@tabler/icons-react';
import { Modal, Sheet, SkeletonList, EmptyState, ExpandableText, EntityId } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import { fetchMedications } from '../api';
import { formatDate } from '@/shared/lib/date';
import { truncate } from '@/shared/lib/text';
import { haptic } from '@/shared/lib/haptic';
import { CommentsSection } from '@/features/comments/CommentsSection';
import type { Medication } from '@/shared/types';

export default function MedicationsModal() {
  const { data, isLoading } = useQuery({ queryKey: qk.medications, queryFn: fetchMedications });
  const [selected, setSelected] = useState<Medication | null>(null);

  const all = data ?? [];
  const active = all.filter((m) => m.status === 'active');
  const completed = all.filter((m) => m.status !== 'active');

  return (
    <>
      <Modal title="Препараты" desktopStyle="page">
        {isLoading && <SkeletonList count={3} height={64} />}
        {!isLoading && all.length === 0 && (
          <EmptyState icon={<IconPill size={48} color="var(--text-secondary)" />} text="Нет препаратов" />
        )}

        {active.length > 0 && (
          <>
            <div className="section-subtitle" style={{ marginTop: 0 }}>
              <IconPill size={14} style={{ marginRight: 4 }} /> Текущие ({active.length})
            </div>
            {active.map((m) => (
              <MedicationRow key={m.id} med={m} onClick={() => { haptic('light'); setSelected(m); }} />
            ))}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div className="section-subtitle">Завершённые ({completed.length})</div>
            {completed.map((m) => (
              <MedicationRow key={m.id} med={m} onClick={() => { haptic('light'); setSelected(m); }} />
            ))}
          </>
        )}
      </Modal>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected && <MedicationDetails m={selected} />}
      </Sheet>
    </>
  );
}

function MedicationRow({ med: m, onClick }: { med: Medication; onClick: () => void }) {
  return (
    <div className="medication-item" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="medication-icon">
        <IconPill
          size={18}
          color={m.status === 'active' ? 'var(--blue)' : 'var(--text-secondary)'}
        />
      </div>
      <div className="medication-info">
        <div className="medication-name">
          {m.name}
          <EntityId id={m.id} style={{ marginLeft: 6 }} />
        </div>
        <div className="medication-dose">
          {m.dosage}
          {m.frequency && ` / ${m.frequency}`}
        </div>
        {m.ai_assessment && (
          <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 2 }}>
            <IconBrain size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {truncate(m.ai_assessment, 60)}
          </div>
        )}
        {m.start_date && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            <IconCalendar size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {formatDate(m.start_date)}
            {m.end_date ? ` — ${formatDate(m.end_date)}` : ' — ...'}
          </div>
        )}
      </div>
      <IconChevronRight size={16} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
    </div>
  );
}

function MedicationDetails({ m }: { m: Medication }) {
  return (
    <>
      {(m.dosage || m.frequency) && (
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          {m.dosage && (
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              Дозировка: <strong>{m.dosage}</strong>
            </div>
          )}
          {m.frequency && (
            <div style={{ fontSize: 14 }}>
              Приём: <strong>{m.frequency}</strong>
            </div>
          )}
        </div>
      )}

      {m.start_date && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Период: {formatDate(m.start_date)}
          {m.end_date ? ` — ${formatDate(m.end_date)}` : ' — ...'}
        </div>
      )}

      {m.detail && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Подробная информация</div>
          <div
            style={{
              background: 'var(--bg)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <ExpandableText
              text={m.detail}
              bg="var(--bg)"
              textStyle={{ lineHeight: 1.8 }}
              actionColor="var(--text)"
            />
          </div>
        </div>
      )}

      {m.ai_assessment && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--purple)',
              marginBottom: 8,
            }}
          >
            Независимая оценка AI
          </div>
          <div
            style={{
              background: '#F8F1FC',
              border: '1px solid rgba(175,82,222,0.15)',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <ExpandableText
              text={m.ai_assessment}
              bg="#F8F1FC"
              textStyle={{ lineHeight: 1.7 }}
              actionColor="var(--purple)"
            />
          </div>
        </div>
      )}

      {m.notes && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {m.notes}
        </div>
      )}

      <CommentsSection entityType="medication" entityId={m.id} />
    </>
  );
}
