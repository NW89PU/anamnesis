import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { haptic } from '@/shared/lib/haptic';

/**
 * Круглая иконочная кнопка — для панелей действий, close-buttons.
 */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // для aria
  size?: number;
}

export function IconButton({ icon, label, size = 40, className, onClick, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx('icon-button', className)}
      style={{ width: size, height: size }}
      onClick={(e) => {
        haptic('light');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
