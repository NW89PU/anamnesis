import type { ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Обёртка для контента страницы. Даёт правильные padding'и (учёт header + tab-bar)
 * и классы для page-transition анимации.
 *
 * ИСПОЛЬЗОВАНИЕ: оборачивай содержимое каждой страницы:
 * ```tsx
 * export function PlanPage() {
 *   return (
 *     <PageContainer>
 *       <PlanContent />
 *       <Outlet />
 *     </PageContainer>
 *   );
 * }
 * ```
 */

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={clsx('page-container', className)}>{children}</div>;
}
