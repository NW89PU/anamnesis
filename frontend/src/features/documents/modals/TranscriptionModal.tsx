import { useState } from 'react';
import { useParams } from 'react-router';
import { IconClipboardText, IconCopy, IconCheck } from '@tabler/icons-react';
import { Modal, Textarea, Button, Spinner } from '@/shared/ui';
import { useRouteModal } from '@/shared/hooks/useRouteModal';
import { useTimeline } from '../hooks/useTimeline';
import { useUpdateVisit } from '../hooks/useVisitMutations';
import { haptic } from '@/shared/lib/haptic';

/**
 * Модалка добавления/редактирования расшифровки приёма.
 * Route: `/documents/visit/:visitId/transcription`
 *
 * Порт из vanilla `documents.js` showTranscriptionModal.
 * Содержит промпт для NotebookLM с копированием в clipboard.
 */

const NOTEBOOK_LM_PROMPT = `Задача: Ты — медицинский транскрибатор. Расшифруй аудиозапись приёма врача максимально точно и подробно.

Правила:
1. Транскрибируй ВСЁ сказанное, включая побочные комментарии врача — именно они часто содержат важную информацию, не попавшую в заключение.
2. Обозначай говорящих: Врач: и Родитель: (или Мама:/Папа:).
3. Медицинские термины записывай точно, в скобках можно дать расшифровку.
4. Если слово неразборчиво — пиши [неразборчиво].
5. Сохраняй хронологический порядок разговора.
6. В конце добавь раздел "КЛЮЧЕВЫЕ МОМЕНТЫ" — краткий список самого важного из разговора (диагнозы, назначения, рекомендации, что врач сказал между делом).
7. Язык: русский.
8. Контекст пациента: см. карточку в приложении.`;

export default function TranscriptionModal() {
  const { visitId } = useParams();
  const id = visitId ? parseInt(visitId, 10) : null;
  const { closeModal } = useRouteModal();
  const { data: timeline } = useTimeline();
  const update = useUpdateVisit();

  const visit = timeline?.find((t) => t.id === id);
  const [text, setText] = useState(visit?.transcription ?? '');
  const [copied, setCopied] = useState(false);

  if (!id) return null;

  if (!visit) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  const handleCopy = async () => {
    haptic('light');
    try {
      await navigator.clipboard.writeText(NOTEBOOK_LM_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback не нужен — modern браузеры поддерживают
    }
  };

  const handleSave = async () => {
    if (!visit) return;
    await update.mutateAsync({
      id,
      data: {
        title: visit.title,
        event_date: visit.event_date,
        specialist_id: visit.specialist_id,
        specialist_name: visit.specialist_name,
        specialist_type: visit.specialist_type,
        category: visit.category,
        description: visit.description,
        transcription: text.trim() || null,
        ai_assessment: visit.ai_assessment,
        notes: visit.notes,
      },
    });
    closeModal();
  };

  return (
    <Modal title="Расшифровка приёма">
      <div
        style={{
          marginBottom: 12,
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        Вставьте расшифровку аудиозаписи из NotebookLM или другого сервиса транскрипции.
      </div>

      <div
        style={{
          marginBottom: 14,
          background: 'rgba(0,122,255,0.06)',
          border: '1px solid rgba(0,122,255,0.15)',
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--blue)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <IconClipboardText size={13} /> Промпт для NotebookLM
          </span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              background: copied ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.12)',
              color: copied ? 'var(--green)' : 'var(--blue)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
              fontWeight: 600,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
            {copied ? 'Скопировано' : 'Скопировать промпт'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Скопируйте промпт и отправьте его в NotebookLM вместе с аудиофайлом. Готовую
          расшифровку вставьте ниже.
        </div>
      </div>

      <div className="form-group">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Вставьте текст расшифровки сюда..."
          style={{ fontSize: 13, lineHeight: 1.7 }}
        />
      </div>

      <Button
        block
        onClick={() => void handleSave()}
        loading={update.isPending}
        style={{ marginTop: 8 }}
      >
        Сохранить расшифровку
      </Button>
    </Modal>
  );
}
