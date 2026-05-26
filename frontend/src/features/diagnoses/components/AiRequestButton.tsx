import { IconBrain, IconClock } from '@tabler/icons-react';
import { usePendingAiRequests, useCreateAiRequest } from '../hooks/useDiagnoses';
import { useMe } from '@/shared/auth/useAuth';

interface Props {
  entityType: string;
  entityId: number;
}

/**
 * Кнопка запроса AI-анализа. Порт из vanilla `diagnoses.js:52-97`.
 *
 * Логика:
 * - Если у юзера ai_enabled=false (не разрешён AI) → null (кнопки нет)
 * - Если в pending AI-requests уже есть запись для этой сущности → показываем «Отправлено»
 * - Иначе → кнопка «Запросить AI-анализ»
 * - После клика → мутация createAiRequest → list инвалидируется → появляется «Отправлено»
 */
export function AiRequestButton({ entityType, entityId }: Props) {
  const me = useMe();
  const { data: pending } = usePendingAiRequests();
  const mutation = useCreateAiRequest();

  // AI отключён для этого юзера — не показываем кнопку. Бэкенд тоже
  // защищён (requireAiEnabled на POST /api/ai-requests) — это лишь UX.
  // me=null значит сессия ещё грузится, либо это legacy PIN без user_id
  // (в этом случае ai_enabled=true по дизайну /api/me fallback).
  if (me && !me.ai_enabled) return null;

  const alreadyPending =
    (pending ?? []).some((r) => r.entity_type === entityType && r.entity_id === entityId) ||
    mutation.isSuccess ||
    mutation.isPending;

  if (alreadyPending) {
    return (
      <div
        style={{
          width: '100%',
          padding: 12,
          border: '1px dashed var(--orange)',
          borderRadius: 12,
          background: 'rgba(255,149,0,0.06)',
          color: 'var(--orange)',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <IconClock size={18} /> Запрос на AI-анализ отправлен
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate({ type: entityType, id: entityId })}
      style={{
        width: '100%',
        padding: 12,
        border: '1px dashed var(--purple)',
        borderRadius: 12,
        background: 'rgba(175,82,222,0.04)',
        color: 'var(--purple)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <IconBrain size={18} /> Запросить AI-анализ
    </button>
  );
}
