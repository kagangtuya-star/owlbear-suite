// Benchmarks for the fog editor's mask pipeline on a realistic map size.
import { connectedComponents, areaFilter } from "../src/modules/fullFog/refinement/components";
import { selectiveHoleFill } from "../src/modules/fullFog/refinement/holeFill";
import { traceContours } from "../src/modules/fullFog/output/contours";
import { simplifyDP } from "../src/modules/fullFog/output/simplify";
import { chaikinSmooth } from "../src/modules/fullFog/output/smooth";
import { open as morphOpen, close as morphClose } from "../src/modules/fullFog/refinement/morphology";

const W = 3000, H = 2200;               // a typical battlemap export
const mask = new Uint8Array(W * H);
// Draw a dungeon: 60 rooms with 6px walls.
let seed = 99;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 0x100000000);
function rect(x: number, y: number, w: number, h: number, t: number) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const edge = xx < x + t || xx >= x + w - t || yy < y + t || yy >= y + h - t;
      if (edge && yy >= 0 && yy < H && xx >= 0 && xx < W) mask[yy * W + xx] = 255;
    }
  }
}
for (let i = 0; i < 60; i++) {
  rect(Math.floor(rnd() * (W - 400)), Math.floor(rnd() * (H - 400)),
       120 + Math.floor(rnd() * 280), 120 + Math.floor(rnd() * 280), 6);
}
let filled = 0; for (const v of mask) if (v) filled++;
console.log(`  mask ${W}x${H} = ${(W * H / 1e6).toFixed(1)}M px, ${(filled / 1e6).toFixed(2)}M set`);

function bench(label: string, fn: () => void, n = 3) {
  fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const t1 = process.hrtime.bigint();
  console.log(`  ${label}: ${(Number(t1 - t0) / 1e6 / n).toFixed(1)} ms`);
}

bench("morphology open  (k=5)", () => { morphOpen(mask, W, H, 5); });
bench("morphology close (k=5)", () => { morphClose(mask, W, H, 5); });
bench("connectedComponents", () => { connectedComponents(mask, W, H); });
bench("areaFilter (min 200)", () => { areaFilter(mask, W, H, 200); });
bench("selectiveHoleFill", () => { selectiveHoleFill(mask, W, H, 5000); });
const contours = traceContours(mask, W, H);
console.log(`  contours: ${contours.length}, vertices: ${contours.reduce((n, c) => n + c.length, 0)}`);
bench("traceContours", () => { traceContours(mask, W, H); });
bench("simplifyDP over all contours", () => { for (const c of contours) simplifyDP(c, 1.5); });
const simplified = contours.map((c) => simplifyDP(c, 1.5));
bench("chaikinSmooth over all contours", () => { for (const c of simplified) chaikinSmooth(c, 2, true); });
