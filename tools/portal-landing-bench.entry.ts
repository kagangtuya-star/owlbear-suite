// Landing-search benchmark + equivalence check.
import {
  WallGrid, isSafeLandingPointExhaustive, landingCellSize,
  type Point, type WallSegment,
} from "../src/modules/portals/landing";

let seed = 4242;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 0x100000000);

// A traced dungeon's worth of wall segments.
const walls: WallSegment[] = [];
for (let room = 0; room < 40; room++) {
  const x = rnd() * 5000, y = rnd() * 4000;
  const w = 200 + rnd() * 400, h = 200 + rnd() * 400;
  const step = 12;
  for (let i = 0; i < w; i += step) {
    walls.push({ a: { x: x + i, y }, b: { x: x + i + step, y } });
    walls.push({ a: { x: x + i, y: y + h }, b: { x: x + i + step, y: y + h } });
  }
  for (let i = 0; i < h; i += step) {
    walls.push({ a: { x, y: y + i }, b: { x, y: y + i + step } });
    walls.push({ a: { x: x + w, y: y + i }, b: { x: x + w, y: y + i + step } });
  }
}
console.log(`  wall segments: ${walls.length}`);

const spacing = 150, clearance = 40;
const center: Point = { x: 2500, y: 2000 };
const candidates: Point[] = [{ ...center }];
for (let ring = 1; ring <= 12; ring++) {
  const count = ring * 6;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 2 * Math.PI - Math.PI / 2;
    candidates.push({ x: center.x + Math.cos(a) * spacing * ring, y: center.y + Math.sin(a) * spacing * ring });
  }
}
console.log(`  candidates: ${candidates.length}`);

// --- equivalence over many centres, not just one -------------------------
let mismatch = 0, checked = 0;
for (let t = 0; t < 40; t++) {
  const o: Point = { x: rnd() * 5000, y: rnd() * 4000 };
  const grid = new WallGrid(walls, landingCellSize(spacing));
  const scratch: number[] = [];
  for (const c of candidates) {
    const p = { x: c.x - center.x + o.x, y: c.y - center.y + o.y };
    const want = isSafeLandingPointExhaustive(p, o, clearance, walls);
    const got = grid.isSafeLandingPoint(p, o, clearance, scratch);
    checked++;
    if (want !== got) { mismatch++; if (mismatch < 4) console.log(`     MISMATCH at ${JSON.stringify(p)}`); }
  }
}
console.log(`  equivalence: ${checked} probes, ${mismatch} mismatches ${mismatch === 0 ? "✓" : "✗"}`);

function bench(label: string, fn: () => void, n = 20) {
  fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const t1 = process.hrtime.bigint();
  console.log(`  ${label}: ${(Number(t1 - t0) / 1e6 / n).toFixed(2)} ms`);
}

bench("exhaustive: 4 tokens x all candidates", () => {
  for (let tok = 0; tok < 4; tok++) {
    for (const c of candidates) isSafeLandingPointExhaustive(c, center, clearance, walls);
  }
});
bench("indexed:    4 tokens x all candidates", () => {
  const grid = new WallGrid(walls, landingCellSize(spacing));
  const scratch: number[] = [];
  for (let tok = 0; tok < 4; tok++) {
    for (const c of candidates) grid.isSafeLandingPoint(c, center, clearance, scratch);
  }
});
