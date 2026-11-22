/**
 * Мінімальний кодувальник анімованого GIF89a без сторонніх бібліотек.
 *
 * Структура файлу:
 *   "GIF89a" → Logical Screen Descriptor → Global Color Table
 *   → NETSCAPE2.0 (зациклення) → для кожного кадру:
 *       Graphic Control Extension (затримка, прозорість) → Image Descriptor → LZW-дані
 *   → 0x3B (кінець)
 *
 * Піксель-арт рідко має більше 255 кольорів, тому будуємо одну спільну палітру.
 * Індекс 0 зарезервовано під прозорість. Якщо кольорів забагато — квантуємо
 * до рівномірної сітки 6×7×6 (252 кольори).
 */

export interface GifFrame {
  /** RGBA, довжина width * height * 4 */
  rgba: Uint8ClampedArray;
  /** Тривалість кадру в мілісекундах */
  delayMs: number;
}

const ALPHA_THRESHOLD = 128;

class ByteWriter {
  private chunks: number[] = [];
  byte(value: number) {
    this.chunks.push(value & 255);
  }
  u16(value: number) {
    this.byte(value & 255);
    this.byte((value >> 8) & 255);
  }
  bytes(values: ArrayLike<number>) {
    for (let i = 0; i < values.length; i++) this.chunks.push(values[i] & 255);
  }
  text(value: string) {
    for (let i = 0; i < value.length; i++) this.byte(value.charCodeAt(i));
  }
  toUint8Array() {
    return Uint8Array.from(this.chunks);
  }
}

function quantize6x7x6(r: number, g: number, b: number): number {
  const ri = Math.round((r / 255) * 5);
  const gi = Math.round((g / 255) * 6);
  const bi = Math.round((b / 255) * 5);
  return (ri * 7 + gi) * 6 + bi;
}

function buildPalette(frames: GifFrame[]) {
  const colorToIndex = new Map<number, number>();
  const palette: number[] = [0]; // індекс 0 — прозорий
  let overflow = false;

  outer: for (const frame of frames) {
    const data = frame.rgba;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < ALPHA_THRESHOLD) continue;
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      if (colorToIndex.has(key)) continue;
      if (palette.length >= 256) {
        overflow = true;
        break outer;
      }
      colorToIndex.set(key, palette.length);
      palette.push(key);
    }
  }

  if (!overflow) {
    return {
      palette,
      lookup: (r: number, g: number, b: number) => colorToIndex.get((r << 16) | (g << 8) | b)!,
    };
  }

  const uniform: number[] = [0];
  for (let ri = 0; ri < 6; ri++) {
    for (let gi = 0; gi < 7; gi++) {
      for (let bi = 0; bi < 6; bi++) {
        const r = Math.round((ri / 5) * 255);
        const g = Math.round((gi / 6) * 255);
        const b = Math.round((bi / 5) * 255);
        uniform.push((r << 16) | (g << 8) | b);
      }
    }
  }
  return { palette: uniform, lookup: (r: number, g: number, b: number) => 1 + quantize6x7x6(r, g, b) };
}

/** LZW-стиснення індексів кольорів (так, як вимагає специфікація GIF). */
export function lzwEncode(indices: Uint8Array, minCodeSize: number) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  const dictionary = new Map<number, number>();

  const out: number[] = [];
  let buffer = 0;
  let bufferBits = 0;
  const write = (code: number) => {
    buffer |= code << bufferBits;
    bufferBits += codeSize;
    while (bufferBits >= 8) {
      out.push(buffer & 255);
      buffer >>>= 8;
      bufferBits -= 8;
    }
  };

  write(clearCode);
  if (indices.length === 0) {
    write(endCode);
    if (bufferBits > 0) out.push(buffer & 255);
    return Uint8Array.from(out);
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const existing = dictionary.get(key);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    write(prefix);
    if (nextCode === 4096) {
      // Словник заповнений — скидаємо його
      write(clearCode);
      dictionary.clear();
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      dictionary.set(key, nextCode++);
    }
    prefix = k;
  }
  write(prefix);
  write(endCode);
  if (bufferBits > 0) out.push(buffer & 255);
  return Uint8Array.from(out);
}

export function encodeGif(width: number, height: number, frames: GifFrame[], loop = 0) {
  if (frames.length === 0) throw new Error('GIF: немає кадрів');
  const { palette, lookup } = buildPalette(frames);

  // Розмір таблиці кольорів у GIF — завжди степінь двійки (мінімум 2)
  let depth = 1;
  while (1 << depth < palette.length) depth++;
  const tableSize = 1 << depth;

  const w = new ByteWriter();
  w.text('GIF89a');
  w.u16(width);
  w.u16(height);
  w.byte(0x80 | ((depth - 1) << 4) | (depth - 1)); // є глобальна таблиця
  w.byte(0); // індекс фону
  w.byte(0); // співвідношення сторін пікселя

  for (let i = 0; i < tableSize; i++) {
    const color = palette[i] ?? 0;
    w.byte((color >> 16) & 255);
    w.byte((color >> 8) & 255);
    w.byte(color & 255);
  }

  if (frames.length > 1) {
    w.byte(0x21);
    w.byte(0xff);
    w.byte(11);
    w.text('NETSCAPE2.0');
    w.byte(3);
    w.byte(1);
    w.u16(loop);
    w.byte(0);
  }

  const minCodeSize = Math.max(2, depth);
  const indices = new Uint8Array(width * height);

  for (const frame of frames) {
    const data = frame.rgba;
    for (let p = 0, i = 0; p < indices.length; p++, i += 4) {
      indices[p] = data[i + 3] < ALPHA_THRESHOLD ? 0 : lookup(data[i], data[i + 1], data[i + 2]);
    }

    // Graphic Control Extension
    w.byte(0x21);
    w.byte(0xf9);
    w.byte(4);
    w.byte((2 << 2) | 1); // disposal = 2 (очистити перед наступним кадром), є прозорість
    w.u16(Math.max(2, Math.round(frame.delayMs / 10))); // у сотих секунди
    w.byte(0); // прозорий індекс
    w.byte(0);

    // Image Descriptor
    w.byte(0x2c);
    w.u16(0);
    w.u16(0);
    w.u16(width);
    w.u16(height);
    w.byte(0);

    w.byte(minCodeSize);
    const lzw = lzwEncode(indices, minCodeSize);
    for (let offset = 0; offset < lzw.length; offset += 255) {
      const block = lzw.subarray(offset, offset + 255);
      w.byte(block.length);
      w.bytes(block);
    }
    w.byte(0);
  }

  w.byte(0x3b);
  return w.toUint8Array();
}
