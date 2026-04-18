import { useState } from 'react';
import { IconBrain, IconSend, IconMessageChatbot } from '@tabler/icons-react';
import { Modal, Button, Textarea, EmptyState, Spinner } from '@/shared/ui';
import { useComments, useAddComment } from '@/features/comments/useComments';
import { formatDateTime } from '@/shared/lib/date';

/**
 * AI-chat — это специальный случай комментариев с entity_type='ai_chat' и entity_id=0.
 * Порт из vanilla `more.js:309-345` (showAiChatModal).
 *
 * User пишет вопрос → сохраняется в comments → Claude через service_instructions.md
 * потом читает и отвечает (тоже через comments).
 */
export default function AiChatSheet() {
  const [text, setText] = useState('');
  const { data: comments = [], isLoading } = useComments('ai_chat', 0);
  const addMutation = useAddComment('ai_chat', 0);

  const sorted = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addMutation.mutateAsync(trimmed);
    setText('');
  };

  return (
    <Modal title="Чат с AI" desktopStyle="page">
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 16,
          padding: 12,
          background: 'rgba(175,82,222,0.06)',
          border: '1px solid rgba(175,82,222,0.15)',
          borderRadius: 10,
          lineHeight: 1.5,
        }}
      >
        <IconBrain size={14} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--purple)' }} />
        Отдельный чат с AI-координатором. Пиши сюда вопросы — Claude их прочитает при следующем
        обновлении `service_instructions.md` и ответит комментарием.
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spinner size={20} />
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <EmptyState
          icon={<IconMessageChatbot size={48} color="var(--text-secondary)" />}
          text="Начните разговор"
        />
      )}

      {sorted.map((msg) => (
        <div
          key={msg.id}
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 10,
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
            {msg.text}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
            {formatDateTime(msg.created_at)}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Задайте вопрос AI..."
          rows={3}
          style={{ width: '100%' }}
        />
        <Button
          size="sm"
          onClick={() => void handleSend()}
          loading={addMutation.isPending}
          disabled={!text.trim()}
          icon={<IconSend size={14} />}
          style={{ marginTop: 8 }}
        >
          Отправить
        </Button>
      </div>
    </Modal>
  );
}
