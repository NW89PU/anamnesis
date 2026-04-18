import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IconChevronDown } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';

/**
 * Collapsible секция с анимацией. Используется на Dashboard для сворачивания
 * диагнозов, препаратов, AI-сводки.
 *
 * Если передан `persistKey` — состояние сохраняется в localStorage между сессиями.
 *
 * Пример:
 * ```tsx
 * <Collapsible
 *   title="Диагнозы"
 *   badge={<Badge color="purple">{diagnoses.length}</Badge>}
 *   persistKey="dashboard-diagnoses"
 *   defaultOpen={false}
 * >
 *   <DiagnosesList />
 * </Collapsible>
 * ```
 */

interface CollapsibleProps {
  title: string;
  badge?: ReactNode;
  /** Иконка слева от заголовка. React-node (например Tabler Icon). */
  icon?: ReactNode;
  children: ReactNode;
  /** Начальное состояние (игнорируется если задан `persistKey` и есть сохранённое значение) */
  defaultOpen?: boolean;
  /** Ключ для сохранения состояния в localStorage */
  persistKey?: string;
}

export function Collapsible({
  title,
  badge,
  icon,
  children,
  defaultOpen = false,
  persistKey,
}: CollapsibleProps) {
  // Два варианта стейта: с персистом и без.
  // Хуки нельзя вызывать условно — объявляем оба, но используем только нужный.
  const [persistedOpen, setPersistedOpen] = useLocalStorage(
    persistKey ?? '__collapsible_unused__',
    defaultOpen
  );
  const [localOpen, setLocalOpen] = useState(defaultOpen);

  const open = persistKey ? persistedOpen : localOpen;
  const setOpen = persistKey ? setPersistedOpen : setLocalOpen;

  return (
    <div className="collapsible">
      <button
        type="button"
        className="collapsible-header"
        onClick={() => {
          haptic('light');
          setOpen(!open);
        }}
        aria-expanded={open}
      >
        <div className="collapsible-title">
          {icon}
          <span>{title}</span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <IconChevronDown size={20} color="var(--text-secondary)" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="collapsible-content">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
