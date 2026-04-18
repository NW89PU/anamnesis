import { Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { SwipeableTabs } from './SwipeableTabs';
import { Sidebar } from './Sidebar';
import { useIsDesktop } from '@/shared/hooks/useMediaQuery';

/**
 * Корневой layout приложения. Две раскладки через useIsDesktop (≥ 1024px):
 *
 * МОБИЛЬНАЯ (< 1024px):
 *   - Header сверху
 *   - Main со SwipeableTabs + page transition
 *   - TabBar снизу (5 основных вкладок)
 *   - Остальное — в разделе "Ещё"
 *
 * ДЕСКТОПНАЯ (≥ 1024px):
 *   - Sidebar слева (все разделы сразу, без "Ещё")
 *   - Main справа с Header + content
 *   - Нет TabBar
 *   - Нет swipe между вкладками (navigation через sidebar)
 *
 * Вся логика через один AppShell — никакого дублирования кода.
 */
export function AppShell() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const tabKey = location.pathname.split('/')[1] ?? 'dashboard';

  // Флаг мгновенного перехода — ставится в `location.state.instant` при
  // клике по табу (TabBar) или навигации через sidebar. При свайпе между
  // вкладками SwipeableTabs делает обычный navigate без state → анимация.
  const instant = (location.state as { instant?: boolean } | null)?.instant === true;

  const transitionContent = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        initial={instant ? false : { opacity: 0, x: isDesktop ? 0 : 20, y: isDesktop ? 8 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={instant ? { opacity: 1 } : { opacity: 0, x: isDesktop ? 0 : -20, y: isDesktop ? -4 : 0 }}
        transition={instant ? { duration: 0 } : { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );

  if (isDesktop) {
    return (
      <div className="ds-app">
        <Sidebar />
        <main className="ds-main">
          <Header />
          <div className="ds-main-content">{transitionContent}</div>
        </main>
      </div>
    );
  }

  // Мобильная раскладка — как было
  return (
    <>
      <Header />
      <main id="app" className="app-main">
        <SwipeableTabs>{transitionContent}</SwipeableTabs>
      </main>
      <TabBar />
    </>
  );
}
