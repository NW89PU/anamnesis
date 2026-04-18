import { useNavigate, useLocation } from 'react-router';
import { useDrag } from '@use-gesture/react';
import { motion, useMotionValue, animate, useTransform } from 'motion/react';
import type { ReactNode } from 'react';
import { haptic } from '@/shared/lib/haptic';
import { TAB_ROUTES } from './TabBar';

/**
 * Свайп-навигация между главными вкладками.
 *
 * Работает так:
 * - Drag влево → переход на следующую вкладку (если есть)
 * - Drag вправо → переход на предыдущую
 * - Порог: 1/3 ширины экрана ИЛИ velocity > 0.5
 * - Во время drag — лёгкое следование контента за пальцем (30% от движения)
 *
 * ВАЖНЫЕ ОГОВОРКИ:
 * - Свайпы НЕ срабатывают если путь не входит в `TAB_ROUTES` (например, когда
 *   пользователь на `/graph` или внутри `/dashboard/reminder/5`).
 * - Внутренние скроллируемые элементы должны иметь `touch-action: pan-x` (горизонтальный
 *   скролл таблицы) или `pan-y` (вертикальный скролл списка), чтобы не конфликтовать.
 * - Sheet-модалки рендерятся через Portal в body → они ВНЕ этого wrapper'а и не
 *   подвержены свайпам родителя. ✓
 */

interface SwipeableTabsProps {
  children: ReactNode;
}

export function SwipeableTabs({ children }: SwipeableTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const x = useMotionValue(0);

  // Полупрозрачность во время drag — визуальный фидбек
  const opacity = useTransform(x, [-200, 0, 200], [0.7, 1, 0.7]);

  // Индекс текущего таба (или -1 если не на табе)
  const currentIndex = TAB_ROUTES.findIndex((route) =>
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  const bind = useDrag(
    ({ last, movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      // Не свайпаем если не на главном табе
      if (currentIndex === -1) {
        cancel();
        return;
      }

      if (last) {
        const threshold = window.innerWidth / 3;
        const fast = Math.abs(vx) > 0.5;
        const goNext = mx < -threshold || (fast && dx < 0);
        const goPrev = mx > threshold || (fast && dx > 0);

        if (goNext && currentIndex < TAB_ROUTES.length - 1) {
          haptic('medium');
          const nextRoute = TAB_ROUTES[currentIndex + 1];
          if (nextRoute) navigate(nextRoute);
        } else if (goPrev && currentIndex > 0) {
          haptic('medium');
          const prevRoute = TAB_ROUTES[currentIndex - 1];
          if (prevRoute) navigate(prevRoute);
        }

        // Независимо от результата — возвращаем контент в исходное положение
        animate(x, 0, { type: 'spring', damping: 30, stiffness: 300 });
      } else {
        // Лёгкое смещение контента за пальцем (30% от движения)
        x.set(mx * 0.3);
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      // Не перехватываем vertical scroll
      threshold: 10,
    }
  );

  // ВАЖНО: внешний div ловит жесты (useDrag), внутренний motion.div анимируется.
  // Это разделение нужно из-за несовместимости типов onDrag между
  // @use-gesture/react (React DragEventHandler) и motion/react (кастомный PanHandler).
  return (
    <div {...bind()} style={{ touchAction: 'pan-y', minHeight: '100%' }}>
      <motion.div style={{ x, opacity }}>{children}</motion.div>
    </div>
  );
}
