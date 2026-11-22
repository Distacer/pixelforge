/**
 * Растрові алгоритми для інструментів: лінія Брезенхема, прямокутник, еліпс.
 * Повертають список точок [x, y]; що з ними робити, вирішує інструмент.
 */

export type Point = [x: number, y: number];

/** Алгоритм Брезенхема: пікселі прямої між двома точками без пропусків. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

export function rectPoints(x0: number, y0: number, x1: number, y1: number, filled: boolean): Point[] {
  const [minX, maxX] = x0 < x1 ? [x0, x1] : [x1, x0];
  const [minY, maxY] = y0 < y1 ? [y0, y1] : [y1, y0];
  const points: Point[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (filled || x === minX || x === maxX || y === minY || y === maxY) points.push([x, y]);
    }
  }
  return points;
}

/**
 * Еліпс, вписаний у прямокутник. Піксель належить еліпсу, якщо його центр
 * задовольняє ((x-cx)/rx)² + ((y-cy)/ry)² ≤ 1. Контур — пікселі еліпса,
 * у яких хоча б один сусід лежить поза ним.
 */
export function ellipsePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
): Point[] {
  const [minX, maxX] = x0 < x1 ? [x0, x1] : [x1, x0];
  const [minY, maxY] = y0 < y1 ? [y0, y1] : [y1, y0];
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2 + 0.5;
  const ry = (maxY - minY) / 2 + 0.5;

  const inside = (x: number, y: number) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  };

  const points: Point[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (filled || edge) points.push([x, y]);
    }
  }
  return points;
}

/** Shift при малюванні фігур: квадрат/коло. */
export function constrainSquare(x0: number, y0: number, x1: number, y1: number): Point {
  const size = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  return [x0 + Math.sign(x1 - x0 || 1) * size, y0 + Math.sign(y1 - y0 || 1) * size];
}

/** Shift при малюванні лінії: прив'язка до 0°, 45° і 90°. */
export function constrainAngle(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > ady * 2) return [x1, y0];
  if (ady > adx * 2) return [x0, y1];
  const d = Math.max(adx, ady);
  return [x0 + Math.sign(dx) * d, y0 + Math.sign(dy) * d];
}
