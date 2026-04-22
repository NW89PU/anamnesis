import { useMemo, useState } from 'react';
import { IconBrain, IconSend, IconMessageChatbot } from '@tabler/icons-react';
import { Modal, Button, Textarea, EmptyState, Spinner } from '@/shared/ui';
import { useComments, useAddComment } from '@/features/comments/useComments';
import type { Comment } from '@/shared/types';

/**
 * AI-chat — специальный случай комментариев с entity_type='ai_chat' и entity_id=0.
 *
 * User пишет вопрос → сохраняется в comments (author='user').
 * Claude при следующем обновлении service_instructions.md читает и отвечает
 * комментарием с author='ai'.
 *
 * UI:
 * - Inline-пояснение показывается ТОЛЬКО пока чат пустой.
 * - Инпут нового вопроса вверху — не надо скроллить до него.
 * - Сообщения отсортированы REVERSE CHRONO: свежие сверху, старые снизу.
 * - Внутри одного дня — свежие пары (вопрос + ответ) сверху.
 * - Внутри пары — вопрос выше ответа (нормальный порядок чтения).
 * - Группировка по дням: «Сегодня», «Вчера», «N дн. назад», «21 апреля».
 * - AI-ответ: IconBrain + «Ответ AI» (жирным, var(--purple)), фон #F8F1FC.
 * - Вопрос пользователя: var(--card) белый, без подписи.
 */

// ─── Утилиты ─────────────────────────────────────────────────

function dayKey(iso: string): string {
  // Ключ группировки: YYYY-MM-DD в локальной таймзоне
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: diffDays > 365 ? 'numeric' : undefined,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Пара «вопрос + ответ». Ответ может отсутствовать если AI ещё не отвечал.
 * Время пары = время вопроса (не ответа), чтобы группировка по дням была стабильной.
 */
interface Pair {
  question: Comment;
  answer: Comment | null;
  at: string;
}

function buildPairs(comments: Comment[]): Pair[] {
  // Старые первые — нужно для правильной привязки AI-ответов к вопросам
  const asc = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const pairs: Pair[] = [];
  for (const msg of asc) {
    const author = msg.author ?? 'user';
    if (author === 'user') {
      pairs.push({ question: msg, answer: null, at: msg.created_at });
    } else {
      // AI-ответ прикрепляем к последней паре без ответа
      const openPair = [...pairs].reverse().find((p) => p.answer === null);
      if (openPair) {
        openPair.answer = msg;
      } else {
        // AI без предшествующего вопроса — редкий edge case, показываем как отдельную пару
        pairs.push({ question: msg, answer: msg, at: msg.created_at });
      }
    }
  }
  // Reverse chrono — свежие сверху
  return pairs.reverse();
}

// ─── UI блоки ─────────────────────────────────────────────────

function QuestionBlock({ c }: { c: Comment }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 10,
        boxShadow: 'var(--shadow)',
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
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
        {formatTime(c.created_at)}
      </div>
    </div>
  );
}

function AnswerBlock({ c }: { c: Comment }) {
  return (
    <div
      style={{
        background: '#F8F1FC',
        border: '1px solid rgba(175,82,222,0.15)',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--purple)',
        }}
      >
        <IconBrain size={16} />
        Ответ AI
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text)',
          lineHeight: 1.6,
          whiteSpace: 'pre-line',
        }}
      >
        {c.text}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
        {formatTime(c.created_at)}
      </div>
    </div>
  );
}

function WaitingBlock() {
  return (
    <div
      style={{
        background: 'rgba(175,82,222,0.06)',
        border: '1px dashed rgba(175,82,222,0.3)',
        borderRadius: 12,
        padding: '10px 14px',
        marginBottom: 14,
        fontSize: 13,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <IconBrain size={14} color="var(--purple)" />
      Ждёт ответа AI — при следующей сессии координатора.
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────

export default function AiChatSheet() {
  const [text, setText] = useState('');
  const { data: comments = [], isLoading } = useComments('ai_chat', 0);
  const addMutation = useAddComment('ai_chat', 0);

  const pairs = useMemo(() => buildPairs(comments), [comments]);

  // Группировка пар по дням (ключ = YYYY-MM-DD времени вопроса)
  const groups = useMemo(() => {
    const byDay = new Map<string, Pair[]>();
    for (const p of pairs) {
      const key = dayKey(p.at);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(p);
    }
    // Map сохраняет порядок вставки — pairs уже отсортированы reverse chrono,
    // значит и ключи будут reverse chrono автоматически.
    return Array.from(byDay.entries());
  }, [pairs]);

  const hasAnyMessage = pairs.length > 0;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addMutation.mutateAsync(trimmed);
    setText('');
  };

  return (
    <Modal title="Чат с AI" desktopStyle="page">
      {/* Инпут — всегда вверху, чтобы к нему не надо было скроллить */}
      <div style={{ marginBottom: 16 }}>
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

      {/* Пояснение показывается ТОЛЬКО если чат пустой */}
      {!hasAnyMessage && !isLoading && (
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
          <IconBrain
            size={14}
            style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--purple)' }}
          />
          Отдельный чат с AI-координатором. Пиши сюда вопросы — Claude их прочитает при
          следующем обновлении <code>service_instructions.md</code> и ответит комментарием.
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spinner size={20} />
        </div>
      )}

      {!isLoading && !hasAnyMessage && (
        <EmptyState
          icon={<IconMessageChatbot size={48} color="var(--text-secondary)" />}
          text="Начните разговор"
        />
      )}

      {/* Группы по дням → пары (reverse chrono сверху) */}
      {groups.map(([key, dayPairs]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin: '12px 2px 8px',
            }}
          >
            {formatDayLabel(dayPairs[0]!.at)}
          </div>
          {dayPairs.map((p) => (
            <div key={p.question.id}>
              <QuestionBlock c={p.question} />
              {p.answer && p.answer.id !== p.question.id ? (
                <AnswerBlock c={p.answer} />
              ) : !p.answer ? (
                <WaitingBlock />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}
