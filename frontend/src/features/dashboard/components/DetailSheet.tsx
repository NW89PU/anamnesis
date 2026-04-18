import type { ReactNode } from 'react';
import {
  IconHash,
  IconFileText,
  IconInfoCircle,
  IconBrain,
  IconNotes,
  IconPill,
  IconCircleCheck,
  IconUser,
  IconDroplet,
  IconClock,
  IconCalendar,
  IconAlertOctagon,
  IconAlertTriangle,
  IconStethoscope,
  IconArrowRight,
} from '@tabler/icons-react';
import { Sheet, Badge, ExpandableText } from '@/shared/ui';
import { formatDate } from '@/shared/lib/date';
import { CommentsSection } from '@/features/comments/CommentsSection';
import type { Diagnosis, Medication, MedicalError, Reminder } from '@/shared/types';

/**
 * Универсальная модалка деталей для сущностей, кликабельных с Dashboard.
 *
 * ВАЖНО: на dashboard модалки — это локальный state (не route-based).
 * F5 их закрывает, но для Dashboard это ок — это не основные страницы.
 * Для route-based модалок (в Documents, Plan) — используется `@/shared/ui/Modal`.
 */

type DetailEntity =
  | { type: 'diagnosis'; data: Diagnosis }
  | { type: 'medication'; data: Medication }
  | { type: 'error'; data: MedicalError }
  | { type: 'reminder'; data: Reminder };

interface Props {
  entity: DetailEntity | null;
  onClose: () => void;
}

export function DetailSheet({ entity, onClose }: Props) {
  if (!entity) return null;

  const { type, data } = entity;
  const title = getTitle(type, data);

  return (
    <Sheet open onClose={onClose} title={title}>
      {type === 'diagnosis' && <DiagnosisContent diagnosis={data} />}
      {type === 'medication' && <MedicationContent medication={data} />}
      {type === 'error' && <ErrorContent error={data} />}
      {type === 'reminder' && <ReminderContent reminder={data} />}
      <CommentsSection entityType={type} entityId={data.id} />
    </Sheet>
  );
}

function getTitle(type: DetailEntity['type'], data: DetailEntity['data']): string {
  if (type === 'error') return (data as MedicalError).title ?? 'Ошибка';
  if (type === 'reminder') return (data as Reminder).title ?? '—';
  return (data as Diagnosis | Medication).name ?? '—';
}

// ── Section helpers ───────────────────────────────────

function Block({
  color,
  icon,
  title,
  text,
  bg,
}: {
  color: string;
  icon: ReactNode;
  title: string;
  text: string;
  bg?: string;
}) {
  const effectiveBg = bg ?? 'var(--bg)';
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {icon} {title}
      </div>
      <div
        style={{
          background: effectiveBg,
          border: bg ? `1px solid ${color}22` : undefined,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <ExpandableText
          text={text}
          bg={effectiveBg}
          textStyle={{ lineHeight: 1.8 }}
          actionColor={color}
        />
      </div>
    </div>
  );
}

// ── Diagnosis content ─────────────────────────────────

function DiagnosisContent({ diagnosis }: { diagnosis: Diagnosis }) {
  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {diagnosis.icd_code && (
          <Badge color="purple" icon={<IconHash size={12} />}>
            {diagnosis.icd_code}
          </Badge>
        )}
        <Badge color={diagnosis.status === 'active' ? 'red' : 'green'}>
          {diagnosis.status === 'active' ? 'Активный' : 'Неактивный'}
        </Badge>
      </div>

      {diagnosis.source && (
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginBottom: 12,
          }}
        >
          <IconFileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Источник: {diagnosis.source}
        </div>
      )}

      {diagnosis.notes && (
        <Block
          color="var(--text)"
          icon={<IconInfoCircle size={14} />}
          title="Подробное описание"
          text={diagnosis.notes}
        />
      )}

      {diagnosis.ai_assessment && (
        <Block
          color="var(--purple)"
          icon={<IconBrain size={14} />}
          title="Независимая оценка AI"
          text={diagnosis.ai_assessment}
          bg="#F8F1FC"
        />
      )}
    </>
  );
}

// ── Medication content ────────────────────────────────

function MedicationContent({ medication: m }: { medication: Medication }) {
  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Badge color={m.status === 'active' ? 'green' : 'gray'} icon={
          m.status === 'active' ? <IconPill size={12} /> : <IconCircleCheck size={12} />
        }>
          {m.status === 'active' ? 'Активный' : 'Завершён'}
        </Badge>
        {m.prescribed_by && (
          <Badge color="blue" icon={<IconUser size={12} />}>
            {m.prescribed_by}
          </Badge>
        )}
      </div>

      {(m.dosage || m.frequency) && (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          {m.dosage && (
            <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
              <IconDroplet size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Дозировка: <strong>{m.dosage}</strong>
            </div>
          )}
          {m.frequency && (
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              <IconClock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Приём: <strong>{m.frequency}</strong>
            </div>
          )}
        </div>
      )}

      {m.start_date && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <IconCalendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Период: {formatDate(m.start_date)} {m.end_date ? `— ${formatDate(m.end_date)}` : '— ...'}
        </div>
      )}

      {m.detail && (
        <Block
          color="var(--text)"
          icon={<IconInfoCircle size={14} />}
          title="Подробная информация"
          text={m.detail}
        />
      )}

      {m.ai_assessment && (
        <Block
          color="var(--purple)"
          icon={<IconBrain size={14} />}
          title="Независимая оценка AI"
          text={m.ai_assessment}
          bg="#F8F1FC"
        />
      )}

      {m.notes && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <IconNotes size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {m.notes}
        </div>
      )}
    </>
  );
}

// ── Error content ─────────────────────────────────────

function ErrorContent({ error }: { error: MedicalError }) {
  const severityIcon =
    error.severity === 'critical' ? <IconAlertOctagon size={12} /> :
    error.severity === 'warning' ? <IconAlertTriangle size={12} /> :
    <IconInfoCircle size={12} />;
  const severityColor: 'red' | 'orange' | 'blue' =
    error.severity === 'critical' ? 'red' :
    error.severity === 'warning' ? 'orange' :
    'blue';
  const severityLabel =
    error.severity === 'critical' ? 'Критично' :
    error.severity === 'warning' ? 'Внимание' :
    'Информация';

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Badge color={severityColor} icon={severityIcon}>
          {severityLabel}
        </Badge>
        <Badge color={error.status === 'resolved' ? 'green' : 'red'}>
          {error.status === 'resolved' ? 'Решено' : 'Открыто'}
        </Badge>
      </div>

      <p style={{ fontSize: 15, color: 'var(--text)', marginBottom: 16, lineHeight: 1.6 }}>
        {error.description}
      </p>

      {error.detail && (
        <Block
          color="var(--text)"
          icon={<IconInfoCircle size={14} />}
          title="Подробное описание"
          text={error.detail}
        />
      )}

      {error.advice && (
        <Block
          color="var(--green)"
          icon={<IconStethoscope size={14} />}
          title="Рекомендации специалиста"
          text={error.advice}
          bg="#F3FBF5"
        />
      )}

      {error.ai_assessment && (
        <Block
          color="var(--purple)"
          icon={<IconBrain size={14} />}
          title="Независимая оценка AI"
          text={error.ai_assessment}
          bg="#F8F1FC"
        />
      )}

      {error.action_text && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(0,122,255,0.06)',
            border: '1px solid rgba(0,122,255,0.12)',
            borderRadius: 10,
            fontSize: 14,
            color: 'var(--blue)',
            fontWeight: 500,
            marginBottom: 16,
          }}
        >
          <IconArrowRight size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {error.action_text}
        </div>
      )}
    </>
  );
}

// ── Reminder content ──────────────────────────────────

function ReminderContent({ reminder: r }: { reminder: Reminder }) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Badge
          color={r.status === 'sent' ? 'green' : 'orange'}
          icon={r.status === 'sent' ? <IconCircleCheck size={12} /> : <IconClock size={12} />}
        >
          {r.status === 'sent' ? 'Отправлено' : 'Ожидает'}
        </Badge>
      </div>

      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <IconCalendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {formatDate(r.remind_at)}
      </div>

      {r.message && (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          {r.message}
        </div>
      )}
    </>
  );
}
