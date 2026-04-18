import { IconChevronRight, IconStethoscope, IconBrain } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { Card, Badge, EntityId } from '@/shared/ui';
import type { Diagnosis } from '@/shared/types';

interface Props {
  diagnosis: Diagnosis;
  onClick: (d: Diagnosis) => void;
}

/**
 * Карточка диагноза в списке. Порт из vanilla `diagnoses.js:104-130`.
 */
export function DiagnosisCard({ diagnosis: d, onClick }: Props) {
  const active = d.status === 'active';
  const hasAi = !!d.ai_assessment;

  return (
    <Card
      onClick={() => {
        haptic('light');
        onClick(d);
      }}
      style={{ marginBottom: 8, padding: '14px 16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: active ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconStethoscope size={18} color={active ? 'var(--red)' : 'var(--green)'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 2,
            }}
          >
            {d.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {d.icd_code && (
              <Badge color="purple" style={{ fontSize: 10, padding: '1px 6px' }}>
                {d.icd_code}
              </Badge>
            )}
            <EntityId id={d.id} />
            {d.source && <span>{d.source}</span>}
          </div>
          {d.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {d.notes}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {hasAi && <IconBrain size={14} color="var(--purple)" style={{ opacity: 0.6 }} />}
          <IconChevronRight size={16} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
        </div>
      </div>
    </Card>
  );
}
