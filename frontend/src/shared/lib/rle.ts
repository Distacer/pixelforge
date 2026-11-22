/**
 * Run-Length Encoding: [1,1,1,0,0,5] → [3,1, 2,0, 1,5] (пари «кількість, значення»).
 * Піксель-арт складається з великих однотонних ділянок (особливо прозорих),
 * тож RLE стискає документ у десятки разів перед збереженням у БД чи localStorage.
 */

export function encodeRLE(values: readonly number[]): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const value = values[i];
    let run = 1;
    while (i + run < values.length && values[i + run] === value) run++;
    out.push(run, value);
    i += run;
  }
  return out;
}

export function decodeRLE(encoded: readonly number[], expectedLength?: number): number[] {
  if (encoded.length % 2 !== 0) throw new Error('RLE: непарна довжина');
  const out: number[] = [];
  for (let i = 0; i < encoded.length; i += 2) {
    const run = encoded[i];
    const value = encoded[i + 1];
    if (!Number.isInteger(run) || run < 0) throw new Error('RLE: некоректна довжина серії');
    for (let k = 0; k < run; k++) out.push(value);
  }
  if (expectedLength !== undefined && out.length !== expectedLength) {
    throw new Error(`RLE: очікувалось ${expectedLength} значень, отримано ${out.length}`);
  }
  return out;
}
