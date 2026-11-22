/**
 * Полотно редактора.
 *
 * Рендер іде через requestAnimationFrame і читає стан напряму зі стора
 * (useEditor.getState()), тому рух миші чи малювання НЕ викликають
 * ре-рендер React-компонента — лише перемальовування canvas.
 *
 * Жести:
 *   ЛКМ — основний колір, ПКМ — додатковий, Alt — тимчасова піпетка,
 *   середня кнопка / Пробіл / «Рука» — панорама, колесо — масштаб,
 *   два пальці — щипок (масштаб + зсув) на тач-екранах.
 */

import { Maximize, Minus, Plus } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from 'react';
import { hexToPacked, packedToHex } from '../../shared/lib/color';
import { floodFill, replaceColor } from '../../shared/lib/floodFill';
import {
  constrainAngle,
  constrainSquare,
  ellipsePoints,
  linePoints,
  type Point,
  rectPoints,
} from '../../shared/lib/geometry';
import { paintRGBA } from '../../shared/lib/image';
import { clamp } from '../../shared/lib/misc';
import { useT } from '../../shared/i18n';
import { IconButton } from '../../shared/ui/controls';
import { compositeFrame, getCel, pickColor } from './model';
import { type Tool, useCursor, useEditor } from './store';

export const ZOOM_LEVELS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80];
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

export function nextZoom(zoom: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_LEVELS.find((z) => z > zoom + 0.01) ?? MAX_ZOOM;
  return [...ZOOM_LEVELS].reverse().find((z) => z < zoom - 0.01) ?? MIN_ZOOM;
}

/** Змінює масштаб так, щоб точка під курсором лишалась на місці. */
export function zoomAt(newZoom: number, cx: number, cy: number) {
  const { zoom, pan, setView } = useEditor.getState();
  const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
  const docX = (cx - pan.x) / zoom;
  const docY = (cy - pan.y) / zoom;
  setView(z, { x: Math.round(cx - docX * z), y: Math.round(cy - docY * z) });
}

/**
 * «Пульт» полотна для зовнішніх кнопок і гарячих клавіш (+, −, 0):
 * PixelCanvas підставляє сюди реальні функції, коли змонтований.
 */
export const canvasControls = {
  fit: () => {},
  zoomBy: (_direction: 1 | -1) => {},
};

interface ThemeColors {
  checkerA: string;
  checkerB: string;
  grid: string;
  gridMajor: string;
  border: string;
}

function readThemeColors(): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim().split(/\s+/).join(',');
  return {
    checkerA: `rgb(${v('--checker-a')})`,
    checkerB: `rgb(${v('--checker-b')})`,
    grid: `rgba(${v('--ink')},0.14)`,
    gridMajor: `rgba(${v('--ink')},0.3)`,
    border: `rgba(${v('--ink')},0.45)`,
  };
}

type Gesture =
  | { kind: 'freehand'; color: number; last: Point; work: number[] }
  | { kind: 'shape'; tool: Tool; color: number; start: Point; base: number[] }
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | { kind: 'pinch'; dist: number; zoom: number; mid: Point; pan: { x: number; y: number } };

const DRAW_TOOLS: Tool[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse'];

export function PixelCanvas() {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, fitted: false });
  const hover = useRef<Point | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const raf = useRef(0);
  const colors = useRef<ThemeColors | null>(null);
  const layerCanvas = useRef<HTMLCanvasElement | null>(null);
  const onionCanvas = useRef<HTMLCanvasElement | null>(null);
  const checker = useRef<{ pattern: CanvasPattern; key: string } | null>(null);

  // ---------- Рендер ----------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const { w, h } = size.current;
    if (!canvas || w === 0 || h === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    colors.current ??= readThemeColors();
    layerCanvas.current ??= document.createElement('canvas');
    onionCanvas.current ??= document.createElement('canvas');
    const theme = colors.current;
    const s = useEditor.getState();
    const { doc, zoom, pan, frameIndex } = s;
    const dw = doc.width * zoom;
    const dh = doc.height * zoom;
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    // Шахова підкладка, що показує прозорість
    const key = theme.checkerA + theme.checkerB;
    if (!checker.current || checker.current.key !== key) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 16;
      const tctx = tile.getContext('2d')!;
      tctx.fillStyle = theme.checkerA;
      tctx.fillRect(0, 0, 16, 16);
      tctx.fillStyle = theme.checkerB;
      tctx.fillRect(0, 0, 8, 8);
      tctx.fillRect(8, 8, 8, 8);
      checker.current = { pattern: ctx.createPattern(tile, 'repeat')!, key };
    }
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.fillStyle = checker.current.pattern;
    ctx.fillRect(0, 0, dw, dh);
    ctx.restore();

    // «Калька» попереднього кадру
    if (s.onionSkin && doc.frames.length > 1) {
      const prev = (frameIndex - 1 + doc.frames.length) % doc.frames.length;
      paintRGBA(onionCanvas.current, compositeFrame(doc, prev), doc.width, doc.height);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(onionCanvas.current, pan.x, pan.y, dw, dh);
      ctx.globalAlpha = 1;
    }

    paintRGBA(layerCanvas.current, compositeFrame(doc, frameIndex), doc.width, doc.height);
    ctx.drawImage(layerCanvas.current, pan.x, pan.y, dw, dh);

    // Сітка: тонка — кожен піксель, товща — кожні 8
    if (s.showGrid && zoom >= 6) {
      for (const major of [false, true]) {
        ctx.beginPath();
        for (let x = 1; x < doc.width; x++) {
          if ((x % 8 === 0) !== major) continue;
          const X = Math.round(pan.x + x * zoom) + 0.5;
          ctx.moveTo(X, pan.y);
          ctx.lineTo(X, pan.y + dh);
        }
        for (let y = 1; y < doc.height; y++) {
          if ((y % 8 === 0) !== major) continue;
          const Y = Math.round(pan.y + y * zoom) + 0.5;
          ctx.moveTo(pan.x, Y);
          ctx.lineTo(pan.x + dw, Y);
        }
        ctx.strokeStyle = major ? theme.gridMajor : theme.grid;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(pan.x) - 0.5, Math.round(pan.y) - 0.5, dw + 1, dh + 1);

    // Контур пензля під курсором
    const cursor = hover.current;
    if (cursor && gesture.current?.kind !== 'pan' && !s.spaceDown && s.tool !== 'hand') {
      const brush = s.tool === 'pencil' || s.tool === 'eraser' ? s.brushSize : 1;
      const off = Math.floor((brush - 1) / 2);
      const boxes: Point[] = [[cursor[0] - off, cursor[1] - off]];
      if (s.mirrorX && DRAW_TOOLS.includes(s.tool)) boxes.push([doc.width - cursor[0] - (brush - off), cursor[1] - off]);
      for (const [bx, by] of boxes) {
        const x = pan.x + bx * zoom;
        const y = pan.y + by * zoom;
        const side = brush * zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeRect(x - 0.5, y - 0.5, side + 1, side + 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeRect(x + 0.5, y + 0.5, side - 1, side - 1);
      }
    }

    // Курсор миші
    const g = gesture.current;
    canvas.style.cursor =
      g?.kind === 'pan'
        ? 'grabbing'
        : s.tool === 'hand' || s.spaceDown
          ? 'grab'
          : 'crosshair';
  }, []);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, [draw]);

  const fit = useCallback(() => {
    const { w, h } = size.current;
    if (w === 0) return;
    const { doc, setView } = useEditor.getState();
    const padding = w < 640 ? 24 : 64;
    const z = clamp(
      Math.floor(Math.min((w - padding) / doc.width, (h - padding) / doc.height)),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    setView(z, {
      x: Math.round((w - doc.width * z) / 2),
      y: Math.round((h - doc.height * z) / 2),
    });
  }, []);

  // Розмір полотна стежить за контейнером
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      size.current.w = width;
      size.current.h = height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (!size.current.fitted && width > 0) {
        size.current.fitted = true;
        fit();
      }
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw, fit]);

  // Перемальовуємо при будь-якій зміні стора; вписуємо полотно при новому документі
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (
          s.viewNonce !== prev.viewNonce ||
          s.doc.width !== prev.doc.width ||
          s.doc.height !== prev.doc.height
        ) {
          fit();
        }
        schedule();
      }),
    [fit, schedule],
  );

  // Зміна теми → перечитати CSS-змінні
  useEffect(() => {
    const observer = new MutationObserver(() => {
      colors.current = readThemeColors();
      schedule();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [schedule]);

  // Колесо миші — масштаб (passive: false, щоб заборонити прокрутку сторінки)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const { zoom } = useEditor.getState();
      const target = e.ctrlKey
        ? zoom * Math.exp(-e.deltaY * 0.01) // щипок на тачпаді
        : nextZoom(zoom, e.deltaY < 0 ? 1 : -1);
      zoomAt(target, e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    canvasControls.fit = fit;
    canvasControls.zoomBy = (direction) => {
      const { zoom } = useEditor.getState();
      zoomAt(nextZoom(zoom, direction), size.current.w / 2, size.current.h / 2);
    };
    return () => {
      cancelAnimationFrame(raf.current);
      canvasControls.fit = () => {};
      canvasControls.zoomBy = () => {};
    };
  }, [fit]);

  // ---------- Малювання ----------

  const toDoc = (clientX: number, clientY: number): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { zoom, pan } = useEditor.getState();
    return [Math.floor((clientX - rect.left - pan.x) / zoom), Math.floor((clientY - rect.top - pan.y) / zoom)];
  };

  const inBounds = ([x, y]: Point) => {
    const { doc } = useEditor.getState();
    return x >= 0 && y >= 0 && x < doc.width && y < doc.height;
  };

  /** Ставить «відбиток» пензля (з урахуванням розміру та дзеркала) у робочий масив. */
  const stamp = (work: number[], x: number, y: number, color: number, brush: number) => {
    const { doc, mirrorX } = useEditor.getState();
    const off = Math.floor((brush - 1) / 2);
    for (let dy = 0; dy < brush; dy++) {
      for (let dx = 0; dx < brush; dx++) {
        const px = x - off + dx;
        const py = y - off + dy;
        if (px < 0 || py < 0 || px >= doc.width || py >= doc.height) continue;
        work[py * doc.width + px] = color;
        if (mirrorX) work[py * doc.width + (doc.width - 1 - px)] = color;
      }
    }
  };

  const applyShape = (g: Extract<Gesture, { kind: 'shape' }>, end: Point, constrain: boolean) => {
    const s = useEditor.getState();
    const [x0, y0] = g.start;
    let [x1, y1] = end;
    if (constrain) [x1, y1] = g.tool === 'line' ? constrainAngle(x0, y0, x1, y1) : constrainSquare(x0, y0, x1, y1);
    const points =
      g.tool === 'line'
        ? linePoints(x0, y0, x1, y1)
        : g.tool === 'rect'
          ? rectPoints(x0, y0, x1, y1, s.shapeFilled)
          : ellipsePoints(x0, y0, x1, y1, s.shapeFilled);
    const work = g.base.slice();
    const brush = g.tool === 'line' ? s.brushSize : 1;
    for (const [px, py] of points) stamp(work, px, py, g.color, brush);
    s.setCel(work);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const s = useEditor.getState();

    // Другий палець — переходимо в режим щипка, скасовуючи почате малювання
    if (pointers.current.size === 2) {
      if (gesture.current?.kind === 'freehand' || gesture.current?.kind === 'shape') s.cancelStroke();
      const [a, b] = [...pointers.current.values()];
      const rect = canvas.getBoundingClientRect();
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
        zoom: s.zoom,
        mid: [(a[0] + b[0]) / 2 - rect.left, (a[1] + b[1]) / 2 - rect.top],
        pan: s.pan,
      };
      return;
    }
    if (pointers.current.size > 2) return;

    if (e.button === 1 || s.tool === 'hand' || s.spaceDown) {
      e.preventDefault();
      gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, panX: s.pan.x, panY: s.pan.y };
      schedule();
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    if (s.playing) s.setPlaying(false);

    const point = toDoc(e.clientX, e.clientY);
    const secondary = e.button === 2;
    const tool: Tool = e.altKey && DRAW_TOOLS.includes(s.tool) ? 'picker' : s.tool;
    const hex = secondary ? s.secondary : s.primary;
    const color = tool === 'eraser' ? 0 : hexToPacked(hex);
    if (tool !== 'eraser' && tool !== 'picker') s.rememberColor(hex);

    if (tool === 'picker') {
      if (!inBounds(point)) return;
      const picked = pickColor(s.doc, s.frameIndex, point[0], point[1]);
      if (picked !== null) (secondary ? s.setSecondary : s.setPrimary)(packedToHex(picked));
      return;
    }

    if (tool === 'fill') {
      if (!inBounds(point)) return;
      const cel = getCel(s.doc, s.frameIndex, s.layerId);
      const [x, y] = point;
      const result = e.shiftKey
        ? replaceColor(cel, cel[y * s.doc.width + x], color)
        : floodFill(cel, s.doc.width, s.doc.height, x, y, color);
      if (result) {
        s.beginStroke();
        s.setCel(result);
        s.endStroke();
      }
      return;
    }

    s.beginStroke();
    const base = getCel(s.doc, s.frameIndex, s.layerId);

    if (tool === 'pencil' || tool === 'eraser') {
      const work = base.slice();
      stamp(work, point[0], point[1], color, s.brushSize);
      s.setCel(work.slice());
      gesture.current = { kind: 'freehand', color, last: point, work };
    } else {
      const g: Gesture = { kind: 'shape', tool, color, start: point, base };
      gesture.current = g;
      applyShape(g, point, e.shiftKey);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const point = toDoc(e.clientX, e.clientY);
    const visible = inBounds(point) ? point : null;
    if (visible?.[0] !== hover.current?.[0] || visible?.[1] !== hover.current?.[1]) {
      hover.current = visible;
      useCursor.setState({ pos: visible ? { x: visible[0], y: visible[1] } : null });
      schedule();
    }

    const g = gesture.current;
    if (!g) return;
    const s = useEditor.getState();

    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = canvasRef.current!.getBoundingClientRect();
      const mid: Point = [(a[0] + b[0]) / 2 - rect.left, (a[1] + b[1]) / 2 - rect.top];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const zoom = clamp((g.zoom * dist) / Math.max(1, g.dist), MIN_ZOOM, MAX_ZOOM);
      const docX = (g.mid[0] - g.pan.x) / g.zoom;
      const docY = (g.mid[1] - g.pan.y) / g.zoom;
      s.setView(zoom, { x: mid[0] - docX * zoom, y: mid[1] - docY * zoom });
    } else if (g.kind === 'pan') {
      s.setView(s.zoom, { x: g.panX + e.clientX - g.startX, y: g.panY + e.clientY - g.startY });
    } else if (g.kind === 'freehand') {
      if (point[0] === g.last[0] && point[1] === g.last[1]) return;
      for (const [x, y] of linePoints(g.last[0], g.last[1], point[0], point[1])) {
        stamp(g.work, x, y, g.color, s.brushSize);
      }
      g.last = point;
      s.setCel(g.work.slice());
    } else if (g.kind === 'shape') {
      applyShape(g, point, e.shiftKey);
    }
  };

  const finish = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    if (g.kind === 'freehand' || g.kind === 'shape') useEditor.getState().endStroke();
    gesture.current = null;
    schedule();
  };

  const onPointerLeave = () => {
    if (gesture.current) return;
    hover.current = null;
    useCursor.setState({ pos: null });
    schedule();
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-surface-2/60">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        role="img"
        aria-label={t('editor.canvasLabel')}
      />
      <CanvasOverlay />
    </div>
  );
}

function CanvasOverlay() {
  const t = useT();
  const zoom = useEditor((s) => s.zoom);
  const width = useEditor((s) => s.doc.width);
  const height = useEditor((s) => s.doc.height);
  const pos = useCursor((s) => s.pos);

  return (
    <>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-px bg-surface/90 px-2 py-1 text-xs tabular-nums text-muted shadow-sm">
        {width}×{height}
        {pos && (
          <span className="ml-2 text-ink">
            {pos.x}, {pos.y}
          </span>
        )}
      </div>
      <div className="absolute bottom-3 right-3 flex items-center rounded-px border border-line bg-surface/95 shadow-sm">
        <IconButton
          icon={Minus}
          label={t('editor.zoomOut')}
          shortcut="−"
          onClick={() => canvasControls.zoomBy(-1)}
          tooltipSide="top"
          size={16}
        />
        <span className="w-12 text-center text-xs tabular-nums">{Number(zoom.toFixed(1))}×</span>
        <IconButton
          icon={Plus}
          label={t('editor.zoomIn')}
          shortcut="+"
          onClick={() => canvasControls.zoomBy(1)}
          tooltipSide="top"
          size={16}
        />
        <IconButton
          icon={Maximize}
          label={t('editor.fit')}
          shortcut="0"
          onClick={() => canvasControls.fit()}
          tooltipSide="top"
          size={16}
        />
      </div>
    </>
  );
}
