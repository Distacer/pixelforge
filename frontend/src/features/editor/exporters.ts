/** Експорт документа в PNG, спрайтшит і GIF + прев'ю для сервера. */

import { encodeGif } from '../../shared/lib/gif';
import { rgbaToDataUrl, rgbaToPngBlob, scaleRGBA } from '../../shared/lib/image';
import { compositeFrame, type PixelDoc } from './model';

export type ExportKind = 'png' | 'sheet' | 'gif';

const MAX_SIDE: Record<ExportKind, number> = { png: 4096, sheet: 8192, gif: 1024 };

/** Найбільший масштаб, за якого файл ще має розумний розмір. */
export function maxScale(doc: PixelDoc, kind: ExportKind): number {
  const width = kind === 'sheet' ? doc.width * doc.frames.length : doc.width;
  return Math.max(1, Math.floor(MAX_SIDE[kind] / Math.max(width, doc.height)));
}

export function exportFramePng(doc: PixelDoc, frameIndex: number, scale: number): Promise<Blob> {
  return rgbaToPngBlob(compositeFrame(doc, frameIndex), doc.width, doc.height, scale);
}

/** Усі кадри в один ряд — зручно для ігрових рушіїв. */
export function exportSpritesheet(doc: PixelDoc, scale: number): Promise<Blob> {
  const sheetW = doc.width * doc.frames.length;
  const sheet = new Uint8ClampedArray(sheetW * doc.height * 4);
  doc.frames.forEach((_, f) => {
    const rgba = compositeFrame(doc, f);
    for (let y = 0; y < doc.height; y++) {
      const src = rgba.subarray(y * doc.width * 4, (y + 1) * doc.width * 4);
      sheet.set(src, (y * sheetW + f * doc.width) * 4);
    }
  });
  return rgbaToPngBlob(sheet, sheetW, doc.height, scale);
}

export function exportGif(doc: PixelDoc, scale: number): Blob {
  const frames = doc.frames.map((_, i) => ({
    rgba: scaleRGBA(compositeFrame(doc, i), doc.width, doc.height, scale),
    delayMs: 1000 / doc.fps,
  }));
  const bytes = encodeGif(doc.width * scale, doc.height * scale, frames);
  return new Blob([bytes], { type: 'image/gif' });
}

/** PNG першого кадру ~256px — його бачать у галереї. */
export function makePreviewDataUrl(doc: PixelDoc): string {
  const scale = Math.max(1, Math.floor(256 / Math.max(doc.width, doc.height)));
  return rgbaToDataUrl(compositeFrame(doc, 0), doc.width, doc.height, scale);
}
