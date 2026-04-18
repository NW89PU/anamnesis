import clsx from 'clsx';

/**
 * Skeleton-плейсхолдер для загрузки. Применяет `.skeleton` из app.css
 * (уже содержит shimmer-анимацию).
 *
 * Использование:
 * ```tsx
 * {isLoading ? <Skeleton height={80} /> : <RealContent />}
 * ```
 *
 * При включённом persist-кэше React Query skeleton виден только при самом первом
 * открытии — дальше данные достаются из localStorage мгновенно.
 */

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  rounded?: boolean;
  className?: string;
}

export function Skeleton({ height = 80, width = '100%', rounded = true, className }: SkeletonProps) {
  return (
    <div
      className={clsx('skeleton', className)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        borderRadius: rounded ? 'var(--radius)' : undefined,
      }}
    />
  );
}

export function SkeletonList({ count = 3, height = 80 }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </>
  );
}
