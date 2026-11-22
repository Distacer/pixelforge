/**
 * Робота з растром у браузері: RGBA ↔ canvas ↔ PNG, масштабування, пікселізація.
 */

import { pack } from './color';

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Перевіряємо «магічні байти», а не лише розширення файлу. */
export async function isPngFile(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return PNG_SIGNATURE.every((byte, i) => head[i] === byte);
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Збільшення без розмиття: кожен піксель стає квадратом scale × scale. */
export function scaleRGBA(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
): Uint8ClampedArray {
  if (scale === 1) return src;
  const outW = width * scale;
  const out = new Uint8ClampedArray(outW * height * scale * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      for (let dy = 0; dy < scale; dy++) {
        let di = ((y * scale + dy) * outW + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++, di += 4) {
          out[di] = src[si];
          out[di + 1] = src[si + 1];
          out[di + 2] = src[si + 2];
          out[di + 3] = src[si + 3];
        }
      }
    }
  }
  return out;
}

/** Завжди копіюємо буфер: ImageData вимагає Uint8ClampedArray саме над ArrayBuffer. */
export function toImageData(rgba: Uint8ClampedArray, width: number, height: number): ImageData {
  return new ImageData(new Uint8ClampedArray(rgba), width, height);
}

export function rgbaToCanvas(rgba: Uint8ClampedArray, width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(toImageData(rgba, width, height), 0, 0);
  return canvas;
}

/** Малює RGBA у вже існуючий canvas, змінюючи його розмір за потреби. */
export function paintRGBA(canvas: HTMLCanvasElement, rgba: Uint8ClampedArray, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.getContext('2d')!.putImageData(toImageData(rgba, width, height), 0, 0);
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export function rgbaToPngBlob(rgba: Uint8ClampedArray, width: number, height: number, scale = 1) {
  return canvasToBlob(rgbaToCanvas(scaleRGBA(rgba, width, height, scale), width * scale, height * scale));
}

export function rgbaToDataUrl(rgba: Uint8ClampedArray, width: number, height: number, scale = 1) {
  return rgbaToCanvas(scaleRGBA(rgba, width, height, scale), width * scale, height * scale).toDataURL(
    'image/png',
  );
}

/** Розмір цільового полотна зі збереженням пропорцій: довша сторона = maxSide. */
export function fitSize(srcW: number, srcH: number, maxSide: number): { width: number; height: number } {
  const ratio = maxSide / Math.max(srcW, srcH);
  return {
    width: Math.max(1, Math.round(srcW * ratio)),
    height: Math.max(1, Math.round(srcH * ratio)),
  };
}

/**
 * Перетворює зображення на масив пікселів заданого розміру.
 * smooth=true — усереднення (краще для фото), false — найближчий сусід
 * (краще, якщо PNG уже є збільшеним піксель-артом).
 */
export function pixelate(
  source: CanvasImageSource,
  width: number,
  height: number,
  smooth: boolean,
): number[] {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const pixels = new Array<number>(width * height);
  for (let i = 0; i < pixels.length; i++) {
    const a = data[i * 4 + 3];
    pixels[i] = a < 16 ? 0 : pack(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], a > 240 ? 255 : a);
  }
  return pixels;
}
