import { useParams } from 'react-router';
import { IconStethoscope, IconCalendar, IconInfoCircle, IconBrain } from '@tabler/icons-react';
import { Modal, Badge, Spinner, ExpandableText } from '@/shared/ui';
import { useDiagnoses } from '../hooks/useDiagnoses';
import { AiRequestButton } from '../components/AiRequestButton';
import { CommentsSection } from '@/features/comments/CommentsSection';
import { formatDate } from '@/shared/lib/date';
import type { Diagnosis, DiagnosisStatus } from '@/shared/types';
import type { BadgeColor } from '@/shared/ui';

const STATUS_LABELS: Record<DiagnosisStatus, string> = {
  active: 'Активный',
  resolved: 'Закрыт',
  suspected: 'Под вопросом',
};

const STATUS_BADGE: Record<DiagnosisStatus, BadgeColor> = {
  active: 'red',
  resolved: 'green',
  suspected: 'orange',
};

export default function DiagnosisModal() {
  const { id } = useParams();
  const numId = id ? parseInt(id, 10) : null;
  const { data } = useDiagnoses();
  const diag: Diagnosis | undefined = data?.find((d) => d.id === numId);

  if (!numId) return null;

  if (!diag) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  const status: DiagnosisStatus = (diag.status ?? 'active') as DiagnosisStatus;

  return (
    <Modal title={diag.name}>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Badge color={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
        {diag.icd_code && <Badge color="purple">{diag.icd_code}</Badge>}
      </div>

      {diag.source && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <IconStethoscope size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Источник: {diag.source}
        </div>
      )}
      {diag.diagnosed_date && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <IconCalendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Дата: {formatDate(diag.diagnosed_date)}
        </div>
      )}

      {diag.notes && (
        <div style={{ marginBottom: 16 }}>
          <ExpandableText
            text={diag.notes}
            bg="var(--card)"
            textStyle={{ fontSize: 14, lineHeight: 1.6 }}
          />
        </div>
      )}

      {diag.ai_assessment ? (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--purple)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IconBrain size={14} /> AI-анализ диагноза
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
              text={diag.ai_assessment}
              bg="#F8F1FC"
              textStyle={{ lineHeight: 1.7 }}
              actionColor="var(--purple)"
            />
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <AiRequestButton entityType="diagnosis" entityId={diag.id} />
        </div>
      )}

      <CommentsSection entityType="diagnosis" entityId={diag.id} />
    </Modal>
  );
}

export { IconInfoCircle };
