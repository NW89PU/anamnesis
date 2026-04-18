import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';
import { haptic } from '@/shared/lib/haptic';

/**
 * Базовая карточка — применяет класс `.card` из app.css.
 *
 * Если передан `onClick` — применяется `.card-interactive` (cursor + hover + haptic).
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children: ReactNode;
}

export function Card({ interactive, className, onClick, children, ...rest }: CardProps) {
  const clickable = interactive || !!onClick;
  return (
    <div
      className={clsx('card', clickable && 'card-interactive', className)}
      onClick={(e) => {
        if (clickable) haptic('light');
        onClick?.(e);
      }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          haptic('light');
          (e.currentTarget as HTMLElement).click();
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
