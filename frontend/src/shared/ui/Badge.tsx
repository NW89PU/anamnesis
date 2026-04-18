import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Цветной бейдж. Применяет классы `.badge` + `.badge-{color}` из app.css.
 * Цвета те же что и в vanilla: blue, green, orange, red, purple, gray.
 */

export type BadgeColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ color = 'gray', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={clsx('badge', `badge-${color}`, className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}
