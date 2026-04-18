import { IconChevronRight, IconBrain, IconStethoscope } from '@tabler/icons-react';
import { Collapsible, Badge, EntityId } from '@/shared/ui';
import { haptic } from '@/shared/lib/haptic';
import { truncate } from '@/shared/lib/text';
import type { Diagnosis } from '@/shared/types';

interface Props {
  diagnoses: Diagnosis[];
  onSelect: (diagnosis: Diagnosis) => void;
}

/**
 * Активные диагнозы. В новом layout (§9) — СВЁРНУТАЯ секция, в заголовке
 * показывается количество. Порт из vanilla `dashboard.js:282-298`.
 */
export function DiagnosesSection({ diagnoses, onSelect }: Props) {
  if (diagnoses.length === 0) return null;

  return (
    <Collapsible
      title="Активные диагнозы"
      icon={<IconStethoscope size={18} color="var(--purple)" />}
      persistKey="dashboard-diagnoses"
      defaultOpen={false}
      badge={<Badge color="purple">{diagnoses.length}</Badge>}
    >
      {diagnoses.map((d) => (
        <div
          key={d.id}
          className="diagnosis-item"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            haptic('light');
            onSelect(d);
          }}
        >
          {d.icd_code ? (
            <span className="diagnosis-code">{d.icd_code}</span>
          ) : (
            <span className="diagnosis-code" style={{ opacity: 0.4 }}>
              --
            </span>
          )}
          <div style={{ flex: 1 }}>
            <span className="diagnosis-name">{d.name}</span>
            <EntityId id={d.id} style={{ marginLeft: 6 }} />
            {d.source && (
              <div
                style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}
              >
                {d.source}
              </div>
            )}
            {d.ai_assessment && (
              <div
                style={{ fontSize: 11, color: 'var(--purple)', marginTop: 2 }}
              >
                <IconBrain size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {truncate(d.ai_assessment, 60)}
              </div>
            )}
          </div>
          <IconChevronRight
            size={16}
            style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}
          />
        </div>
      ))}
    </Collapsible>
  );
}
