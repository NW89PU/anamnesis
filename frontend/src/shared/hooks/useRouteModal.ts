import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { haptic } from '@/shared/lib/haptic';

/**
 * Навигация к/от route-based модалок.
 *
 * Паттерн: модалка — это child-роут. Открытие = navigate на child-путь.
 * Закрытие = navigate на родительский путь (back up one level).
 *
 * Пример использования из страницы:
 * ```tsx
 * function PlanPage() {
 *   const { openModal } = useRouteModal();
 *   return (
 *     <>
 *       <ul>
 *         {items.map(item => (
 *           <li onClick={() => openModal(item.id.toString())}>{item.title}</li>
 *         ))}
 *       </ul>
 *       <Outlet /> // сюда приедет PlanItemModal когда URL = /plan/123
 *     </>
 *   );
 * }
 * ```
 *
 * Пример из модалки:
 * ```tsx
 * function PlanItemModal() {
 *   const { closeModal } = useRouteModal();
 *   return <Modal onClose={closeModal}>...</Modal>;
 * }
 * ```
 */
export function useRouteModal() {
  const navigate = useNavigate();
  const location = useLocation();

  const openModal = useCallback(
    (relativePath: string) => {
      haptic('light');
      // Относительная навигация вниз от текущего пути
      navigate(`${location.pathname.replace(/\/$/, '')}/${relativePath}`);
    },
    [navigate, location.pathname]
  );

  const closeModal = useCallback(() => {
    haptic('light');
    // navigate('..') с дефолтным `relative: 'route'` поднимается на один
    // уровень NESTED ROUTE, а не URL-сегмент. Это критично для роутов
    // с многосегментными path типа `visit/:visitId` — `relative: 'path'`
    // стрипал бы только `:visitId`, оставляя `/documents/visit` (не роут),
    // что приводило к catch-all `*` → `/dashboard`.
    navigate('..');
  }, [navigate]);

  return { openModal, closeModal };
}
