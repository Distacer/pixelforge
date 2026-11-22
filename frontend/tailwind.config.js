/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        teal: token('teal'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['"Rubik Variable"', 'system-ui', 'sans-serif'],
        pixel: ['Silkscreen', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        // «Пікселева» жорстка тінь без розмиття — фірмовий елемент кнопок
        pixel: '3px 3px 0 0 rgb(var(--shadow))',
        'pixel-sm': '2px 2px 0 0 rgb(var(--shadow))',
        pop: '0 12px 32px -12px rgb(var(--shadow) / 0.45)',
      },
      borderRadius: {
        px: '3px',
      },
    },
  },
  plugins: [],
};
