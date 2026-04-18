import { useState, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { haptic } from '@/shared/lib/haptic';

/**
 * ExpandableText — текстовый блок с ограничением высоты и fade внизу.
 *
 * ПРОБЛЕМА, которую решает: в модалках было много блоков с внутренним скроллом
 * (`max-height: 400px; overflow-y: auto`). Это мешало скроллить саму модалку —
 * палец попадал на блок и скроллил только его содержимое, а не модалку целиком.
 *
 * РЕШЕНИЕ: при маунте измеряем реальную высоту текста. Если она больше
 * `maxLines` строк — показываем clamped-версию с fade-gradient внизу и
 * кнопкой «Показать полностью». Клик разворачивает полностью, без скролла.
 * При повторном клике — сворачивается обратно.
 *
 * Важно: передавай правильный `bg` (цвет фона контейнера, в котором лежит
 * блок), иначе fade-градиент будет некрасивым.
 *
 * Применяется для:
 * - AI-анализ
 * - Оценка AI
 * - Расшифровка приёма / документа
 * - Подробное описание
 * - Рекомендации специалиста
 * - Длинные notes / детали
 */

interface Props {
  text: string;
  /** Цвет фона контейнера (для gradient fade). По умолчанию var(--bg). */
  bg?: string;
  /** Количество строк в свёрнутом состоянии. */
  maxLines?: number;
  /** Доп. стили для текстового блока (цвет, размер и т.п.). */
  textStyle?: CSSProperties;
  /**
   * Цвет кнопки «Показать полностью» / «Свернуть». По умолчанию синий.
   * Передавай цвет секции: AI-блок → var(--purple), Рекомендации → var(--green)
   * и т.д. — чтобы кнопка выглядела естественно в контексте своего блока.
   */
  actionColor?: string;
}

export function ExpandableText({
  text,
  bg = 'var(--bg)',
  maxLines = 10,
  textStyle,
  actionColor = 'var(--blue)',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number>(0);
  const [fullHeight, setFullHeight] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  // Измеряем реальную высоту текста при mount и при изменении содержимого
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Снимаем ограничение перед замером
    const prev = el.style.maxHeight;
    el.style.maxHeight = 'none';

    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight);
    // Если line-height: normal → parseFloat вернёт NaN. Фоллбэк — fontSize*1.5
    const safeLineHeight = Number.isNaN(lineHeight)
      ? parseFloat(style.fontSize) * 1.5
      : lineHeight;

    const targetCollapsed = Math.ceil(safeLineHeight * maxLines);
    const full = el.scrollHeight;

    setFullHeight(full);
    setCollapsedHeight(targetCollapsed);
    // +4px — буфер, чтобы не считать overflow на 1-2 пикселя из-за округления
    setOverflows(full > targetCollapsed + 4);

    el.style.maxHeight = prev;
  }, [text, maxLines]);

  const showClamp = overflows && !expanded;
  const effectiveHeight = overflows
    ? expanded
      ? fullHeight
      : collapsedHeight
    : undefined;

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        style={{
          maxHeight: effectiveHeight,
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          whiteSpace: 'pre-line',
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text)',
          wordBreak: 'break-word',
          ...textStyle,
        }}
      >
        {text}
      </div>

      {showClamp && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '3.5em',
            background: `linear-gradient(to bottom, transparent, ${bg} 80%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {overflows && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            setExpanded((v) => !v);
          }}
          style={{
            display: 'block',
            margin: '10px auto 0',
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: expanded ? 'var(--text-secondary)' : actionColor,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 1,
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {expanded ? 'Свернуть' : 'Показать полностью'}
        </button>
      )}
    </div>
  );
}
