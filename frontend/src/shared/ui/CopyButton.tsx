import { useState } from 'react';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';

/**
 * Кнопка копирования текста в clipboard. Показывает «Скопировано» на 1.5 сек.
 * Порт из vanilla `.copy-btn` handler.
 */
interface Props {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, label = 'Копировать', size = 'sm' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('light');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '4px 10px' : '6px 12px',
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 600,
        background: copied ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.08)',
        color: copied ? 'var(--green)' : 'var(--blue)',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      {copied ? 'Скопировано' : label}
    </button>
  );
}
