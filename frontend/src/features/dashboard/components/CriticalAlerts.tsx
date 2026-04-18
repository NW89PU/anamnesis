import { IconAlertOctagon, IconChevronRight, IconBrain, IconUrgent, IconArrowRight } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { truncate } from '@/shared/lib/text';
import { EntityId } from '@/shared/ui';
import type { MedicalError } from '@/shared/types';

interface Props {
  errors: MedicalError[];
  onSelect: (error: MedicalError) => void;
}

/**
 * Критические ошибки. Показываются только со `severity === 'critical'`.
 * Порт из vanilla `dashboard.js:260-280` (renderAlerts).
 */
export function CriticalAlerts({ errors, onSelect }: Props) {
  const critical = errors.filter((e) => e.severity === 'critical');
  if (critical.length === 0) return null;

  return (
    <>
      <div className="section-subtitle">
        <IconUrgent size={14} style={{ marginRight: 4 }} /> Требуют внимания
      </div>
      {critical.map((e) => (
        <div
          key={e.id}
          className="alert-card critical"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            haptic('light');
            onSelect(e);
          }}
        >
          <span className="alert-icon">
            <IconAlertOctagon size={20} />
          </span>
          <div className="alert-text">
            <div className="alert-title">
              {e.title}
              <EntityId id={e.id} style={{ marginLeft: 6 }} />
            </div>
            <div className="alert-desc">{truncate(e.description, 120)}</div>
            {e.ai_assessment && (
              <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 4 }}>
                <IconBrain size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {truncate(e.ai_assessment, 60)}
              </div>
            )}
            {e.action_text && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: 'var(--blue)',
                  fontWeight: 500,
                }}
              >
                <IconArrowRight size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {e.action_text}
              </div>
            )}
          </div>
          <IconChevronRight
            size={18}
            style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0, alignSelf: 'center' }}
          />
        </div>
      ))}
    </>
  );
}
