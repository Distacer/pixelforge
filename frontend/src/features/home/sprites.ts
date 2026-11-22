/**
 * Спрайти, описані текстом: кожен символ — піксель, '.' — прозорий.
 * Так їх легко читати й правити прямо в коді.
 */

import { hexToPacked } from '../../shared/lib/color';

export interface Sprite {
  width: number;
  height: number;
  rows: string[];
  colors: Record<string, string>;
}

export const POTION_SPRITE: Sprite = {
  width: 16,
  height: 16,
  colors: {
    k: '#1a1c2c',
    o: '#ef7d57',
    g: '#94b0c2',
    w: '#f4f4f4',
    l: '#a7f070',
    L: '#38b764',
    d: '#257179',
  },
  rows: [
    '......kkkk......',
    '.....kooook.....',
    '.....kooook.....',
    '......kkkk......',
    '......kggk......',
    '......kggk......',
    '.....kggggk.....',
    '...kkggggggkk...',
    '..kggllllllggk..',
    '.kgwlLLLLLLllgk.',
    '.kgwLLLLLLLLlgk.',
    '.kglLLLLLLLLdgk.',
    '.kgLLLLLLLLddgk.',
    '..kgLLLLLLddgk..',
    '...kkggggggkk...',
    '.....kkkkkk.....',
  ],
};

export const GHOST_SPRITE: Sprite = {
  width: 16,
  height: 16,
  colors: { k: '#333c57', w: '#f4f4f4', p: '#b13e53' },
  rows: [
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwwwwwwwwk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwkkwwwwkkwwk.',
    '.kwwkkwwwwkkwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwppwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwkwwwwkwwwk.',
    '.kwwk.kwwk.kwwk.',
    '..kk...kk...kk..',
  ],
};

export function spriteToPixels(sprite: Sprite): number[] {
  const packed: Record<string, number> = {};
  for (const [ch, hex] of Object.entries(sprite.colors)) packed[ch] = hexToPacked(hex);
  const pixels: number[] = [];
  for (const row of sprite.rows) {
    for (let x = 0; x < sprite.width; x++) pixels.push(packed[row[x]] ?? 0);
  }
  return pixels;
}
