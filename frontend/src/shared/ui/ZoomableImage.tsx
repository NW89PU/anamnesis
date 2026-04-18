import { useState } from 'react';
import { haptic } from '@/shared/lib/haptic';

/**
 * Картинка с toggle zoom 100% ↔ 250% по клику.
 * Порт из vanilla `documents.js` .doc-preview-img обработчика.
 */
interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ZoomableImage({ src, alt = '', className, style }: Props) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        haptic('light');
        setZoomed((v) => !v);
      }}
      style={{
        maxWidth: zoomed ? '250%' : '100%',
        cursor: zoomed ? 'zoom-out' : 'zoom-in',
        transition: 'max-width 0.2s ease',
        ...style,
      }}
    />
  );
}
