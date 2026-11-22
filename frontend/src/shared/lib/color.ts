/**
 * Кольори пікселів зберігаються як одне 32-бітне число 0xRRGGBBAA.
 * 0 означає повністю прозорий піксель.
 * Так масив пікселів — це просто number[], його легко копіювати, порівнювати й серіалізувати.
 */

export const TRANSPARENT = 0;

export type RGBA = [r: number, g: number, b: number, a: number];

export function pack(r: number, g: number, b: number, a = 255): number {
  return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
}

export function unpack(color: number): RGBA {
  return [(color >>> 24) & 255, (color >>> 16) & 255, (color >>> 8) & 255, color & 255];
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeHex(value: string): string {
  let hex = value.trim().replace(/^#/, '').toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return `#${hex.slice(0, 6)}`;
}

export function hexToPacked(hex: string): number {
  const clean = normalizeHex(hex).slice(1);
  const n = parseInt(clean, 16);
  return pack((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
}

export function packedToHex(color: number): string {
  const [r, g, b] = unpack(color);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Колір тексту, що читається на заданому фоні (для підписів на свотчах). */
export function readableOn(hex: string): '#000000' | '#ffffff' {
  const [r, g, b] = unpack(hexToPacked(hex));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 150 ? '#000000' : '#ffffff';
}
