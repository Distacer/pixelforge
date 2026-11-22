/** Вбудовані палітри. Значення взяті з відкритих палітр, популярних серед піксель-артистів. */

export interface PaletteDef {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: PaletteDef[] = [
  {
    id: 'pico8',
    name: 'PICO-8',
    colors: [
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
    ],
  },
  {
    id: 'sweetie16',
    name: 'Sweetie 16',
    colors: [
      '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
    ],
  },
  {
    id: 'gameboy',
    name: 'Game Boy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    colors: Array.from({ length: 8 }, (_, i) => {
      const v = Math.round((i / 7) * 255)
        .toString(16)
        .padStart(2, '0');
      return `#${v}${v}${v}`;
    }),
  },
];

export const DEFAULT_PALETTE_ID = 'sweetie16';
export const CUSTOM_PALETTE_ID = 'custom';
