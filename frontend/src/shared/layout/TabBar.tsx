import { useNavigate, useLocation } from 'react-router';
import {
  IconLayoutDashboard,
  IconListCheck,
  IconAlertTriangle,
  IconStethoscope,
  IconDots,
  type Icon,
} from '@tabler/icons-react';
import clsx from 'clsx';
import { haptic } from '@/shared/lib/haptic';

/**
 * Нижняя навигация — 5 главных вкладок.
 * Применяет классы `.tab-bar` и `.tab-item` из app.css.
 * Визуально совпадает с vanilla `frontend/index.html:42-63`.
 */

interface Tab {
  to: string;
  label: string;
  icon: Icon;
}

const TABS: Tab[] = [
  { to: '/dashboard', label: 'Сводка', icon: IconLayoutDashboard },
  { to: '/plan', label: 'План', icon: IconListCheck },
  { to: '/errors', label: 'Ошибки', icon: IconAlertTriangle },
  { to: '/documents', label: 'Приёмы', icon: IconStethoscope },
  { to: '/more', label: 'Ещё', icon: IconDots },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = (to: string) => {
    haptic('light');
    // Передаём state с флагом instant: true — AppShell прочитает его
    // и пропустит transition-анимацию (клик по табу — моментально).
    // Свайпы идут через обычный navigate без state → анимация играет.
    navigate(to, { state: { instant: true } });
  };

  return (
    <nav className="tab-bar" id="tab-bar">
      {TABS.map((tab) => {
        const IconComp = tab.icon;
        // Активная вкладка — если текущий путь совпадает или начинается с `/tab/`
        // (для child-роутов модалок: `/documents/visit/42` → «Приёмы» активен)
        const isActive =
          location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
        return (
          <button
            key={tab.to}
            type="button"
            className={clsx('tab-item', isActive && 'active')}
            onClick={() => handleClick(tab.to)}
          >
            <IconComp className="tab-icon-i" size={22} stroke={1.8} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Экспортируем список вкладок — используется в SwipeableTabs для определения соседей
export const TAB_ROUTES = TABS.map((t) => t.to);
