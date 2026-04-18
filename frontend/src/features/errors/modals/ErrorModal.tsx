import { useParams } from 'react-router';
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconInfoCircle,
  IconCircleCheck,
  IconRotateClockwise,
  IconStethoscope,
  IconBrain,
  IconArrowRight,
} from '@tabler/icons-react';
import { Modal, Badge, Button, Spinner, useConfirm, ExpandableText } from '@/shared/ui';
import { useErrors, useToggleErrorStatus } from '../hooks/useErrors';
import { CommentsSection } from '@/features/comments/CommentsSection';
import { SEVERITY_LABELS, SEVERITY_BADGE } from '../components/ErrorCard';
import type { MedicalError, Severity } from '@/shared/types';

export default function ErrorModal() {
  const { errorId } = useParams();
  const id = errorId ? parseInt(errorId, 10) : null;
  const { data: items } = useErrors();
  const toggle = useToggleErrorStatus();
  const { confirm, dialog } = useConfirm();
  const error: MedicalError | undefined = items?.find((e) => e.id === id);

  if (!id) return null;

  if (!error) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  const sev: Severity = (error.severity ?? 'info') as Severity;
  const sevIcon =
    sev === 'critical' ? <IconAlertOctagon size={12} /> :
    sev === 'warning' ? <IconAlertTriangle size={12} /> :
    <IconInfoCircle size={12} />;

  const handleToggle = async () => {
    const action = error.status === 'resolved' ? 'открыть заново' : 'отметить решённым';
    const ok = await confirm({
      message: `${action[0]!.toUpperCase() + action.slice(1)}?`,
      confirmText: error.status === 'resolved' ? 'Открыть' : 'Отметить решённым',
    });
    if (ok) toggle.mutate(error);
  };

  return (
    <Modal title={error.title ?? 'Ошибка'}>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Badge color={SEVERITY_BADGE[sev]} icon={sevIcon}>
          {SEVERITY_LABELS[sev]}
        </Badge>
        <Badge color={error.status === 'resolved' ? 'green' : 'red'}>
          {error.status === 'resolved' ? 'Решено' : 'Открыто'}
        </Badge>
      </div>

      <div style={{ marginBottom: 16 }}>
        <ExpandableText
          text={error.description}
          bg="var(--card)"
          textStyle={{ fontSize: 15, lineHeight: 1.6 }}
        />
      </div>

      {error.detail && (
        <Block color="var(--text)" icon={<IconInfoCircle size={14} />} title="Подробное описание">
          {error.detail}
        </Block>
      )}

      {error.advice && (
        <Block color="var(--green)" icon={<IconStethoscope size={14} />} title="Рекомендации специалиста" bg="#F3FBF5">
          {error.advice}
        </Block>
      )}

      {error.ai_assessment && (
        <Block color="var(--purple)" icon={<IconBrain size={14} />} title="Независимая оценка AI" bg="#F8F1FC">
          {error.ai_assessment}
        </Block>
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
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <IconArrowRight size={14} />
          {error.action_text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button
          variant={error.status === 'resolved' ? 'secondary' : 'primary'}
          size="sm"
          block
          onClick={() => void handleToggle()}
          loading={toggle.isPending}
          icon={error.status === 'resolved' ? <IconRotateClockwise size={14} /> : <IconCircleCheck size={14} />}
        >
          {error.status === 'resolved' ? 'Открыть заново' : 'Отметить решённым'}
        </Button>
      </div>

      <CommentsSection entityType="error" entityId={error.id} />
      {dialog}
    </Modal>
  );
}

function Block({
  color,
  icon,
  title,
  children,
  bg,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  children: string;
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
          text={children}
          bg={effectiveBg}
          textStyle={{ lineHeight: 1.8 }}
          actionColor={color}
        />
      </div>
    </div>
  );
}
