/**
 * Модель документа редактора (без React).
 *
 *  PixelDoc
 *   ├─ layers: LayerMeta[]        — спільні для всіх кадрів (як в Aseprite)
 *   └─ frames: Frame[]
 *        └─ cels[layerId]: number[] — пікселі шару в цьому кадрі (0xRRGGBBAA)
 *
 * Шари йдуть знизу догори: layers[0] — найнижчий.
 * Усі функції чисті: повертають нові об'єкти, нічого не мутують.
 */

import { unpack } from '../../shared/lib/color';
import { uid } from '../../shared/lib/misc';
import { decodeRLE, encodeRLE } from '../../shared/lib/rle';

export interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
}

export interface Frame {
  id: string;
  cels: Record<string, number[]>;
}

export interface PixelDoc {
  width: number;
  height: number;
  fps: number;
  layers: LayerMeta[];
  frames: Frame[];
}

export const MAX_SIZE = 128;
export const MAX_FRAMES = 120;
export const MAX_LAYERS = 16;

export function emptyPixels(width: number, height: number): number[] {
  return new Array<number>(width * height).fill(0);
}

export function createLayer(name: string): LayerMeta {
  return { id: uid('layer'), name, visible: true, opacity: 1 };
}

export function createDoc(width: number, height: number, layerName = 'Layer 1'): PixelDoc {
  const layer = createLayer(layerName);
  return {
    width,
    height,
    fps: 8,
    layers: [layer],
    frames: [{ id: uid('frame'), cels: { [layer.id]: emptyPixels(width, height) } }],
  };
}

export function docFromPixels(width: number, height: number, pixels: number[], layerName = 'Layer 1') {
  const doc = createDoc(width, height, layerName);
  doc.frames[0].cels[doc.layers[0].id] = pixels;
  return doc;
}

export function getCel(doc: PixelDoc, frameIndex: number, layerId: string): number[] {
  return doc.frames[frameIndex]?.cels[layerId] ?? emptyPixels(doc.width, doc.height);
}

export function withCel(doc: PixelDoc, frameIndex: number, layerId: string, pixels: number[]): PixelDoc {
  const frames = doc.frames.map((frame, i) =>
    i === frameIndex ? { ...frame, cels: { ...frame.cels, [layerId]: pixels } } : frame,
  );
  return { ...doc, frames };
}

/**
 * Зводить видимі шари кадру в один RGBA-буфер (альфа-композиція source-over).
 * Цим користуються полотно, мініатюри, експорт PNG/GIF і прев'ю для сервера.
 */
export function compositeFrame(
  doc: PixelDoc,
  frameIndex: number,
  options: { layerIds?: string[]; includeHidden?: boolean } = {},
) {
  const { width, height } = doc;
  const out = new Uint8ClampedArray(width * height * 4);
  const frame = doc.frames[frameIndex];
  if (!frame) return out;

  for (const layer of doc.layers) {
    if (options.layerIds && !options.layerIds.includes(layer.id)) continue;
    if (!layer.visible && !options.includeHidden) continue;
    const cel = frame.cels[layer.id];
    if (!cel) continue;

    for (let i = 0; i < cel.length; i++) {
      const color = cel[i];
      if (color === 0) continue;
      const [sr, sg, sb, sa8] = unpack(color);
      const sa = (sa8 / 255) * layer.opacity;
      if (sa <= 0) continue;

      const o = i * 4;
      const da = out[o + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (da === 0) {
        out[o] = sr;
        out[o + 1] = sg;
        out[o + 2] = sb;
      } else {
        out[o] = (sr * sa + out[o] * da * (1 - sa)) / oa;
        out[o + 1] = (sg * sa + out[o + 1] * da * (1 - sa)) / oa;
        out[o + 2] = (sb * sa + out[o + 2] * da * (1 - sa)) / oa;
      }
      out[o + 3] = oa * 255;
    }
  }
  return out;
}

/** Колір верхнього видимого непрозорого пікселя — для піпетки. */
export function pickColor(doc: PixelDoc, frameIndex: number, x: number, y: number): number | null {
  const frame = doc.frames[frameIndex];
  if (!frame) return null;
  const index = y * doc.width + x;
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i];
    if (!layer.visible) continue;
    const color = frame.cels[layer.id]?.[index] ?? 0;
    if (color !== 0) return color;
  }
  return null;
}

export function flipPixels(
  pixels: readonly number[],
  width: number,
  height: number,
  axis: 'x' | 'y',
): number[] {
  const out = new Array<number>(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = axis === 'x' ? width - 1 - x : x;
      const sy = axis === 'y' ? height - 1 - y : y;
      out[y * width + x] = pixels[sy * width + sx];
    }
  }
  return out;
}

// ---------- Серіалізація (формат, що зберігається на сервері) ----------

export interface SerializedDoc {
  format: 'pixelforge';
  version: 1;
  width: number;
  height: number;
  fps: number;
  layers: LayerMeta[];
  frames: { id: string; cels: Record<string, number[]> }[]; // cels у RLE
  palette?: string[];
}

export function serializeDoc(doc: PixelDoc, palette?: string[]): SerializedDoc {
  return {
    format: 'pixelforge',
    version: 1,
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    layers: doc.layers.map((l) => ({ ...l })),
    frames: doc.frames.map((frame) => ({
      id: frame.id,
      cels: Object.fromEntries(
        doc.layers.map((l) => [l.id, encodeRLE(frame.cels[l.id] ?? emptyPixels(doc.width, doc.height))]),
      ),
    })),
    palette,
  };
}

export function deserializeDoc(raw: unknown): { doc: PixelDoc; palette?: string[] } {
  const data = raw as Partial<SerializedDoc> | null;
  if (!data || data.format !== 'pixelforge' || data.version !== 1) {
    throw new Error('Unsupported document format');
  }
  const width = Number(data.width);
  const height = Number(data.height);
  if (!(width > 0 && height > 0 && width <= MAX_SIZE && height <= MAX_SIZE)) {
    throw new Error('Invalid document size');
  }
  const layers: LayerMeta[] = (data.layers ?? []).map((l) => ({
    id: String(l.id),
    name: String(l.name ?? 'Layer'),
    visible: l.visible !== false,
    opacity: typeof l.opacity === 'number' ? Math.min(1, Math.max(0, l.opacity)) : 1,
  }));
  if (layers.length === 0) throw new Error('Document has no layers');

  const total = width * height;
  const frames: Frame[] = (data.frames ?? []).map((f) => ({
    id: String(f.id ?? uid('frame')),
    cels: Object.fromEntries(
      layers.map((l) => {
        const encoded = f.cels?.[l.id];
        return [l.id, encoded ? decodeRLE(encoded, total) : emptyPixels(width, height)];
      }),
    ),
  }));
  if (frames.length === 0) throw new Error('Document has no frames');

  const fps = Number(data.fps) > 0 ? Math.min(30, Number(data.fps)) : 8;
  return { doc: { width, height, fps, layers, frames }, palette: data.palette };
}
