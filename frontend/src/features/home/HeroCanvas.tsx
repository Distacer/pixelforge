/**
 * Жива міні-сітка на головній: спрайт «малюється» піксель за пікселем,
 * після чого відвідувач може домалювати його сам і відкрити в редакторі.
 */

import { Eraser, PenTool, RotateCcw } from 'lucide-react';
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../shared/i18n';
import { hexToPacked } from '../../shared/lib/color';
import { linePoints } from '../../shared/lib/geometry';
import { cn } from '../../shared/lib/misc';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { PixelImage } from '../../shared/ui/PixelImage';
import { compositeFrame, docFromPixels } from '../editor/model';
import { useEditor } from '../editor/store';
import { POTION_SPRITE, spriteToPixels } from './sprites';

const SIZE = 16;
const SWATCHES = ['#1a1c2c', '#b13e53', '#ef7d57', '#ffcd75', '#38b764', '#41a6f6', '#f4f4f4'];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HeroCanvas() {
  const t = useT();
  const navigate = useNavigate();
  const target = useMemo(() => spriteToPixels(POTION_SPRITE), []);
  const [pixels, setPixels] = useState<number[]>(() =>
    prefersReducedMotion() ? target : new Array(SIZE * SIZE).fill(0),
  );
  const [color, setColor] = useState<string | null>(SWATCHES[4]);
  const [confirm, setConfirm] = useState(false);
  const last = useRef<[number, number] | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  // Одна-єдина анімація сторінки: спрайт з'являється рядок за рядком
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const order = target
      .map((c, i) => ({ i, c, key: Math.floor(i / SIZE) * 3 + Math.random() * 4 }))
      .filter((p) => p.c !== 0)
      .sort((a, b) => a.key - b.key);
    let n = 0;
    const timer = setInterval(() => {
      const batch = order.slice(n, n + 4);
      n += 4;
      setPixels((prev) => {
        const next = prev.slice();
        for (const p of batch) next[p.i] = p.c;
        return next;
      });
      if (n >= order.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [target]);

  const rgba = useMemo(() => compositeFrame(docFromPixels(SIZE, SIZE, pixels), 0), [pixels]);

  const cellAt = (e: PointerEvent): [number, number] | null => {
    const rect = surface.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
  };

  const paint = (from: [number, number], to: [number, number]) => {
    const value = color ? hexToPacked(color) : 0;
    setPixels((prev) => {
      const next = prev.slice();
      for (const [x, y] of linePoints(from[0], from[1], to[0], to[1])) next[y * SIZE + x] = value;
      return next;
    });
  };

  const openInEditor = () => {
    useEditor.getState().loadDocument({
      doc: docFromPixels(SIZE, SIZE, pixels, t('layers.defaultName', { n: 1 })),
      meta: { id: null, title: t('home.spriteTitle'), dirty: true },
    });
    navigate('/editor');
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={surface}
        className="checker relative aspect-square w-full max-w-[22rem] touch-none select-none overflow-hidden rounded-px border-2 border-[rgb(var(--shadow))] shadow-pixel"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const cell = cellAt(e);
          if (!cell) return;
          last.current = cell;
          paint(cell, cell);
        }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const cell = cellAt(e);
          if (!cell) return;
          paint(last.current, cell);
          last.current = cell;
        }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
        role="img"
        aria-label={t('home.canvasLabel')}
      >
        <PixelImage rgba={rgba} width={SIZE} height={SIZE} className="absolute inset-0 h-full w-full" />
        {/* Сітка поверх пікселів: дві повторювані лінії CSS-градієнтом */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(var(--ink)) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--ink)) 1px, transparent 1px)',
            backgroundSize: `${100 / SIZE}% ${100 / SIZE}%`,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label={t('editor.palette')}>
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            role="radio"
            aria-checked={color === swatch}
            aria-label={swatch}
            onClick={() => setColor(swatch)}
            className={cn(
              'h-7 w-7 rounded-[2px] border-2 transition-transform',
              color === swatch ? '-translate-y-1 border-[rgb(var(--shadow))] shadow-pixel-sm' : 'border-line',
            )}
            style={{ background: swatch }}
          />
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={color === null}
          onClick={() => setColor(null)}
          className={cn('icon-btn h-7 w-7', color === null && 'bg-surface-2 ring-2 ring-accent')}
          aria-label={t('tool.eraser')}
          title={t('tool.eraser')}
        >
          <Eraser size={15} />
        </button>
        <button
          type="button"
          onClick={() => setPixels(target)}
          className="icon-btn h-7 w-7"
          aria-label={t('home.reset')}
          title={t('home.reset')}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => (useEditor.getState().meta.dirty ? setConfirm(true) : openInEditor())}
      >
        <PenTool size={16} />
        {t('home.continueInEditor')}
      </button>

      <ConfirmDialog
        open={confirm}
        title={t('editor.discardTitle')}
        message={t('editor.discardMessage')}
        confirmLabel={t('editor.discardConfirm')}
        danger
        onConfirm={() => {
          setConfirm(false);
          openInEditor();
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
