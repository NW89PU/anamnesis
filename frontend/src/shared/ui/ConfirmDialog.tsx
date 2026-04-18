import { useState, useCallback, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';

/**
 * Промис-based подтверждение. НЕ через роутинг — локальное состояние.
 *
 * Использование через хук:
 * ```tsx
 * const { confirm, dialog } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({
 *     title: 'Удалить визит?',
 *     message: 'Действие нельзя отменить',
 *     confirmText: 'Удалить',
 *     confirmVariant: 'danger',
 *   });
 *   if (ok) { await deleteVisit(); }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Удалить</Button>
 *     {dialog}
 *   </>
 * );
 * ```
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
}

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleResolve = useCallback(
    (value: boolean) => {
      if (pending) {
        pending.resolve(value);
        setPending(null);
      }
    },
    [pending]
  );

  const dialog: ReactNode = pending && (
    <Sheet
      open
      onClose={() => handleResolve(false)}
      title={pending.title ?? 'Подтверждение'}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" block onClick={() => handleResolve(false)}>
            {pending.cancelText ?? 'Отмена'}
          </Button>
          <Button
            variant={pending.confirmVariant ?? 'primary'}
            block
            onClick={() => handleResolve(true)}
          >
            {pending.confirmText ?? 'Подтвердить'}
          </Button>
        </div>
      }
    >
      <p style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.5 }}>{pending.message}</p>
    </Sheet>
  );

  return { confirm, dialog };
}
