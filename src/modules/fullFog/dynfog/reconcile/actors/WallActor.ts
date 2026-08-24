// One FOG-layer Drawing → N local `Wall` items.
//
// Walls live in `OBR.scene.local`, i.e. per client — they're never part
// of the shared scene. Every client derives them from the same shared
// drawings, so everyone agrees without any sync traffic.
//
// The geometry itself lives in `geom/wallGeometry.ts`; this class is the
// item plumbing around it. Port of upstream `WallActor`.

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
import { deriveWallPolylines } from "../../geom/wallGeometry";
import type { Cut } from "../../geom/cut";
import {
  inverseTransformPoint,
  itemMatrix,
  matrixScaleFactor,
} from "../../geom/xform";
import { OpeningReactor } from "../reactors/OpeningReactor";
import {
  FOG_PATH_KEY,
  FOG_WALL_EXPAND_KEY,
  FOG_WALL_EXPAND_LOCAL_KEY,
} from "../../ids";
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

    // Walls that survive get their points — and the parent's transform,
    // which may have moved — patched in place.
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
    return [
      parent.lastModified,
      parent.position.x,
      parent.position.y,
      parent.rotation,
      parent.scale.x,
      parent.scale.y,
      actor?.signature ?? "",
      // A door toggled on ANY drawing must re-evaluate this one, since
      // openings cut across overlapping fog shapes. Bounding-box
      // filtering inside the cut maths keeps that cheap.
      this.opening.getAllSignature(),
    ].join("|");
  }

  private computePolylines(parent: Drawing): Vector2[][] {
    const actor = this.opening.getActor(parent.id);
    const raw = actor?.polylines ?? [];
    if (raw.length === 0) return [];

    const { expandLocal, expandMinPx } = this.wallExpand(parent);
    const foreign = this.opening.getForeignCuts(parent.id);

    return deriveWallPolylines({
      polylines: raw,
      openings: actor?.openings ?? [],
      foreignCuts: foreign.length > 0 ? this.toLocalCuts(parent, foreign) : [],
      expandLocal,
      expandMinPx,
    });
  }

  /**
   * The fog editor stores `wallExpandPx` (in IMAGE pixels) on its
   * outline Path so the BLOCKING wall can sit inside or outside the
   * visible outline. Only that item carries the marker, so hand-drawn
   * fog is untouched.
   */
  private wallExpand(parent: Drawing): {
    expandLocal: number;
    expandMinPx: number;
  } {
    const md = parent.metadata as Record<string, unknown> | undefined;
    if (!md || md[FOG_PATH_KEY] !== true) {
      return { expandLocal: 0, expandMinPx: 1 };
    }

    // Preferred: the editor already converted it (saves since
    // 2026-08-25). Works for bound and unbound saves alike.
    const local = Number(md[FOG_WALL_EXPAND_LOCAL_KEY]);
    if (Number.isFinite(local) && local !== 0) {
      return { expandLocal: local, expandMinPx: 1 };
    }

    const expandImgPx = Number(md[FOG_WALL_EXPAND_KEY] ?? 0);
    if (!Number.isFinite(expandImgPx) || expandImgPx === 0) {
      return { expandLocal: 0, expandMinPx: 1 };
    }
    // Legacy: the value is in IMAGE pixels while the Path's commands
    // are in MAP-LOCAL units (`imagePx × sceneDpi / imageGridDpi`), so
    // the ratio has to come from the map the Path is attached to.
    const sceneDpi = getSceneDpi();
    const map = this.reconciler.getItem(parent.attachedTo) as any;
    const imgDpi = map?.grid?.dpi || sceneDpi;
    const ratio = imgDpi > 0 ? sceneDpi / imgDpi : 1;
    return { expandLocal: expandImgPx * ratio, expandMinPx: ratio };
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
