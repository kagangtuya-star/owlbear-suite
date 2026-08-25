// Binary morphology — erode / dilate / open / close on Uint8 masks
// with rectangular kernels.
//
// Two implementations, same answer:
//
//   * GENERAL — 4-pass (van Herk / Gil-Werman) decomposition, a
//     separable row+column pass with a monotonic min/max queue. Works
//     for any byte values. O(w*h) regardless of kernel size.
//
//   * BINARY — the same separable decomposition, but a window's max /
//     min is derived from a running COUNT of set pixels instead of a
//     monotonic queue. Only valid when every byte is 0 or 255, which
//     every mask in this editor is: brush, polygon, flood fill and the
//     thresholding algorithms all write `paint ? 255 : 0`, and
//     `traceContours` reads them back as `> 127`.
//
// The binary path is picked by actually CHECKING the input (one linear
// scan, a couple of ms on a 6.6 Mpx mask) rather than by assuming, so a
// future caller that puts other values in a mask still gets the right
// answer from the general path.
//
// Why bother: open/close on a 3000x2200 map ran ~350 ms each, and the
// user clicks them repeatedly while tuning a trace. The queue's inner
// while-loops and its double indirection (`mask[row + queue[qTail-1]]`)
// cost far more than the arithmetic they save on two-valued data.
//
// Border convention, which BOTH paths must honour: the window is
// [c-r, c+r] CLAMPED to the array, not padded. A pixel at x=0 sees a
// window of r+1, not 2r+1.

const ON = 255;
const OFF = 0;

/** Every byte 0 or 255? Decides which implementation is valid. */
function isBinaryMask(mask: Uint8Array): boolean {
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i];
    if (v !== OFF && v !== ON) return false;
  }
  return true;
}

// --- general path -----------------------------------------------------------

function rowMinMax(
  mask: Uint8Array,
  w: number,
  h: number,
  k: number,
  isMax: boolean,
): Uint8Array {
  // Sliding window of half-size r = floor(k/2). For monotonic queue
  // of size k along each row, output[x] = max/min over [x-r, x+r].
  const r = Math.floor(k / 2);
  const out = new Uint8Array(mask.length);
  const queue = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let qHead = 0, qTail = 0;
    // Initialize: push x=0..r-1 onto queue.
    for (let x = -r; x < w + r; x++) {
      // Push current x (if in range).
      if (x >= 0 && x < w) {
        const v = mask[row + x];
        if (isMax) {
          while (qTail > qHead && mask[row + queue[qTail - 1]] <= v) qTail--;
        } else {
          while (qTail > qHead && mask[row + queue[qTail - 1]] >= v) qTail--;
        }
        queue[qTail++] = x;
      }
      // Pop expired.
      const cx = x - r;
      if (cx >= 0 && cx < w) {
        while (qHead < qTail && queue[qHead] < cx - r) qHead++;
        out[row + cx] = mask[row + queue[qHead]];
      }
    }
  }
  return out;
}

function colMinMax(
  mask: Uint8Array,
  w: number,
  h: number,
  k: number,
  isMax: boolean,
): Uint8Array {
  const r = Math.floor(k / 2);
  const out = new Uint8Array(mask.length);
  const queue = new Int32Array(h);
  for (let x = 0; x < w; x++) {
    let qHead = 0, qTail = 0;
    for (let y = -r; y < h + r; y++) {
      if (y >= 0 && y < h) {
        const v = mask[y * w + x];
        if (isMax) {
          while (qTail > qHead && mask[queue[qTail - 1] * w + x] <= v) qTail--;
        } else {
          while (qTail > qHead && mask[queue[qTail - 1] * w + x] >= v) qTail--;
        }
        queue[qTail++] = y;
      }
      const cy = y - r;
      if (cy >= 0 && cy < h) {
        while (qHead < qTail && queue[qHead] < cy - r) qHead++;
        out[cy * w + x] = mask[queue[qHead] * w + x];
      }
    }
  }
  return out;
}

// --- binary path ------------------------------------------------------------

/** Row pass over a 0/255 mask. `isMax` → set if ANY set in window;
 *  otherwise → set only if ALL set. */
function rowBinary(
  mask: Uint8Array,
  w: number,
  h: number,
  k: number,
  isMax: boolean,
): Uint8Array {
  const r = Math.floor(k / 2);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    // Seed the window for x = 0: [0, min(w-1, r)].
    let count = 0;
    let hi = Math.min(w - 1, r);
    for (let x = 0; x <= hi; x++) if (mask[row + x]) count++;
    let lo = 0;
    for (let cx = 0; cx < w; cx++) {
      const wantLo = cx - r > 0 ? cx - r : 0;
      const wantHi = cx + r < w - 1 ? cx + r : w - 1;
      while (hi < wantHi) if (mask[row + ++hi]) count++;
      while (lo < wantLo) if (mask[row + lo++]) count--;
      out[row + cx] = isMax
        ? count > 0
          ? ON
          : OFF
        : count === wantHi - wantLo + 1
          ? ON
          : OFF;
    }
  }
  return out;
}

/**
 * Column pass over a 0/255 mask.
 *
 * Keeps a per-column running count and slides it DOWN one row at a
 * time, so every memory access stays row-major. Walking each column
 * top-to-bottom instead (the obvious mirror of the row pass) strides by
 * `w` and misses cache on every read.
 */
function colBinary(
  mask: Uint8Array,
  w: number,
  h: number,
  k: number,
  isMax: boolean,
): Uint8Array {
  const r = Math.floor(k / 2);
  const out = new Uint8Array(mask.length);
  const count = new Int32Array(w);
  let lo = 0;
  let hi = -1;
  for (let cy = 0; cy < h; cy++) {
    const wantLo = cy - r > 0 ? cy - r : 0;
    const wantHi = cy + r < h - 1 ? cy + r : h - 1;
    while (hi < wantHi) {
      hi++;
      const o = hi * w;
      for (let x = 0; x < w; x++) if (mask[o + x]) count[x]++;
    }
    while (lo < wantLo) {
      const o = lo * w;
      for (let x = 0; x < w; x++) if (mask[o + x]) count[x]--;
      lo++;
    }
    const o = cy * w;
    const len = wantHi - wantLo + 1;
    if (isMax) {
      for (let x = 0; x < w; x++) out[o + x] = count[x] > 0 ? ON : OFF;
    } else {
      for (let x = 0; x < w; x++) out[o + x] = count[x] === len ? ON : OFF;
    }
  }
  return out;
}

// --- public API -------------------------------------------------------------

function pass(
  mask: Uint8Array,
  w: number,
  h: number,
  k: number,
  isMax: boolean,
  binary: boolean,
): Uint8Array {
  return binary
    ? colBinary(rowBinary(mask, w, h, k, isMax), w, h, k, isMax)
    : colMinMax(rowMinMax(mask, w, h, k, isMax), w, h, k, isMax);
}

export function dilate(mask: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 1) return mask;
  return pass(mask, w, h, k, true, isBinaryMask(mask));
}

export function erode(mask: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 1) return mask;
  return pass(mask, w, h, k, false, isBinaryMask(mask));
}

export function open(mask: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 1) return mask;
  // One classification for both halves: a binary input stays binary
  // through the first pass, since both paths only ever emit 0 or the
  // values already present.
  const binary = isBinaryMask(mask);
  return pass(pass(mask, w, h, k, false, binary), w, h, k, true, binary);
}

export function close(mask: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 1) return mask;
  const binary = isBinaryMask(mask);
  return pass(pass(mask, w, h, k, true, binary), w, h, k, false, binary);
}

/** Test-only: force the general (non-binary) implementation, so the
 *  selftest can fuzz the fast path against it. */
export function _morphologyReference(
  mask: Uint8Array,
  w: number,
  h: number,
  k: number,
  op: "dilate" | "erode" | "open" | "close",
): Uint8Array {
  if (k <= 1) return mask;
  switch (op) {
    case "dilate":
      return pass(mask, w, h, k, true, false);
    case "erode":
      return pass(mask, w, h, k, false, false);
    case "open":
      return pass(pass(mask, w, h, k, false, false), w, h, k, true, false);
    case "close":
      return pass(pass(mask, w, h, k, true, false), w, h, k, false, false);
  }
}
