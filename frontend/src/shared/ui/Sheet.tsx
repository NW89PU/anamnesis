import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMotionValue, animate } from 'motion/react';
import { IconX } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { useIsDesktop } from '@/shared/hooks/useMediaQuery';

/**
 * Sheet — bottom-sheet модалка с drag-to-close.
 *
 * АРХИТЕКТУРА:
 *
 * Я отказался от `motion.div + style={{y}}` с useMotionValue, потому что
 * эта магия Motion не всегда обновляет DOM (проблемы с StrictMode cleanup,
 * subscription timing). Вместо этого:
 *
 * 1. `useMotionValue(y)` — только как state store
 * 2. `animate(y, target, config)` — утилита, обновляет мотион-значение
 * 3. `y.on('change', fn)` — subscription на изменения
 * 4. В subscription fn ИМПЕРАТИВНО обновляем DOM через ref:
 *    `sheetEl.style.transform = translate3d(0, v, 0)`
 *    `overlayEl.style.opacity = 1 - v/h`
 *
 * Это 100% детерминировано — никаких промежуточных слоёв.
 *
 * Initial transform устанавливается через ref callback — синхронно в момент
 * присоединения элемента к DOM, до первой отрисовки.
 *
 * Drag:
 * - Handle (полоска) — всегда drag
 * - Scroll body — scroll-aware: drag только если scrollTop===0 и dy>5 вниз
 * - Velocity tracking: последние pointer события для расчёта px/s
 * - Close threshold: **25% высоты sheet** ИЛИ **velocity > 600 px/s**
 */

const DRAG_START_THRESHOLD = 5;
const CLOSE_PERCENT = 0.25;
const VELOCITY_CLOSE = 600;
// Spring для enter и snap-back (драматичнее, с небольшим overshoot)
const SPRING_CONFIG = { type: 'spring' as const, damping: 30, stiffness: 300 };
// Spring для exit — жёстче, чтобы быстро уйти без bounce, но с плавной кривой
// (передача velocity из drag делает переход незаметным)
const EXIT_SPRING = { type: 'spring' as const, damping: 40, stiffness: 400 } as const;

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string | undefined;
  children: ReactNode;
  footer?: ReactNode;
  disableSwipeClose?: boolean;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  disableSwipeClose = false,
}: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const isDesktop = useIsDesktop();

  // Initial — innerHeight, чтобы sheet был за экраном до enter-анимации.
  // На десктопе мы используем тот же y, но интерпретируем его как progress 0..1:
  // 0 = открыт (scale 1, opacity 1), viewportHeight = закрыт (scale 0.95, opacity 0).
  // Это позволяет использовать те же subscription / animate calls без дублирования.
  const y = useMotionValue(typeof window !== 'undefined' ? window.innerHeight : 0);

  const sheetElRef = useRef<HTMLDivElement | null>(null);
  const overlayElRef = useRef<HTMLDivElement | null>(null);
  const handleElRef = useRef<HTMLDivElement | null>(null);
  const scrollElRef = useRef<HTMLDivElement | null>(null);

  // Скорость drag на момент release — передаётся в exit-анимацию для
  // непрерывного перехода от ручного drag к spring-closure.
  const exitVelocityRef = useRef(0);
  // Guard для .then() колбэка exit-анимации: если пока анимация идёт,
  // пользователь заново открыл модалку — мы не должны unmount-ить.
  const isClosingRef = useRef(false);

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  /** Императивно применить текущее значение y к DOM (transform + opacity).
   *  На мобиле — translateY(y).
   *  На десктопе — fade+scale через progress (y/viewportHeight).
   */
  const applyToDom = useCallback(
    (v: number) => {
      const sheetEl = sheetElRef.current;
      const overlayEl = overlayElRef.current;
      const progress = Math.max(0, Math.min(1, v / viewportHeight)); // 0 = open, 1 = closed

      if (sheetEl) {
        if (isDesktop) {
          // Scale 1 → 0.95, translateY 0 → 12px
          const scale = 1 - progress * 0.05;
          const ty = progress * 12;
          sheetEl.style.transform = `translate3d(0, ${ty}px, 0) scale(${scale})`;
          sheetEl.style.opacity = String(1 - progress);
        } else {
          sheetEl.style.transform = `translate3d(0, ${v}px, 0)`;
        }
      }
      if (overlayEl) {
        const op = Math.max(0, Math.min(1, 1 - progress));
        overlayEl.style.opacity = String(op);
      }
    },
    [viewportHeight, isDesktop]
  );

  /**
   * Ref callback для sheet — применяет initial transform СИНХРОННО при
   * mount элемента в DOM, до первой отрисовки. Это убирает flash,
   * который был бы при useLayoutEffect.
   */
  const setSheetRef = useCallback(
    (el: HTMLDivElement | null) => {
      sheetElRef.current = el;
      if (el) {
        // Применяем полный расчёт (включая scale на десктопе)
        const v = y.get();
        const progress = Math.max(0, Math.min(1, v / viewportHeight));
        if (isDesktop) {
          const scale = 1 - progress * 0.05;
          const ty = progress * 12;
          el.style.transform = `translate3d(0, ${ty}px, 0) scale(${scale})`;
          el.style.opacity = String(1 - progress);
        } else {
          el.style.transform = `translate3d(0, ${v}px, 0)`;
        }
      }
    },
    [y, viewportHeight, isDesktop]
  );

  const setOverlayRef = useCallback(
    (el: HTMLDivElement | null) => {
      overlayElRef.current = el;
      if (el) {
        const v = y.get();
        const op = Math.max(0, Math.min(1, 1 - v / viewportHeight));
        el.style.opacity = String(op);
      }
    },
    [y, viewportHeight]
  );

  // === Mount transition: open → mounted ===
  useEffect(() => {
    if (open && !mounted) {
      setMounted(true);
    }
  }, [open, mounted]);

  // === Подписка на изменения motion value → DOM update ===
  useEffect(() => {
    if (!mounted) return;
    // Применяем текущее значение сразу (на случай если подписка пропустит)
    applyToDom(y.get());
    const unsubscribe = y.on('change', applyToDom);
    return unsubscribe;
  }, [mounted, y, applyToDom]);

  // === Enter animation ===
  useEffect(() => {
    if (!mounted || !open) return;
    const controls = animate(y, 0, SPRING_CONFIG);
    return () => {
      controls.stop();
    };
  }, [mounted, open, y]);

  // === Exit animation → setMounted(false) ===
  // Spring с передачей velocity из drag (если user закрыл свайпом).
  // Для закрытия через overlay/X/escape velocity=0 — просто spring.
  useEffect(() => {
    if (!mounted || open) return;
    isClosingRef.current = true;
    const startVelocity = exitVelocityRef.current;
    exitVelocityRef.current = 0; // сброс после использования

    const controls = animate(y, viewportHeight, {
      ...EXIT_SPRING,
      // velocity передаётся в px/s, что делает переход от drag
      // к анимации бесшовным — spring продолжает движение с той же скоростью
      velocity: startVelocity,
    });

    // Пытаемся поймать конец анимации через promise
    let cancelled = false;
    controls.then(
      () => {
        if (!cancelled && isClosingRef.current) {
          setMounted(false);
          isClosingRef.current = false;
        }
      },
      () => {
        // rejected (cancelled) — ничего не делаем, cleanup сбросит ref
      }
    );

    // Fallback таймер на случай если .then() не сработает
    const fallbackTimer = setTimeout(() => {
      if (!cancelled && isClosingRef.current) {
        setMounted(false);
        isClosingRef.current = false;
      }
    }, 700);

    return () => {
      cancelled = true;
      controls.stop();
      clearTimeout(fallbackTimer);
      isClosingRef.current = false;
    };
  }, [mounted, open, y, viewportHeight]);

  // === Body scroll lock ===
  useEffect(() => {
    if (!mounted) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [mounted]);

  // === Escape ===
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        haptic('light');
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  // === Handle drag (мобилка) ===
  useEffect(() => {
    if (!mounted || disableSwipeClose || isDesktop) return;
    const handleEl = handleElRef.current;
    const sheetEl = sheetElRef.current;
    if (!handleEl || !sheetEl) return;

    let startClientY = 0;
    let dragging = false;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;

    const onDown = (e: PointerEvent) => {
      startClientY = e.clientY - y.get();
      dragging = true;
      lastY = e.clientY;
      lastTime = performance.now();
      velocity = 0;
      try {
        handleEl.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const newY = Math.max(0, e.clientY - startClientY);
      y.set(newY);

      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0) {
        velocity = ((e.clientY - lastY) / dt) * 1000;
      }
      lastY = e.clientY;
      lastTime = now;
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        handleEl.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      const currentY = y.get();
      const sheetH = sheetEl.clientHeight || viewportHeight;
      const closeThreshold = sheetH * CLOSE_PERCENT;

      if (currentY > closeThreshold || velocity > VELOCITY_CLOSE) {
        haptic('medium');
        // Прокидываем velocity в exit-анимацию для бесшовного перехода
        exitVelocityRef.current = Math.max(velocity, 0);
        onClose();
      } else {
        animate(y, 0, SPRING_CONFIG);
      }
    };

    handleEl.addEventListener('pointerdown', onDown);
    handleEl.addEventListener('pointermove', onMove);
    handleEl.addEventListener('pointerup', onUp);
    handleEl.addEventListener('pointercancel', onUp);

    return () => {
      handleEl.removeEventListener('pointerdown', onDown);
      handleEl.removeEventListener('pointermove', onMove);
      handleEl.removeEventListener('pointerup', onUp);
      handleEl.removeEventListener('pointercancel', onUp);
    };
  }, [mounted, disableSwipeClose, onClose, y, viewportHeight, isDesktop]);

  // === Scroll-aware drag-anywhere (мобилка) ===
  // Паттерн "drag в любом месте модалки, но только когда контент в верху":
  // scrollTop проверяется ДИНАМИЧЕСКИ в pointermove (не статически в pointerdown).
  // Это ключевое отличие — теперь пользователь может в одном жесте скроллить
  // контент вверх и продолжить тянуть модалку, когда достиг верха.
  useEffect(() => {
    if (!mounted || disableSwipeClose || isDesktop) return;
    const scrollEl = scrollElRef.current;
    const sheetEl = sheetElRef.current;
    if (!scrollEl || !sheetEl) return;

    let startClientY = 0;
    let dragging = false;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;

    const onDown = (e: PointerEvent) => {
      startClientY = e.clientY;
      dragging = false;
      lastY = e.clientY;
      lastTime = performance.now();
      velocity = 0;
    };

    const onMove = (e: PointerEvent) => {
      // Если ещё не в режиме drag — смотрим можно ли его начать.
      // Условие: контент в самом верху (scrollTop === 0) И палец идёт вниз.
      if (!dragging) {
        const atTop = scrollEl.scrollTop <= 0;
        const dy = e.clientY - startClientY;
        if (atTop && dy > DRAG_START_THRESHOLD) {
          dragging = true;
          try {
            scrollEl.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          // Сбрасываем стартовую точку — так y sheet'а начинается от 0,
          // а не сразу с "DRAG_START_THRESHOLD пикселей офсет"
          startClientY = e.clientY;
          lastY = e.clientY;
          lastTime = performance.now();
        } else if (!atTop) {
          // Контент скроллится, сбрасываем startClientY чтобы следующий "up"
          // в случае достижения scrollTop=0 был корректен относительно
          // текущей позиции пальца
          startClientY = e.clientY;
        }
      }

      if (dragging) {
        e.preventDefault();
        const dragDy = e.clientY - startClientY;
        y.set(Math.max(0, dragDy));

        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 0) {
          velocity = ((e.clientY - lastY) / dt) * 1000;
        }
        lastY = e.clientY;
        lastTime = now;
      }
    };

    const onUp = (e: PointerEvent) => {
      if (dragging) {
        try {
          scrollEl.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }

        const currentY = y.get();
        const sheetH = sheetEl.clientHeight || viewportHeight;
        const closeThreshold = sheetH * CLOSE_PERCENT;

        if (currentY > closeThreshold || velocity > VELOCITY_CLOSE) {
          haptic('medium');
          exitVelocityRef.current = Math.max(velocity, 0);
          onClose();
        } else {
          animate(y, 0, SPRING_CONFIG);
        }
      }
      dragging = false;
    };

    scrollEl.addEventListener('pointerdown', onDown);
    scrollEl.addEventListener('pointermove', onMove);
    scrollEl.addEventListener('pointerup', onUp);
    scrollEl.addEventListener('pointercancel', onUp);

    return () => {
      scrollEl.removeEventListener('pointerdown', onDown);
      scrollEl.removeEventListener('pointermove', onMove);
      scrollEl.removeEventListener('pointerup', onUp);
      scrollEl.removeEventListener('pointercancel', onUp);
    };
  }, [mounted, disableSwipeClose, onClose, y, viewportHeight, isDesktop]);

  if (!mounted) return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      ref={setOverlayRef}
      className={`modal-overlay${isDesktop ? ' modal-overlay-desktop' : ''}`}
      onClick={() => {
        haptic('light');
        onClose();
      }}
    >
      <div
        ref={setSheetRef}
        className={`modal-sheet${isDesktop ? ' modal-sheet-desktop' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Диалог'}
      >
        {!isDesktop && (
          <div className="modal-handle-area" ref={handleElRef}>
            <div className="modal-handle" />
          </div>
        )}

        <div className="modal-scroll-body" ref={scrollElRef}>
          {title && (
            <div className="modal-header">
              <h2 className="modal-title">{title}</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Закрыть"
                onClick={(e) => {
                  e.stopPropagation();
                  haptic('light');
                  onClose();
                }}
              >
                <IconX size={20} />
              </button>
            </div>
          )}

          <div className="modal-body">{children}</div>

          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
