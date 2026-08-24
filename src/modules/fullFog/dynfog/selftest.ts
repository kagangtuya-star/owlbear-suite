// Geometry self-test for the dynfog engine.
//
// The wall/door maths is pure and deterministic, so it can be checked
// without a running Owlbear session. `tools/dynfog-selftest.mjs`
// bundles this with rolldown and runs it under node; it also runs in a
// browser console via `runDynfogSelfTest()`.
//
// Worth keeping honest: every opening in every existing scene is
// addressed in the arc-length space these functions define. A silent
// change here moves doors.

import { Command, type Curve, type Line, type Path, type Shape } from "@owlbear-rodeo/sdk";
import { commandsToPolylines, drawingToPolylines } from "./geom/drawing";
import { cardinalSplineToCommands } from "./geom/cardinal";
import {
  pointAtT,
  polylineLength,
  remapT,
  snapToPolyline,
  splitPolylineByRanges,
  subPolyline,
} from "./geom/polyline";
import { bboxOf, cutRangesForPolyline, type Cut } from "./geom/cut";
import { readOpenings } from "./opening/read";

export interface TestResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: TestResult[] = [];

function check(name: string, ok: boolean, detail = ""): void {
  results.push({ name, ok, detail });
}

function near(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) <= tol;
}

function baseItem(overrides: Record<string, unknown> = {}): any {
  return {
    id: "test",
    type: "SHAPE",
    name: "test",
    visible: true,
    locked: false,
    createdUserId: "u",
    zIndex: 0,
    lastModified: new Date(0).toISOString(),
    lastModifiedUserId: "u",
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    metadata: {},
    layer: "FOG",
    ...overrides,
  };
}

function rectShape(width: number, height: number): Shape {
  return baseItem({
    type: "SHAPE",
    shapeType: "RECTANGLE",
    width,
    height,
    style: {
      fillColor: "#000",
      fillOpacity: 0,
      strokeColor: "#000",
      strokeOpacity: 1,
      strokeWidth: 10,
      strokeDash: [],
    },
  }) as Shape;
}

export function runDynfogSelfTest(): TestResult[] {
  results.length = 0;

  // --- contour derivation ---------------------------------------------------

  {
    const polys = drawingToPolylines(rectShape(100, 60));
    const poly = polys[0] ?? [];
    check(
      "rectangle → one closed contour of 5 points",
      polys.length === 1 && poly.length === 5,
      `contours=${polys.length} points=${poly.length}`,
    );
    check(
      "rectangle perimeter = 2(w+h)",
      near(polylineLength(poly), 320, 1e-9),
      `${polylineLength(poly)}`,
    );
    check(
      "rectangle closes back on its origin",
      poly.length === 5 &&
        near(poly[0].x, poly[4].x) &&
        near(poly[0].y, poly[4].y),
      "",
    );
  }

  {
    // The same rectangle expressed as a Path must give the SAME
    // arc-length space — this is what lets the fog editor's traced
    // outline and a hand-drawn shape share one door model.
    const path = baseItem({
      type: "PATH",
      fillRule: "evenodd",
      commands: [
        [Command.MOVE, 0, 0],
        [Command.LINE, 100, 0],
        [Command.LINE, 100, 60],
        [Command.LINE, 0, 60],
        [Command.CLOSE],
      ],
      style: {
        fillColor: "#000",
        fillOpacity: 0,
        strokeColor: "#000",
        strokeOpacity: 1,
        strokeWidth: 10,
        strokeDash: [],
      },
    }) as Path;
    const poly = drawingToPolylines(path)[0] ?? [];
    check(
      "path rectangle matches shape rectangle",
      poly.length === 5 && near(polylineLength(poly), 320, 1e-9),
      `points=${poly.length} len=${polylineLength(poly)}`,
    );
  }

  {
    const line = baseItem({
      type: "LINE",
      startPosition: { x: 0, y: 0 },
      endPosition: { x: 30, y: 40 },
      style: {
        strokeColor: "#000",
        strokeOpacity: 1,
        strokeWidth: 8,
        strokeDash: [],
      },
    }) as Line;
    const poly = drawingToPolylines(line)[0] ?? [];
    check(
      "line → 2 points, length 50",
      poly.length === 2 && near(polylineLength(poly), 50, 1e-9),
      `points=${poly.length} len=${polylineLength(poly)}`,
    );
  }

  {
    const circle = baseItem({
      type: "SHAPE",
      shapeType: "CIRCLE",
      width: 200,
      height: 200,
      style: {
        fillColor: "#000",
        fillOpacity: 0,
        strokeColor: "#000",
        strokeOpacity: 1,
        strokeWidth: 10,
        strokeDash: [],
      },
    }) as Shape;
    const poly = drawingToPolylines(circle)[0] ?? [];
    const perimeter = polylineLength(poly);
    const exact = 2 * Math.PI * 100;
    check(
      "circle perimeter within 0.5% of 2πr",
      Math.abs(perimeter - exact) / exact < 0.005,
      `${perimeter.toFixed(2)} vs ${exact.toFixed(2)}`,
    );
  }

  {
    const curve = baseItem({
      type: "CURVE",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      style: {
        fillColor: "#000",
        fillOpacity: 0,
        strokeColor: "#000",
        strokeOpacity: 1,
        strokeWidth: 10,
        strokeDash: [],
        tension: 0,
        closed: true,
      },
    }) as Curve;
    const poly = drawingToPolylines(curve)[0] ?? [];
    check(
      "closed zero-tension curve → polygon through its points",
      poly.length === 5 && near(polylineLength(poly), 400, 1e-9),
      `points=${poly.length} len=${polylineLength(poly)}`,
    );

    const smooth = cardinalSplineToCommands(curve.points, 0.5, true);
    check(
      "tensioned spline emits cubic segments and closes",
      smooth.some((c) => c[0] === Command.CUBIC) &&
        smooth[smooth.length - 1][0] === Command.CLOSE,
      `commands=${smooth.length}`,
    );
    const smoothPoly = commandsToPolylines(smooth)[0] ?? [];
    check(
      "tensioned spline samples into a closed contour",
      smoothPoly.length > 5 &&
        near(smoothPoly[0].x, smoothPoly[smoothPoly.length - 1].x, 1e-6),
      `points=${smoothPoly.length}`,
    );
  }

  // --- arc-length addressing ------------------------------------------------

  {
    const poly = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const hit = snapToPolyline({ x: 25, y: 17 }, poly);
    check(
      "snap projects onto the segment and reports t",
      !!hit && near(hit.t, 0.25, 1e-9) && near(hit.distance, 17, 1e-9),
      hit ? `t=${hit.t} d=${hit.distance}` : "no hit",
    );
    const mid = pointAtT(poly, 0.5);
    check(
      "pointAtT walks arc length",
      !!mid && near(mid.x, 50) && near(mid.y, 0),
      mid ? `${mid.x},${mid.y}` : "null",
    );
    const sub = subPolyline(poly, 0.25, 0.75);
    check(
      "subPolyline extracts the requested stretch",
      sub.length === 2 && near(polylineLength(sub), 50, 1e-9),
      `len=${polylineLength(sub)}`,
    );
  }

  {
    // A door carved out of one wall of a 100×60 rectangle. The
    // rectangle's perimeter is 320, so a 40-unit door is t-width 0.125.
    const poly = drawingToPolylines(rectShape(100, 60))[0] ?? [];
    const pieces = splitPolylineByRanges(poly, [{ t1: 0.1, t2: 0.225 }]);
    const total = pieces.reduce((sum, p) => sum + polylineLength(p), 0);
    check(
      "open door removes exactly its stretch of wall",
      pieces.length === 2 && near(total, 320 - 40, 1e-6),
      `pieces=${pieces.length} remaining=${total}`,
    );
  }

  {
    const poly = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const pieces = splitPolylineByRanges(poly, [
      { t1: 0.2, t2: 0.4 },
      { t1: 0.35, t2: 0.5 },
    ]);
    const total = pieces.reduce((sum, p) => sum + polylineLength(p), 0);
    check(
      "overlapping openings merge instead of double-cutting",
      pieces.length === 2 && near(total, 70, 1e-6),
      `pieces=${pieces.length} remaining=${total}`,
    );
  }

  {
    const poly = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const shifted = poly.map((p) => ({ x: p.x, y: p.y + 5 }));
    check(
      "remapT survives a pure translation",
      near(remapT(poly, shifted, 0.3), 0.3, 1e-6),
      `${remapT(poly, shifted, 0.3)}`,
    );
    check(
      "remapT falls back when vertex counts differ",
      near(remapT(poly, [...shifted, { x: 200, y: 5 }], 0.3), 0.3, 1e-9),
      "",
    );
  }

  // --- cross-drawing cuts ---------------------------------------------------

  {
    // A wall along y=0 and a door owned by a DIFFERENT drawing sitting
    // across it at x≈50 with radius 15 — the overlapping-fog-shapes case
    // upstream gets from Skia path ops.
    const wall = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const cutPoints = [
      { x: 50, y: -20 },
      { x: 50, y: 20 },
    ];
    const cut: Cut = {
      openingId: "o",
      parentId: "other",
      points: cutPoints,
      radius: 15,
      bbox: bboxOf(cutPoints, 15),
    };
    const ranges = cutRangesForPolyline(wall, [cut]);
    const pieces = splitPolylineByRanges(wall, ranges);
    const total = pieces.reduce((sum, p) => sum + polylineLength(p), 0);
    check(
      "a door on an overlapping shape cuts this wall too",
      ranges.length === 1 && pieces.length === 2 && Math.abs(total - 70) < 1.0,
      `ranges=${ranges.length} pieces=${pieces.length} remaining=${total.toFixed(2)}`,
    );

    const far: Cut = {
      openingId: "o2",
      parentId: "other",
      points: [
        { x: 500, y: -20 },
        { x: 500, y: 20 },
      ],
      radius: 15,
      bbox: bboxOf(
        [
          { x: 500, y: -20 },
          { x: 500, y: 20 },
        ],
        15,
      ),
    };
    check(
      "a distant door leaves the wall alone",
      cutRangesForPolyline(wall, [far]).length === 0,
      "",
    );
  }

  // --- metadata reading -----------------------------------------------------

  {
    const item = baseItem({
      metadata: {
        "com.obr-suite/fullFog/openings": [
          {
            id: "a",
            kind: "window",
            open: true,
            polyIndex: 0,
            t1: 0.1,
            t2: 0.2,
          },
          { kind: "door", open: false, polyIndex: 0, t1: 0.5, t2: 0.6 },
          { kind: "door", open: false, polyIndex: "nope", t1: 0, t2: 1 },
        ],
      },
    });
    const openings = readOpenings(item);
    check(
      "openings read, malformed entries dropped, missing ids synthesised",
      openings.length === 2 &&
        openings[0].kind === "window" &&
        openings[1].id === "legacy-1",
      JSON.stringify(openings.map((o) => o.id)),
    );
  }

  {
    // Upstream shape: absolute arc length on a contour of length 320.
    const item = baseItem({
      metadata: {
        "rodeo.owlbear.dynamic-fog/doors": [
          {
            open: true,
            start: { distance: 32, index: 0 },
            end: { distance: 64, index: 0 },
          },
        ],
      },
    });
    const poly = drawingToPolylines(rectShape(100, 60))[0] ?? [];
    const openings = readOpenings(item, [poly]);
    check(
      "upstream dynamic-fog doors convert to normalised t",
      openings.length === 1 &&
        near(openings[0].t1, 0.1, 1e-9) &&
        near(openings[0].t2, 0.2, 1e-9) &&
        openings[0].open === true,
      JSON.stringify(openings),
    );
  }

  return results.slice();
}

/** Console-friendly summary. Returns true when everything passed. */
export function reportDynfogSelfTest(): boolean {
  const all = runDynfogSelfTest();
  let failed = 0;
  for (const result of all) {
    if (!result.ok) failed++;
    const mark = result.ok ? "PASS" : "FAIL";
    const suffix = result.detail ? `  (${result.detail})` : "";
    console.log(`${mark}  ${result.name}${suffix}`);
  }
  console.log(`\n${all.length - failed}/${all.length} passed`);
  return failed === 0;
}
