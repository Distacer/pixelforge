import { useEffect, useRef } from 'react';
import { paintRGBA } from '../lib/image';
import { cn } from '../lib/misc';

interface PixelImageProps {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  className?: string;
  label?: string;
}

/** Показує RGBA-буфер як чітке зображення (canvas у розмірі документа, масштаб — CSS). */
export function PixelImage({ rgba, width, height, className, label }: PixelImageProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paintRGBA(canvas, rgba, width, height);
  }, [rgba, width, height]);

  return (
    <canvas
      ref={ref}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('pixelated', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
