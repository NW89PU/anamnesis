import type { CSSProperties, MouseEvent } from 'react';

interface Props {
  id: number | string;
  style?: CSSProperties;
}

/**
 * Мелкая подпись #N для записей из БД (plan.id, timeline.id, medical_errors.id и т.д.).
 * Используется на карточках списков, чтобы можно было быстро сослаться на конкретную
 * сущность в чате с AI-координатором («закрой план 61»).
 *
 * Стиль: на 1-2 шрифта мельче остального, приглушённый серый, чтобы не бросаться в глаза.
 * user-select: all — при тапе выделяется весь «#N», удобно копировать.
 * stopPropagation на клик — чтобы выделение id не открывало карточку.
 */
export function EntityId({ id, style }: Props) {
  const handleClick = (e: MouseEvent<HTMLSpanElement>) => {
    // Не всплываем: клик по id = попытка скопировать, а не открыть модалку.
    e.stopPropagation();
  };

  return (
    <span
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'center',
        lineHeight: 1,
        fontSize: 10,
        color: 'var(--text-secondary)',
        opacity: 0.55,
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum"',
        letterSpacing: 0.2,
        userSelect: 'all',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      #{id}
    </span>
  );
}
