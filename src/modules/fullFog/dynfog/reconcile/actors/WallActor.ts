// One FOG-layer Drawing → N local `Wall` items.
//
// Walls live in `OBR.scene.local`, i.e. per client — they're never part
// of the shared scene. Every client derives them from the same shared
// drawings, so everyone agrees without any sync traffic.
//
// Pipeline:
//   1. contours from OpeningActor (drawing-local space)
//   2. optional 墙体外扩 offset (suite fog-editor output only)
//   3. subtract this drawing's own OPEN openings — exact, t-domain
//   4. subtract OPEN openings owned by OTHER drawings — world-space
//      proximity, so a door on a shared wall opens both fog shapes
//      (this is what upstream gets for free from its Skia path ops)
//   5. emit one Wall per resulting polyline
//
// Port of upstream `WallActor`.

import {
  buildWall,
  isWall,
  type Item,
  type Vector2,
  type Wall,
} from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";
import { isDrawing, type Drawing } from "../../geom/drawing";
import {
  remapT,
  splitPolylineByRanges,
  type TRange,
} from "../../geom/polyline";
import { cutRangesForPolyline, type Cut } from "../../geom/cut";
import {
  inverseTransformPoint,
  itemMatrix,
  matrixScaleFactor,
} from "../../geom/xform";
import { OpeningReactor } from "../reactors/OpeningReactor";
import { FOG_PATH_KEY, FOG_WALL_EXPAND_KEY } from "../../ids";
import { safeWallOffset } from "../../../output/wallOffset";
import { getSceneDpi } from "../../runtime";

export class WallActor extends Actor {
  private walls: string[] = [];
  private opening: OpeningReactor;
  /** Inputs hash of the last emitted geometry — skips redundant work
   *  when an unrelated fog item changes. */
  private signature = "";

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const opening = reconciler.find(OpeningReactor);
    if (!opening) {
      throw Error("WallActor requires an OpeningReactor to be registered first");
    }
    this.opening = opening;
    if (isDrawing(parent)) {
      const polylines = this.computePolylines(parent);
      this.signature = this.computeSignature(parent);
      const items = polylines.map((p) => this.polylineToWall(parent, p));
      this.walls = items.map((i) => i.id);
      if (items.length > 0) this.reconciler.patcher.addItems(...items);
    }
  }

  delete(): void {
    if (this.walls.length > 0) {
      this.reconciler.patcher.deleteItems(...this.walls);
    }
    this.walls = [];
  }

  update(parent: Item): void {
    if (!isDrawing(parent)) return;
    const signature = this.computeSignature(parent);
    if (signature === this.signature) return;
    this.signature = signature;

    const prev = this.walls;
    const next = this.computePolylines(parent);

    if (prev.length < next.length) {
      for (let i = prev.length; i < next.length; i++) {
        const wall = this.polylineToWall(parent, next[i]);
        prev.push(wall.id);
        this.reconciler.patcher.addItems(wall);
      }
    } else if (prev.length > next.length) {
      const removed = prev.splice(next.length, prev.length - next.length);
      if (removed.length > 0) this.reconciler.patcher.deleteItems(...removed);
    }

    // Walls that survive get their points (and the parent's transform,
    // which may have moved) patched in place.
    for (let i = 0; i < prev.length; i++) {
      const id = prev[i];
      const points = next[i];
      this.reconciler.patcher.updateItems([
        id,
        (item) => {
          if (!isWall(item)) return;
          item.points = points;
          item.position = parent.position;
          item.rotation = parent.rotation;
          item.scale = parent.scale;
        },
      ]);
    }
  }

  /** Everything that can change the emitted walls, cheaply hashed. */
  private computeSignature(parent: Item): string {
    const actor = this.opening.getActor(parent.id);
    const own = actor?.signature ?? "";
    // Foreign cuts are keyed by their owner + geometry via the reactor's
    // global signature; including it means a door toggled on ANY drawing
    // re-evaluates this one (bbox filtering later makes that cheap).
    return [
      parent.lastModified,
      parent.position.x,
      parent.position.y,
      parent.rotation,
      parent.scale.x,
      parent.scale.y,
      own,
      this.opening.getAllSignature(),
    ].join("|");
  }

  private computePolylines(parent: Drawing): Vector2[][] {
    const actor = this.opening.getActor(parent.id);
    const raw = actor?.polylines ?? [];
    if (raw.length === 0) return [];
    const openings = actor?.openings ?? [];

    // --- 2. 墙体外扩 (suite fog-editor only) -------------------------
    const expanded = this.applyWallExpand(parent, raw);
    const offsetApplied = expanded !== raw;

    // --- 4. foreign cuts, brought into this drawing's local space ----
    const foreign = this.opening.getForeignCuts(parent.id);
    const localCuts = foreign.length > 0 ? this.toLocalCuts(parent, foreign) : [];

    const out: Vector2[][] = [];
    for (let pi = 0; pi < expanded.length; pi++) {
      const poly = expanded[pi];
      if (poly.length < 2) continue;

      // --- 3. own openings, exactly, in the t-domain ----------------
      const ranges: TRange[] = [];
      for (const o of openings) {
        if (!o.open || o.polyIndex !== pi) continue;
        const source = raw[pi];
        if (offsetApplied && source) {
          ranges.push({
            t1: remapT(source, poly, o.t1),
            t2: remapT(source, poly, o.t2),
          });
        } else {
          ranges.push({ t1: o.t1, t2: o.t2 });
        }
      }
      if (localCuts.length > 0) {
        ranges.push(...cutRangesForPolyline(poly, localCuts));
      }

      if (ranges.length === 0) {
        out.push(poly);
        continue;
      }
      for (const piece of splitPolylineByRanges(poly, ranges)) out.push(piece);
    }
    return out;
  }

  /**
   * The fog editor stores `wallExpandPx` (in IMAGE pixels) on its
   * outline Path so the BLOCKING wall can sit inside or outside the
   * visible outline. Only that item carries the marker, so hand-drawn
   * fog is untouched.
   */
  private applyWallExpand(parent: Drawing, polys: Vector2[][]): Vector2[][] {
    const md = parent.metadata as Record<string, unknown> | undefined;
    if (!md || md[FOG_PATH_KEY] !== true) return polys;
    const expandImgPx = Number(md[FOG_WALL_EXPAND_KEY] ?? 0);
    if (!Number.isFinite(expandImgPx) || expandImgPx === 0) return polys;

    // The Path's commands live in MAP-LOCAL units, which are
    // `imagePx × sceneDpi / imageGridDpi`. Recover that ratio from the
    // map the Path is attached to.
    const sceneDpi = getSceneDpi();
    const map = this.reconciler.getItem(parent.attachedTo) as any;
    const imgDpi = map?.grid?.dpi || sceneDpi;
    const ratio = imgDpi > 0 ? sceneDpi / imgDpi : 1;
    const expandLocal = expandImgPx * ratio;

    // `safeWallOffset` wants N distinct vertices; our closed contours
    // repeat the first point at the end. Strip, offset, re-append.
    const stripped = polys.map((p) => {
      if (p.length >= 3) {
        const first = p[0];
        const last = p[p.length - 1];
        if (
          Math.abs(first.x - last.x) < 1e-6 &&
          Math.abs(first.y - last.y) < 1e-6
        ) {
          return p.slice(0, -1);
        }
      }
      return p;
    });
    const offset = safeWallOffset(stripped, expandLocal, ratio);
    return offset.map((p, i) => {
      // Re-close only the contours that were closed to begin with, so
      // vertex counts stay 1:1 with `polys` for `remapT`.
      const wasClosed = stripped[i]?.length !== polys[i]?.length;
      return wasClosed && p.length >= 1
        ? [...p, { x: p[0].x, y: p[0].y }]
        : p;
    });
  }

  /** Re-express world-space cuts in the parent's local units so the
   *  proximity test runs in the same space as the polylines. */
  private toLocalCuts(parent: Drawing, cuts: Cut[]): Cut[] {
    const matrix = itemMatrix(parent);
    const scale = matrixScaleFactor(matrix) || 1;
    return cuts.map((cut) => {
      const points = cut.points.map((p) => inverseTransformPoint(matrix, p));
      const radius = cut.radius / scale;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return {
        ...cut,
        points,
        radius,
        bbox: Number.isFinite(minX)
          ? {
              minX: minX - radius,
              minY: minY - radius,
              maxX: maxX + radius,
              maxY: maxY + radius,
            }
          : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      };
    });
  }

  private polylineToWall(parent: Drawing, points: Vector2[]): Wall {
    return buildWall()
      .points(points)
      .doubleSided(true)
      .blocking(true)
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .scale(parent.scale)
      .disableAttachmentBehavior(["VISIBLE", "COPY"])
      .build();
  }
}
