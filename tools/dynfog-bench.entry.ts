// Micro-benchmarks for the fog engine's hot paths.
//   DYNFOG_ENTRY=tools/dynfog-bench.entry.ts node tools/dynfog-selftest.mjs
import { cutRangesForPolyline, bboxOf, type Cut } from "../src/modules/fullFog/dynfog/geom/cut";

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 0x100000000);

function contour(n: number, ox: number, oy: number) {
  const poly: { x: number; y: number }[] = [];
  let x = ox, y = oy;
  for (let i = 0; i < n; i++) { poly.push({ x, y }); x += rnd() * 20 - 10; y += rnd() * 20 - 10; }
  return poly;
}

// 40 contours × 1250 vertices = a traced map.
const polys = Array.from({ length: 40 }, (_, i) => contour(1250, (i % 8) * 500, Math.floor(i / 8) * 500));

// One door, far from most contours — the common case the bbox filter skips.
const pts = [{ x: 100, y: 100 }, { x: 140, y: 100 }];
const cuts: Cut[] = [{ openingId: "d", parentId: "p", points: pts, radius: 14, bbox: bboxOf(pts, 14) }];

function bench(label: string, fn: () => void, n: number) {
  for (let i = 0; i < 5; i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const t1 = process.hrtime.bigint();
  console.log(`  ${label}: ${(Number(t1 - t0) / 1e6 / n).toFixed(3)} ms`);
}

bench("cutRangesForPolyline over 40 contours (one door)", () => {
  for (const p of polys) cutRangesForPolyline(p, cuts);
}, 100);

import { itemMatrix, inverseTransformPoint, inverseTransformPoints } from "../src/modules/fullFog/dynfog/geom/xform";
const fakeItem: any = { position: { x: 300, y: 200 }, rotation: 30, scale: { x: 1.5, y: 1.5 } };
const m = itemMatrix(fakeItem);
const cutPts = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: i * 2 }));
bench("inverseTransformPoint  x40 (inverts per point)", () => { cutPts.map((p) => inverseTransformPoint(m, p)); }, 2000);
bench("inverseTransformPoints x40 (inverts once)     ", () => { inverseTransformPoints(m, cutPts); }, 2000);
