import { IconChevronRight, IconAlertOctagon, IconAlertTriangle, IconInfoCircle, IconCircleCheck, IconPointFilled, IconStethoscope, IconBrain } from '@tabler/icons-react';
import clsx from 'clsx';
import { Badge, EntityId } from '@/shared/ui';
import { haptic } from '@/shared/lib/haptic';
import { truncate } from '@/shared/lib/text';
import type { MedicalError, Severity } from '@/shared/types';
import type { BadgeColor } from '@/shared/ui';

interface Props {
  error: MedicalError;
  onClick: (error: MedicalError) => void;
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Критично',
  warning: 'Внимание',
  info: 'Информация',
};

const SEVERITY_BADGE: Record<Severity, BadgeColor> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

export function ErrorCard({ error, onClick }: Props) {
  const sev: Severity = (error.severity ?? 'info') as Severity;

  const sevIcon =
    sev === 'critical' ? <IconAlertOctagon size={12} /> :
    sev === 'warning' ? <IconAlertTriangle size={12} /> :
    <IconInfoCircle size={12} />;

  return (
    <div
      className={clsx('error-card', `severity-${sev}`)}
      style={{ cursor: 'pointer' }}
      onClick={() => {
        haptic('light');
        onClick(error);
      }}
    >
      <div className="error-header">
        <div className="error-title" style={{ flex: 1 }}>{error.title ?? error.description}</div>
        <IconChevronRight size={18} style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }} />
      </div>
      {error.description && <div className="error-desc">{truncate(error.description, 150)}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <Badge color={SEVERITY_BADGE[sev]} icon={sevIcon}>
          {SEVERITY_LABELS[sev]}
        </Badge>
        <Badge
          color={error.status === 'resolved' ? 'green' : 'red'}
          icon={error.status === 'resolved' ? <IconCircleCheck size={12} /> : <IconPointFilled size={12} />}
        >
          {error.status === 'resolved' ? 'Решено' : 'Открыто'}
        </Badge>
        {error.advice && (
          <Badge color="green" icon={<IconStethoscope size={11} />}>
            Рекомендации
          </Badge>
        )}
        {error.ai_assessment && (
          <Badge color="purple" icon={<IconBrain size={11} />}>
            AI
          </Badge>
        )}
        <EntityId id={error.id} />
      </div>
    </div>
  );
}

export { SEVERITY_LABELS, SEVERITY_BADGE };
