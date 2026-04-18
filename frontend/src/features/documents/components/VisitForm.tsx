import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, Textarea, Button } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import { fetchSpecialists } from '@/features/more/api';
import type { VisitInput } from '../api';
import type { Timeline } from '@/shared/types';

/**
 * Универсальная форма создания/редактирования визита.
 * Порт из vanilla `documents.js` showCreateVisitModal / showEditVisitModal.
 *
 * Использует контролируемые useState (без react-hook-form — форма простая,
 * не хочется тащить лишнюю абстракцию).
 */

const SPECIALIST_TYPES = [
  'Невролог', 'Педиатр', 'Логопед', 'Психолог', 'Психиатр',
  'Ортопед', 'ЛОР', 'Офтальмолог', 'Стоматолог', 'Хирург',
  'Аллерголог', 'Дерматолог', 'Гастроэнтеролог', 'Кардиолог',
  'Эндокринолог', 'Уролог', 'Нефролог', 'Остеопат', 'Реабилитолог',
  'Другой специалист',
];

interface Props {
  initial?: Timeline | undefined;
  onSubmit: (data: VisitInput) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  showAiField?: boolean; // только при редактировании
  extraFooter?: React.ReactNode; // кнопка delete в edit modal
}

export function VisitForm({
  initial,
  onSubmit,
  submitting = false,
  submitLabel = 'Сохранить',
  showAiField = false,
  extraFooter,
}: Props) {
  const { data: specialists = [] } = useQuery({
    queryKey: qk.specialists,
    queryFn: fetchSpecialists,
  });

  const today = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState(initial?.title ?? '');
  const [eventDate, setEventDate] = useState(
    initial?.event_date ? initial.event_date.split('T')[0] ?? today : today
  );
  const [specialistId, setSpecialistId] = useState(
    initial?.specialist_id != null ? String(initial.specialist_id) : ''
  );
  const [specialistName, setSpecialistName] = useState(initial?.specialist_name ?? '');
  const [specialistType, setSpecialistType] = useState(initial?.specialist_type ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'visit');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [transcription, setTranscription] = useState(initial?.transcription ?? '');
  const [aiAssessment, setAiAssessment] = useState(initial?.ai_assessment ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !eventDate) return;
    await onSubmit({
      title: trimmedTitle,
      event_date: eventDate,
      specialist_id: specialistId ? Number(specialistId) : null,
      specialist_name: specialistName.trim() || null,
      specialist_type: specialistType || null,
      category: category || null,
      description: description.trim() || null,
      transcription: transcription.trim() || null,
      ai_assessment: showAiField ? aiAssessment.trim() || null : (initial?.ai_assessment ?? null),
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Field label="Название приёма *">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Приём невролога"
          required
        />
      </Field>

      <Field label="Дата *">
        <Input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
        />
      </Field>

      <Field label="Специалист">
        <Select value={specialistId} onChange={(e) => setSpecialistId(e.target.value)}>
          <option value="">— Выберите из списка —</option>
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? '(без имени)'} — {s.specialization ?? ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Или вручную: имя врача">
        <Input
          value={specialistName}
          onChange={(e) => setSpecialistName(e.target.value)}
          placeholder="ФИО врача (если нет в списке)"
        />
      </Field>

      <Field label="Специализация">
        <Select value={specialistType ?? ''} onChange={(e) => setSpecialistType(e.target.value)}>
          <option value="">— Выберите —</option>
          {SPECIALIST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Категория">
        <Select value={category ?? 'visit'} onChange={(e) => setCategory(e.target.value)}>
          <option value="visit">Приём</option>
          <option value="test">Обследование</option>
          <option value="diagnosis">Диагноз</option>
          <option value="milestone">Событие</option>
        </Select>
      </Field>

      <Field label="Описание / заключение">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Краткое описание визита или заключение врача"
          rows={3}
        />
      </Field>

      <Field label="Расшифровка (из NotebookLM)">
        <Textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Вставьте сюда расшифровку аудиозаписи приёма..."
          rows={5}
          style={{ fontSize: 13 }}
        />
      </Field>

      {showAiField && (
        <Field label="Анализ AI">
          <Textarea
            value={aiAssessment}
            onChange={(e) => setAiAssessment(e.target.value)}
            rows={4}
            style={{ fontSize: 13 }}
          />
        </Field>
      )}

      <Field label="Заметки">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Дополнительные заметки"
          rows={2}
        />
      </Field>

      <Button type="submit" block loading={submitting} style={{ marginTop: 8 }}>
        {submitLabel}
      </Button>

      {extraFooter}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
