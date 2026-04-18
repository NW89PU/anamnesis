import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { haptic } from '@/shared/lib/haptic';
import { Spinner } from './Spinner';

/**
 * Базовая кнопка. Применяет классы `.btn` + `.btn-{variant}` из app.css.
 *
 * ПАТТЕРН: все интерактивные элементы через Button для единообразия haptic.
 * Не пиши голый `<button>` в компонентах фич.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  icon,
  className,
  onClick,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        block && 'btn-block',
        className
      )}
      onClick={(e) => {
        if (disabled || loading) return;
        haptic('light');
        onClick?.(e);
      }}
      disabled={loading || disabled}
      {...rest}
    >
      {loading ? (
        <Spinner size={16} />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
