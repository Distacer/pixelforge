/**
 * Заливка «відро»: рядковий (scanline) варіант алгоритму flood fill.
 *
 * Замість рекурсії (яка падає з переповненням стека на великих областях)
 * використовуємо стек індексів. Для кожного пікселя зі стека розширюємось
 * уліво та вправо до межі, фарбуємо весь відрізок і додаємо в стек пікселі
 * над і під ним. Сусідство — 4-зв'язне (без діагоналей), як у більшості редакторів.
 *
 * Повертає НОВИЙ масив або null, якщо нічого не змінилось.
 */
export function floodFill(
  pixels: readonly number[],
  width: number,
  height: number,
  x: number,
  y: number,
  color: number,
): number[] | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const target = pixels[y * width + x];
  if (target === color) return null;

  const out = pixels.slice();
  const stack: number[] = [y * width + x];

  while (stack.length > 0) {
    const index = stack.pop()!;
    if (out[index] !== target) continue;

    const rowStart = index - (index % width);
    const rowEnd = rowStart + width - 1;
    let left = index;
    let right = index;
    while (left > rowStart && out[left - 1] === target) left--;
    while (right < rowEnd && out[right + 1] === target) right++;

    for (let i = left; i <= right; i++) {
      out[i] = color;
      const up = i - width;
      const down = i + width;
      if (up >= 0 && out[up] === target) stack.push(up);
      if (down < out.length && out[down] === target) stack.push(down);
    }
  }
  return out;
}

/** Shift + заливка: замінити колір у всьому шарі, а не лише у зв'язній області. */
export function replaceColor(
  pixels: readonly number[],
  from: number,
  to: number,
): number[] | null {
  if (from === to) return null;
  let changed = false;
  const out = pixels.map((p) => {
    if (p !== from) return p;
    changed = true;
    return to;
  });
  return changed ? out : null;
}
