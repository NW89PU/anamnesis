import { IconChevronRight, IconBrain, IconPill } from '@tabler/icons-react';
import { Collapsible, Badge, EntityId } from '@/shared/ui';
import { haptic } from '@/shared/lib/haptic';
import { truncate } from '@/shared/lib/text';
import type { Medication } from '@/shared/types';

interface Props {
  medications: Medication[];
  onSelect: (medication: Medication) => void;
}

/**
 * Текущие препараты. СВЁРНУТАЯ секция.
 * Порт из vanilla `dashboard.js:300-316`.
 */
export function MedicationsSection({ medications, onSelect }: Props) {
  if (medications.length === 0) return null;

  return (
    <Collapsible
      title="Текущие препараты"
      icon={<IconPill size={18} color="var(--green)" />}
      persistKey="dashboard-medications"
      defaultOpen={false}
      badge={<Badge color="green">{medications.length}</Badge>}
    >
      {medications.map((m) => (
        <div
          key={m.id}
          className="medication-item"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            haptic('light');
            onSelect(m);
          }}
        >
          <div className="medication-icon">
            <IconPill size={20} color="var(--blue)" />
          </div>
          <div className="medication-info">
            <div className="medication-name">
              {m.name}
              <EntityId id={m.id} style={{ marginLeft: 6 }} />
            </div>
            <div className="medication-dose">
              {m.dosage}
              {m.frequency && ` / ${m.frequency}`}
              {m.prescribed_by && ` / ${m.prescribed_by}`}
            </div>
            {m.ai_assessment && (
              <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 2 }}>
                <IconBrain size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {truncate(m.ai_assessment, 60)}
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
