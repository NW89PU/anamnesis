import type { ReactNode } from 'react';

/**
 * Пустое состояние списка — иконка + текст + опциональный CTA.
 * Применяет класс `.empty-state` из app.css.
 */

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <h3 className="empty-state-title">{title}</h3>}
      <p className="empty-state-text">{text}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
