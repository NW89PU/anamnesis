import { useLocation } from 'react-router';
import { PatientSwitcher } from './PatientSwitcher';
import { useIsDesktop } from '@/shared/hooks/useMediaQuery';

/**
 * Хедер приложения.
 *
 * На мобилке — фиксированный сверху, с заголовком и patient switcher справа.
 * На десктопе — упрощённый хедер внутри main area (не фиксированный),
 * т.к. навигация полностью делается через sidebar. Patient switcher уже
 * есть в sidebar, но оставляем и в хедере как задел на будущее.
 */

// Карта соответствия роут → заголовок
const TITLES: Record<string, string> = {
  '/dashboard': 'Сводка',
  '/plan': 'План',
  '/errors': 'Ошибки',
  '/documents': 'Приёмы',
  '/diagnoses': 'Диагнозы',
  '/more': 'Ещё',
  '/more/specialists': 'Специалисты',
  '/more/medications': 'Препараты',
  '/more/vaccinations': 'Прививки',
  '/more/growth': 'Рост и вес',
  '/more/labs': 'Анализы',
  '/more/reminders': 'Напоминания',
  '/more/ai-chat': 'AI чат',
  '/more/search': 'Поиск',
  '/more/history': 'История изменений',
  '/graph': 'Карта здоровья',
};

function getTitleForPath(pathname: string): string {
  // Сначала ищем точное совпадение (длинные пути приоритетнее)
  const sorted = Object.entries(TITLES).sort((a, b) => b[0].length - a[0].length);
  for (const [route, title] of sorted) {
    if (pathname === route || pathname.startsWith(`${route}/`)) return title;
  }
  return 'Здоровье';
}

export function Header() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const title = getTitleForPath(location.pathname);

  if (isDesktop) {
    return (
      <header className="ds-header">
        <h1 className="ds-header-title">{title}</h1>
      </header>
    );
  }

  return (
    <header className="header" id="header">
      <div
        className="header-content"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div>
          <h1 className="header-title">{title}</h1>
          <p className="header-subtitle" />
        </div>
        <PatientSwitcher />
      </div>
    </header>
  );
}
