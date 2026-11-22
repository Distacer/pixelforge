import { describe, expect, it } from 'vitest';
import { hexToPacked, pack, packedToHex, unpack } from './color';
import { floodFill, replaceColor } from './floodFill';
import { ellipsePoints, linePoints, rectPoints } from './geometry';
import { encodeGif } from './gif';
import { safeFilename } from './misc';
import { decodeRLE, encodeRLE } from './rle';

describe('color', () => {
  it('packs and unpacks RGBA', () => {
    const c = pack(255, 128, 1, 255);
    expect(unpack(c)).toEqual([255, 128, 1, 255]);
    expect(c).toBeGreaterThan(0);
  });
  it('converts hex both ways', () => {
    expect(packedToHex(hexToPacked('#ff004d'))).toBe('#ff004d');
    expect(packedToHex(hexToPacked('#abc'))).toBe('#aabbcc');
  });
});

describe('linePoints', () => {
  it('draws a diagonal without gaps', () => {
    expect(linePoints(0, 0, 3, 3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });
  it('includes both ends of a shallow line', () => {
    const pts = linePoints(0, 0, 5, 2);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts.at(-1)).toEqual([5, 2]);
    expect(pts).toHaveLength(6);
  });
});

describe('shapes', () => {
  it('rect outline has no interior', () => {
    expect(rectPoints(0, 0, 2, 2, false)).toHaveLength(8);
    expect(rectPoints(0, 0, 2, 2, true)).toHaveLength(9);
  });
  it('ellipse fits inside its box', () => {
    for (const [x, y] of ellipsePoints(0, 0, 9, 5, true)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(9);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(5);
    }
  });
});

describe('floodFill', () => {
  // 0 = порожньо, 1 = стіна. Ліва і права половини розділені стіною.
  const grid = [
    0, 0, 1, 0,
    0, 0, 1, 0,
    0, 0, 1, 0,
  ];
  it('fills only the connected area', () => {
    expect(floodFill(grid, 4, 3, 0, 0, 7)).toEqual([7, 7, 1, 0, 7, 7, 1, 0, 7, 7, 1, 0]);
  });
  it('returns null when color is the same', () => {
    expect(floodFill(grid, 4, 3, 2, 0, 1)).toBeNull();
  });
  it('replaceColor changes every match', () => {
    expect(replaceColor(grid, 0, 9)).toEqual([9, 9, 1, 9, 9, 9, 1, 9, 9, 9, 1, 9]);
  });
});

describe('rle', () => {
  it('round-trips', () => {
    const data = [0, 0, 0, 5, 5, 1, 0, 0];
    const encoded = encodeRLE(data);
    expect(encoded).toEqual([3, 0, 2, 5, 1, 1, 2, 0]);
    expect(decodeRLE(encoded, data.length)).toEqual(data);
  });
  it('rejects wrong length', () => {
    expect(() => decodeRLE([2, 0], 3)).toThrow();
  });
});

describe('gif', () => {
  it('writes a valid header and trailer', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 255, 0, 0, 255, 255]);
    const gif = encodeGif(2, 2, [
      { rgba, delayMs: 100 },
      { rgba, delayMs: 100 },
    ]);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe('GIF89a');
    expect(gif[6] | (gif[7] << 8)).toBe(2);
    expect(gif.at(-1)).toBe(0x3b);
  });
});

describe('safeFilename', () => {
  it('transliterates Ukrainian titles', () => {
    expect(safeFilename('Тестовий спрайт')).toBe('Testovyi-sprait');
    expect(safeFilename('Їжак: ремікс!')).toBe('Izhak-remiks');
    expect(safeFilename('   ')).toBe('pixelforge');
  });
});
