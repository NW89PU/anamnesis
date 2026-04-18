// Changelog renderer — превращает строки из audit_log в человекочитаемые
// записи для истории изменений (HistoryModal во фронте).
//
// Формат выходной записи:
//   {
//     id: <audit_log.id>,
//     entity_type: 'timeline' | 'document' | 'diagnosis' | ...,
//     entity_id: <number>,
//     action: 'insert' | 'update' | 'delete',
//     icon: 'IconStethoscope',       // имя Tabler-иконки (без эмоджи)
//     color: 'green' | 'blue' | ...,  // семантический цвет для фронта
//     title: 'Добавлен визит «Невролог»',              // главная строка
//     subtitle: 'Иванов И.И. • 25 марта 2026',         // опционально
//     at: '2026-04-11 02:41:19',
//     grouped_ids: [<ids>],          // при группировке — все id из audit_log
//     ref_id: <entity_id>,            // для drill-down (куда редиректить по тапу)
//     ref_kind: 'timeline' | ...      // тип сущности для роутинга
//   }

const { rawDb } = require('../db');

// ─── Утилиты ────────────────────────────────────────────────

function safeParseJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function formatDate(ymd) {
  if (!ymd) return '';
  // "2026-03-25" → "25 марта 2026"
  const months = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd));
  if (!m) return String(ymd);
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  return `${day} ${months[month] || ''} ${year}`;
}

/** Набор изменившихся ключей между old и new. */
function diffKeys(oldObj, newObj) {
  const oldo = oldObj || {};
  const newo = newObj || {};
  const keys = new Set([...Object.keys(oldo), ...Object.keys(newo)]);
  const changed = [];
  for (const k of keys) {
    const a = oldo[k];
    const b = newo[k];
    if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return changed;
}

// ─── Lookup-хелперы (для получения человеческих имён из связанных таблиц) ──

const cache = new Map();
function ttlCached(key, fn) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < 5000) return hit.value; // 5 сек кеш в рамках одного запроса
  const value = fn();
  cache.set(key, { at: now, value });
  return value;
}

function timelineBrief(id) {
  return ttlCached(`t:${id}`, () => {
    try {
      return rawDb.prepare('SELECT title, event_date, specialist_name FROM timeline WHERE id=?').get(id) || null;
    } catch { return null; }
  });
}

function medicationName(id) {
  return ttlCached(`m:${id}`, () => {
    try {
      return rawDb.prepare('SELECT name FROM medications WHERE id=?').get(id)?.name || null;
    } catch { return null; }
  });
}

function specialistBrief(id) {
  return ttlCached(`s:${id}`, () => {
    try {
      return rawDb.prepare('SELECT full_name, specialization FROM specialists WHERE id=?').get(id) || null;
    } catch { return null; }
  });
}

function documentTitle(id) {
  return ttlCached(`d:${id}`, () => {
    try {
      return rawDb.prepare('SELECT title FROM documents WHERE id=?').get(id)?.title || null;
    } catch { return null; }
  });
}

function diagnosisName(id) {
  return ttlCached(`dg:${id}`, () => {
    try {
      return rawDb.prepare('SELECT name FROM diagnoses WHERE id=?').get(id)?.name || null;
    } catch { return null; }
  });
}

function planTitle(id) {
  return ttlCached(`p:${id}`, () => {
    try {
      return rawDb.prepare('SELECT title FROM plan WHERE id=?').get(id)?.title || null;
    } catch { return null; }
  });
}

// ─── Rendering для каждого entity_type ─────────────────────
//
// Возвращает { icon, color, title, subtitle?, ref_kind, ref_id }
// Используется Tabler-иконка по имени (фронт импортирует @tabler/icons-react).

const renderers = {
  timeline: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const title = nv?.title || ov?.title || 'Визит';
    const eventDate = nv?.event_date || ov?.event_date;
    const specName = nv?.specialist_name || ov?.specialist_name;

    if (row.action === 'insert') {
      return {
        icon: 'IconStethoscope',
        color: 'green',
        title: `Добавлен визит «${title}»`,
        subtitle: [specName, eventDate && formatDate(eventDate)].filter(Boolean).join(' • '),
        ref_kind: 'timeline',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconStethoscope',
        color: 'red',
        title: `Удалён визит «${title}»`,
        subtitle: eventDate && formatDate(eventDate),
        ref_kind: null,
        ref_id: null,
      };
    }
    // update — смотрим что именно изменилось
    const changed = diffKeys(ov, nv);
    const changedLabels = [];
    if (changed.includes('title')) changedLabels.push('название');
    if (changed.includes('description')) changedLabels.push('описание');
    if (changed.includes('ai_assessment')) changedLabels.push('AI-оценка');
    if (changed.includes('transcription_len')) changedLabels.push('транскрипция');
    if (changed.includes('specialist_id')) changedLabels.push('специалист');

    // Выбираем главное изменение
    if (changedLabels.length === 1 && changedLabels[0] === 'AI-оценка') {
      return {
        icon: 'IconBrain',
        color: 'purple',
        title: `AI-оценка визита «${title}»`,
        subtitle: [specName, eventDate && formatDate(eventDate)].filter(Boolean).join(' • '),
        ref_kind: 'timeline',
        ref_id: row.entity_id,
      };
    }
    return {
      icon: 'IconStethoscope',
      color: 'blue',
      title: `Обновлён визит «${title}»`,
      subtitle: changedLabels.length > 0
        ? `${changedLabels.join(', ')} • ${[specName, eventDate && formatDate(eventDate)].filter(Boolean).join(' • ')}`
        : [specName, eventDate && formatDate(eventDate)].filter(Boolean).join(' • '),
      ref_kind: 'timeline',
      ref_id: row.entity_id,
    };
  },

  document: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const title = nv?.title || ov?.title || 'Документ';
    const timelineId = nv?.timeline_id || ov?.timeline_id;
    const source = nv?.source_doctor;
    let subtitle = '';
    if (timelineId) {
      const t = timelineBrief(timelineId);
      if (t) subtitle = `Визит: ${t.title || ''} ${t.event_date ? '• ' + formatDate(t.event_date) : ''}`.trim();
    }
    if (source && !subtitle) subtitle = `Выдал: ${source}`;

    if (row.action === 'insert') {
      return {
        icon: 'IconFileText',
        color: 'green',
        title: `Добавлен документ «${title}»`,
        subtitle,
        ref_kind: timelineId ? 'timeline' : 'document',
        ref_id: timelineId || row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconFileText',
        color: 'red',
        title: `Удалён документ «${title}»`,
        subtitle,
        ref_kind: null,
        ref_id: null,
      };
    }
    // update
    const changed = diffKeys(ov, nv);
    if (changed.includes('ai_assessment') && changed.length === 1) {
      return {
        icon: 'IconBrain',
        color: 'purple',
        title: `AI-оценка документа «${title}»`,
        subtitle,
        ref_kind: 'timeline',
        ref_id: timelineId,
      };
    }
    if (changed.includes('timeline_id')) {
      const oldT = ov?.timeline_id ? timelineBrief(ov.timeline_id) : null;
      const newT = nv?.timeline_id ? timelineBrief(nv.timeline_id) : null;
      return {
        icon: 'IconArrowsExchange',
        color: 'orange',
        title: `Документ «${title}» перемещён`,
        subtitle: oldT && newT ? `${oldT.title} → ${newT.title}` : subtitle,
        ref_kind: 'timeline',
        ref_id: nv?.timeline_id,
      };
    }
    return {
      icon: 'IconFileText',
      color: 'blue',
      title: `Обновлён документ «${title}»`,
      subtitle,
      ref_kind: 'timeline',
      ref_id: timelineId,
    };
  },

  diagnosis: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const name = nv?.name || ov?.name || 'Диагноз';

    if (row.action === 'insert') {
      return {
        icon: 'IconClipboardList',
        color: 'green',
        title: `Новый диагноз «${name}»`,
        subtitle: nv?.icd_code ? `Код: ${nv.icd_code}` : '',
        ref_kind: 'diagnoses',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconClipboardList',
        color: 'red',
        title: `Удалён диагноз «${name}»`,
        ref_kind: null,
      };
    }
    const changed = diffKeys(ov, nv);
    if (changed.includes('status')) {
      if (nv?.status === 'resolved' || nv?.status === 'closed') {
        return {
          icon: 'IconCheck',
          color: 'green',
          title: `Диагноз «${name}» закрыт`,
          ref_kind: 'diagnoses',
          ref_id: row.entity_id,
        };
      }
      return {
        icon: 'IconClipboardList',
        color: 'orange',
        title: `Статус диагноза «${name}»: ${nv?.status || 'обновлён'}`,
        ref_kind: 'diagnoses',
        ref_id: row.entity_id,
      };
    }
    if (changed.includes('ai_assessment') && changed.length === 1) {
      return {
        icon: 'IconBrain',
        color: 'purple',
        title: `AI-оценка диагноза «${name}»`,
        ref_kind: 'diagnoses',
        ref_id: row.entity_id,
      };
    }
    return {
      icon: 'IconClipboardList',
      color: 'blue',
      title: `Обновлён диагноз «${name}»`,
      ref_kind: 'diagnoses',
      ref_id: row.entity_id,
    };
  },

  medication: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const name = nv?.name || ov?.name || 'Препарат';

    if (row.action === 'insert') {
      return {
        icon: 'IconPill',
        color: 'green',
        title: `Новый препарат «${name}»`,
        subtitle: nv?.inn ? `МНН: ${nv.inn}` : '',
        ref_kind: 'medication',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconPill',
        color: 'red',
        title: `Удалён препарат «${name}»`,
        ref_kind: null,
      };
    }
    const changed = diffKeys(ov, nv);
    if (changed.includes('status')) {
      const label = nv?.status === 'completed' ? 'курс завершён'
        : nv?.status === 'cancelled' ? 'отменён'
        : nv?.status === 'active' ? 'курс активен'
        : nv?.status;
      return {
        icon: 'IconPill',
        color: nv?.status === 'completed' ? 'green' : nv?.status === 'cancelled' ? 'red' : 'blue',
        title: `Препарат «${name}»: ${label}`,
        subtitle: nv?.stop_reason,
        ref_kind: 'medication',
        ref_id: row.entity_id,
      };
    }
    if (changed.includes('ai_assessment') && changed.length === 1) {
      return {
        icon: 'IconBrain',
        color: 'purple',
        title: `AI-оценка препарата «${name}»`,
        ref_kind: 'medication',
        ref_id: row.entity_id,
      };
    }
    return {
      icon: 'IconPill',
      color: 'blue',
      title: `Обновлён препарат «${name}»`,
      ref_kind: 'medication',
      ref_id: row.entity_id,
    };
  },

  prescription: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const medId = nv?.medication_id || ov?.medication_id;
    const name = medId ? (medicationName(medId) || 'препарата') : 'препарата';
    const timelineId = nv?.timeline_id || ov?.timeline_id;
    const t = timelineId ? timelineBrief(timelineId) : null;
    const specId = nv?.specialist_id || ov?.specialist_id;
    const spec = specId ? specialistBrief(specId) : null;

    const subtitle = [
      spec && spec.full_name,
      t && formatDate(t.event_date),
    ].filter(Boolean).join(' • ');

    if (row.action === 'insert') {
      return {
        icon: 'IconPillFilled',
        color: 'green',
        title: `Назначение: «${name}»`,
        subtitle,
        ref_kind: timelineId ? 'timeline' : null,
        ref_id: timelineId,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconPillFilled',
        color: 'red',
        title: `Отвязано назначение: «${name}»`,
        subtitle,
        ref_kind: null,
      };
    }
    const changed = diffKeys(ov, nv);
    if (changed.includes('course_status')) {
      return {
        icon: 'IconPillFilled',
        color: 'blue',
        title: `Курс «${name}»: ${nv?.course_status || ''}`,
        subtitle,
        ref_kind: timelineId ? 'timeline' : null,
        ref_id: timelineId,
      };
    }
    return {
      icon: 'IconPillFilled',
      color: 'blue',
      title: `Обновлено назначение: «${name}»`,
      subtitle,
      ref_kind: timelineId ? 'timeline' : null,
      ref_id: timelineId,
    };
  },

  plan: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const title = nv?.title || ov?.title || 'Пункт плана';

    if (row.action === 'insert') {
      return {
        icon: 'IconListCheck',
        color: 'green',
        title: `План: «${title}»`,
        subtitle: nv?.priority ? `Приоритет: ${nv.priority}` : '',
        ref_kind: 'plan',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconListCheck',
        color: 'red',
        title: `Удалён пункт плана «${title}»`,
        ref_kind: null,
      };
    }
    const changed = diffKeys(ov, nv);
    if (changed.includes('status') && nv?.status === 'done') {
      return {
        icon: 'IconCheck',
        color: 'green',
        title: `Выполнено: «${title}»`,
        ref_kind: 'plan',
        ref_id: row.entity_id,
      };
    }
    return {
      icon: 'IconListCheck',
      color: 'blue',
      title: `Обновлён план: «${title}»`,
      ref_kind: 'plan',
      ref_id: row.entity_id,
    };
  },

  error: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const title = nv?.title || ov?.title || 'Ошибка';
    const severity = nv?.severity || ov?.severity;

    if (row.action === 'insert') {
      return {
        icon: 'IconAlertTriangle',
        color: severity === 'critical' ? 'red' : 'orange',
        title: `Новая ошибка: «${title}»`,
        subtitle: severity ? `Серьёзность: ${severity}` : '',
        ref_kind: 'error',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconAlertTriangle',
        color: 'red',
        title: `Удалена ошибка «${title}»`,
        ref_kind: null,
      };
    }
    const changed = diffKeys(ov, nv);
    if (changed.includes('status') && (nv?.status === 'resolved' || nv?.status === 'closed')) {
      return {
        icon: 'IconCheck',
        color: 'green',
        title: `Решена ошибка: «${title}»`,
        ref_kind: 'error',
        ref_id: row.entity_id,
      };
    }
    return {
      icon: 'IconAlertTriangle',
      color: 'blue',
      title: `Обновлена ошибка «${title}»`,
      ref_kind: 'error',
      ref_id: row.entity_id,
    };
  },

  lab_result: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const testName = nv?.test_name || ov?.test_name || 'Анализ';
    const parameter = nv?.parameter || ov?.parameter || '';
    const value = nv?.value ?? ov?.value;
    const unit = nv?.unit || '';
    const status = nv?.status || ov?.status;

    if (row.action === 'insert') {
      return {
        icon: 'IconFlask',
        color: status === 'high' || status === 'low' ? 'orange'
             : status === 'critical' ? 'red'
             : 'green',
        title: `Анализ: ${parameter} ${value ?? ''}${unit}`,
        subtitle: testName + (nv?.test_date ? ` • ${formatDate(nv.test_date)}` : ''),
        ref_kind: 'lab',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconFlask',
        color: 'red',
        title: `Удалён анализ: ${parameter}`,
        ref_kind: null,
      };
    }
    return {
      icon: 'IconFlask',
      color: 'blue',
      title: `Обновлён анализ: ${parameter}`,
      subtitle: testName,
      ref_kind: 'lab',
      ref_id: row.entity_id,
    };
  },

  specialist: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const name = nv?.full_name || ov?.full_name || 'Специалист';
    const spec = nv?.specialization || ov?.specialization || '';

    if (row.action === 'insert') {
      return {
        icon: 'IconUserHeart',
        color: 'green',
        title: `Добавлен специалист: ${name}`,
        subtitle: spec + (nv?.clinic ? ` • ${nv.clinic}` : ''),
        ref_kind: 'specialists',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconUserHeart',
        color: 'red',
        title: `Удалён специалист: ${name}`,
        ref_kind: null,
      };
    }
    return {
      icon: 'IconUserHeart',
      color: 'blue',
      title: `Обновлён специалист: ${name}`,
      subtitle: spec,
      ref_kind: 'specialists',
      ref_id: row.entity_id,
    };
  },

  comment: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const entType = nv?.entity_type || ov?.entity_type;
    const entId = nv?.entity_id || ov?.entity_id;
    const text = nv?.text || ov?.text || '';
    const shortText = text.length > 80 ? text.slice(0, 80) + '…' : text;

    // Найти к чему относится комментарий
    let toLabel = '';
    if (entType === 'timeline' && entId) {
      const t = timelineBrief(entId);
      if (t) toLabel = `к визиту «${t.title}»`;
    } else if (entType === 'document' && entId) {
      const d = documentTitle(entId);
      if (d) toLabel = `к документу «${d}»`;
    } else if (entType === 'plan' && entId) {
      const p = planTitle(entId);
      if (p) toLabel = `к плану «${p}»`;
    } else if (entType === 'diagnosis' && entId) {
      const d = diagnosisName(entId);
      if (d) toLabel = `к диагнозу «${d}»`;
    } else if (entType === 'medication' && entId) {
      const m = medicationName(entId);
      if (m) toLabel = `к препарату «${m}»`;
    } else if (entType === 'ai_chat') {
      toLabel = 'в чате с AI';
    }

    if (row.action === 'insert') {
      return {
        icon: 'IconMessage',
        color: 'green',
        title: `Комментарий ${toLabel}`,
        subtitle: shortText,
        ref_kind: entType === 'ai_chat' ? 'ai-chat' : entType,
        ref_id: entId,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconMessage',
        color: 'red',
        title: `Удалён комментарий ${toLabel}`,
        subtitle: shortText,
        ref_kind: null,
      };
    }
    return {
      icon: 'IconMessage',
      color: 'blue',
      title: `Изменён комментарий ${toLabel}`,
      subtitle: shortText,
      ref_kind: entType === 'ai_chat' ? 'ai-chat' : entType,
      ref_id: entId,
    };
  },

  vaccination: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const name = nv?.name || ov?.name || 'Прививка';

    if (row.action === 'insert') {
      return {
        icon: 'IconVaccine',
        color: 'green',
        title: `Прививка: «${name}»`,
        subtitle: nv?.actual_date ? `Сделана ${formatDate(nv.actual_date)}` : nv?.scheduled_date ? `Запланирована на ${formatDate(nv.scheduled_date)}` : '',
        ref_kind: 'vaccinations',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconVaccine',
        color: 'red',
        title: `Удалена прививка «${name}»`,
        ref_kind: null,
      };
    }
    return {
      icon: 'IconVaccine',
      color: 'blue',
      title: `Обновлена прививка «${name}»`,
      ref_kind: 'vaccinations',
      ref_id: row.entity_id,
    };
  },

  growth: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const date = nv?.measured_at || ov?.measured_at;
    const parts = [];
    if (nv?.height_cm || ov?.height_cm) parts.push(`рост ${nv?.height_cm ?? ov?.height_cm} см`);
    if (nv?.weight_kg || ov?.weight_kg) parts.push(`вес ${nv?.weight_kg ?? ov?.weight_kg} кг`);

    if (row.action === 'insert') {
      return {
        icon: 'IconRuler2',
        color: 'green',
        title: `Измерение: ${parts.join(', ') || 'новая запись'}`,
        subtitle: date ? formatDate(date) : '',
        ref_kind: 'growth',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconRuler2',
        color: 'red',
        title: `Удалено измерение от ${date ? formatDate(date) : '?'}`,
        ref_kind: null,
      };
    }
    return {
      icon: 'IconRuler2',
      color: 'blue',
      title: `Обновлено измерение ${date ? formatDate(date) : ''}`,
      ref_kind: 'growth',
      ref_id: row.entity_id,
    };
  },

  reminder: (row) => {
    const nv = safeParseJson(row.new_value);
    const ov = safeParseJson(row.old_value);
    const title = nv?.title || ov?.title || 'Напоминание';

    if (row.action === 'insert') {
      return {
        icon: 'IconBell',
        color: 'green',
        title: `Напоминание: «${title}»`,
        subtitle: nv?.remind_at ? `На ${nv.remind_at}` : '',
        ref_kind: 'reminders',
        ref_id: row.entity_id,
      };
    }
    if (row.action === 'delete') {
      return {
        icon: 'IconBell',
        color: 'red',
        title: `Удалено напоминание «${title}»`,
        ref_kind: null,
      };
    }
    const changed = diffKeys(ov, nv);
    if (changed.includes('status') && (nv?.status === 'done' || nv?.status === 'completed')) {
      return {
        icon: 'IconCheck',
        color: 'green',
        title: `Выполнено напоминание «${title}»`,
        ref_kind: 'reminders',
        ref_id: row.entity_id,
      };
    }
    return {
      icon: 'IconBell',
      color: 'blue',
      title: `Обновлено напоминание «${title}»`,
      ref_kind: 'reminders',
      ref_id: row.entity_id,
    };
  },
};

/**
 * Обернуть сырую строку audit_log в форматированную запись.
 * Возвращает null если рендерер для этого типа не определён.
 */
function renderAuditRow(row) {
  const renderer = renderers[row.entity_type];
  if (!renderer) return null;
  try {
    const out = renderer(row);
    if (!out) return null;
    return {
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      action: row.action,
      icon: out.icon,
      color: out.color,
      title: out.title,
      subtitle: out.subtitle || null,
      at: row.created_at,
      ref_kind: out.ref_kind || null,
      ref_id: out.ref_id || null,
    };
  } catch (e) {
    console.error('[changelog] render error', row.entity_type, row.action, e.message);
    return null;
  }
}

// ─── Группировка близких по времени правок одной сущности ──
// Если две записи:
//   - одного типа
//   - одной сущности (entity_id)
//   - одного action
//   - с разницей во времени <= WINDOW_SEC
// → объединяются в одну с `grouped_ids` массивом.

const GROUP_WINDOW_SEC = 60;

function parseCreatedAt(s) {
  // "2026-04-11 02:41:19" → timestamp
  return Date.parse(String(s).replace(' ', 'T') + 'Z');
}

function groupEntries(entries) {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => parseCreatedAt(b.at) - parseCreatedAt(a.at));
  const groups = [];
  for (const e of sorted) {
    const prev = groups[groups.length - 1];
    if (
      prev &&
      prev.entity_type === e.entity_type &&
      prev.entity_id === e.entity_id &&
      prev.action === e.action &&
      Math.abs(parseCreatedAt(prev.at) - parseCreatedAt(e.at)) <= GROUP_WINDOW_SEC * 1000
    ) {
      // Мерж: prev уже свежее, добавляем e.id в grouped_ids
      prev.grouped_ids = prev.grouped_ids || [prev.id];
      prev.grouped_ids.push(e.id);
    } else {
      groups.push({ ...e, grouped_ids: [e.id] });
    }
  }
  return groups;
}

// ─── Группировка по датам ──────────────────────────────────

function formatDateLabel(dateStr) {
  // dateStr = "2026-04-11"
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(dateStr + 'T00:00:00');
  const targetMid = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (targetMid.getTime() === today.getTime()) return 'Сегодня';
  if (targetMid.getTime() === yesterday.getTime()) return 'Вчера';
  const diffDays = Math.floor((today.getTime() - targetMid.getTime()) / 86400000);
  if (diffDays > 0 && diffDays < 7) return `${diffDays} дн. назад`;
  return formatDate(dateStr);
}

function groupByDate(entries) {
  const byDate = new Map();
  for (const e of entries) {
    const datePart = String(e.at).slice(0, 10);
    if (!byDate.has(datePart)) byDate.set(datePart, []);
    byDate.get(datePart).push(e);
  }
  const groups = [];
  const sortedDates = [...byDate.keys()].sort().reverse();
  for (const d of sortedDates) {
    groups.push({
      date: d,
      label: formatDateLabel(d),
      entries: byDate.get(d),
    });
  }
  return groups;
}

/**
 * Главная публичная функция: получить историю для пациента.
 * Возвращает { groups: [{date, label, entries}], total, has_more }.
 */
function getHistory({ patientId, limit = 100, offset = 0, since = null }) {
  cache.clear(); // свежий кеш на каждый запрос

  const params = [patientId];
  let where = 'patient_id = ?';
  if (since) {
    where += ' AND created_at > ?';
    params.push(since);
  }
  // fetch limit+1 чтобы понять есть ли ещё
  const rows = rawDb.prepare(`
    SELECT * FROM audit_log
    WHERE ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit + 1, offset);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;

  // Рендеринг
  const rendered = trimmed
    .map(renderAuditRow)
    .filter(Boolean);

  // Группировка близких
  const grouped = groupEntries(rendered);

  // Группировка по датам
  const byDate = groupByDate(grouped);

  // Общий счётчик
  const totalRow = rawDb.prepare(
    'SELECT COUNT(*) AS c FROM audit_log WHERE ' + where
  ).get(...params);

  return {
    groups: byDate,
    total: totalRow.c,
    has_more: hasMore,
  };
}

module.exports = { getHistory, renderAuditRow };
