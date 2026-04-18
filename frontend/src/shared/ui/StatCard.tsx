import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { haptic } from '@/shared/lib/haptic';

/**
 * Карточка статистики на Dashboard. Применяет классы `.stat-card.{color}` из app.css.
 *
 * Используется в Dashboard для 4 главных цифр: Осталось / Выполнено / Ошибки / Диагнозы.
 *
 * Принимает либо `to` (для навигации через Router) либо `onClick` для кастомной обработки.
 */

export type StatColor = 'blue' | 'green' | 'orange' | 'red' | 'purple';

interface StatCardProps {
  value: number | string;
  label: string;
  icon?: ReactNode;
  color: StatColor;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ value, label, icon, color, to, onClick, className }: StatCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    haptic('light');
    if (to) navigate(to);
    else if (onClick) onClick();
  };

  const isInteractive = !!(to || onClick);

  return (
    <button
      type="button"
      className={clsx('stat-card', color, className)}
      onClick={isInteractive ? handleClick : undefined}
      disabled={!isInteractive}
      style={isInteractive ? undefined : { cursor: 'default' }}
    >
      <div className="stat-value">{value}</div>
      <div className="stat-label">
        {icon}
        {label}
      </div>
    </button>
  );
}
