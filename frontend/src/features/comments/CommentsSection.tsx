import { useState } from 'react';
import { IconMessage2, IconSend, IconTrash } from '@tabler/icons-react';
import { Button, Textarea, useConfirm } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib/date';
import { useComments, useAddComment, useDeleteComment } from './useComments';

/**
 * Универсальный блок комментариев для любой сущности (diagnosis, medication,
 * timeline, error, reminder, ai_chat и т.д.).
 *
 * Использование:
 * ```tsx
 * <CommentsSection entityType="diagnosis" entityId={diag.id} />
 * ```
 *
 * ВАЖНО: порт логики из vanilla `frontend/js/components/comments.js`.
 * Порядок comments — `order: 'desc'` (новые сверху).
 */

interface Props {
  entityType: string;
  entityId: number;
  title?: string;
  placeholder?: string;
}

export function CommentsSection({
  entityType,
  entityId,
  title = 'Мои комментарии',
  placeholder = 'Написать комментарий...',
}: Props) {
  const [text, setText] = useState('');
  const { data: comments = [] } = useComments(entityType, entityId);
  const addMutation = useAddComment(entityType, entityId);
  const deleteMutation = useDeleteComment(entityType, entityId);
  const { confirm, dialog } = useConfirm();

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addMutation.mutateAsync(trimmed);
    setText('');
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: 'Удалить комментарий?',
      confirmText: 'Удалить',
      confirmVariant: 'danger',
    });
    if (ok) deleteMutation.mutate(id);
  };

  return (
    <div
      className="comments-section"
      style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconMessage2 size={16} /> {title} {comments.length > 0 && `(${comments.length})`}
      </div>

      {comments.map((c) => (
        <div
          key={c.id}
          style={{
            background: 'var(--bg)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 8,
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: 'var(--text)',
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
            }}
          >
            {c.text}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {formatDateTime(c.created_at)}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(c.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--red)',
                fontSize: 12,
                cursor: 'pointer',
                padding: '2px 6px',
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Удалить комментарий"
            >
              <IconTrash size={14} />
            </button>
          </div>
        </div>
      ))}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ marginTop: 8, fontSize: 13 }}
      />
      <Button
        size="sm"
        onClick={() => void handleSubmit()}
        loading={addMutation.isPending}
        disabled={!text.trim()}
        icon={<IconSend size={14} />}
        style={{ marginTop: 8 }}
      >
        Отправить
      </Button>

      {dialog}
    </div>
  );
}
