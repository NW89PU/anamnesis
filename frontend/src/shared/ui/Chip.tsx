import clsx from 'clsx';
import type { ReactNode } from 'react';
import { haptic } from '@/shared/lib/haptic';

/**
 * Chip (фильтр-таб). Применяет `.chip` из app.css.
 * Если `active` — подсвечивается (через `.chip-active`).
 */

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Chip({ active, onClick, icon, children, className }: ChipProps) {
  return (
    <button
      type="button"
      className={clsx('chip', active && 'chip-active', className)}
      onClick={() => {
        haptic('light');
        onClick?.();
      }}
    >
      {icon}
      {children}
    </button>
  );
}
