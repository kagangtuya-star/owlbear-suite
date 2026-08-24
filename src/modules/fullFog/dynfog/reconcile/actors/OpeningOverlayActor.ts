// Visual indicators for every opening on one FOG-layer Drawing:
// a coloured stretch of wall plus a clickable billboard at its centre.
//
// Port of upstream `DoorOverlayActor`, extended for windows and for the
// player-facing mode:
//
//   GM      → CONTROL layer. Sits above FOG so the GM can always see
//             and click every opening, including ones inside their own
//             unexplored fog.
//   PLAYER  → DRAWING layer. Sits below FOG so the dynamic fog occludes
//             indicators the party hasn't discovered — otherwise every
//             door in the dungeon would leak the floor plan.
//
// Items stay `locked` so they can't be dragged out of sync with their
// parent; tool events still hit locked items, which is how both the
// GM's door mode and the player's toggle tool click them.
//
// Entries are keyed by `Opening.id` and patched in place, so toggling a
// door recolours it rather than deleting and re-adding the billboard
// (upstream keys by array index, which mismatches billboard and path
// whenever a door in the middle of the array is deleted).

import {
  buildBillboard,
  buildPath,
  Command,
  isBillboard,
  isPath,
  type Item,
  type PathCommand,
  type Vector2,
} from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";
import { isDrawing, type Drawing } from "../../geom/drawing";
import { pointAtT, subPolyline } from "../../geom/polyline";
import { itemMatrix, transformPoint } from "../../geom/xform";
import { OpeningReactor } from "../reactors/OpeningReactor";
import { openingImage } from "../../overlayAssets";
import {
  COLOR_DOOR_CLOSED,
  COLOR_DOOR_OPEN,
  COLOR_WINDOW_CLOSED,
  COLOR_WINDOW_OPEN,
  OVERLAY_OPENING_KEY,
} from "../../ids";
import type { Opening } from "../../opening/types";
import { isGM } from "../../runtime";

/** Minimum stroke width for the indicator so a hairline fog shape
 *  still produces something clickable. */
const MIN_STROKE = 8;

export function openingColor(opening: Opening): string {
  if (opening.kind === "window") {
    return opening.open ? COLOR_WINDOW_OPEN : COLOR_WINDOW_CLOSED;
  }
  return opening.open ? COLOR_DOOR_OPEN : COLOR_DOOR_CLOSED;
}

interface OverlayEntry {
  billboard: string;
  path: string;
  layer: string;
}

/** Everything about one opening that the overlay draws. */
interface Visual {
  opening: Opening;
  /** Indicator path, in the parent's local space. */
  commands: PathCommand[];
  /** Billboard position, in world space. */
  centre: Vector2;
  color: string;
}

export class OpeningOverlayActor extends Actor {
  private entries: Map<string, OverlayEntry> = new Map();
  private opening: OpeningReactor;
  private signature = "";

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const opening = reconciler.find(OpeningReactor);
    if (!opening) {
      throw Error(
        "OpeningOverlayActor requires an OpeningReactor to be registered first",
      );
    }
    this.opening = opening;
    if (isDrawing(parent)) this.rebuild(parent);
  }

  delete(): void {
    const ids = [...this.entries.values()].flatMap((e) => [e.billboard, e.path]);
    if (ids.length > 0) this.reconciler.patcher.deleteItems(...ids);
    this.entries.clear();
    this.signature = "";
  }

  update(parent: Item): void {
    if (!isDrawing(parent)) return;
    this.rebuild(parent);
  }

  private rebuild(parent: Drawing) {
    const actor = this.opening.getActor(parent.id);
    const openings = actor?.openings ?? [];
    const polylines = actor?.polylines ?? [];
    const layer = isGM() ? "CONTROL" : "DRAWING";
    const signature = [
      actor?.signature ?? "",
      parent.position.x,
      parent.position.y,
      parent.rotation,
      parent.scale.x,
      parent.scale.y,
      (parent as any).style?.strokeWidth ?? 0,
      parent.lastModified,
      layer,
    ].join("|");
    if (signature === this.signature) return;
    this.signature = signature;

    const matrix = itemMatrix(parent);
    const strokeWidth = Math.max(
      MIN_STROKE,
      (parent as any).style?.strokeWidth ?? 0,
    );

    const visuals: Visual[] = [];
    for (const opening of openings) {
      const poly = polylines[opening.polyIndex];
      if (!poly) continue;
      const t1 = Math.min(opening.t1, opening.t2);
      const t2 = Math.max(opening.t1, opening.t2);
      const local = subPolyline(poly, t1, t2);
      const centreLocal = pointAtT(poly, (t1 + t2) / 2);
      if (local.length < 2 || !centreLocal) continue;
      visuals.push({
        opening,
        commands: polylineToCommands(local),
        centre: transformPoint(matrix, centreLocal),
        color: openingColor(opening),
      });
    }

    // Drop entries whose opening is gone (or whose layer changed, which
    // means the role flipped and the items must be recreated).
    const wanted = new Set(visuals.map((v) => v.opening.id));
    for (const [id, entry] of [...this.entries]) {
      if (!wanted.has(id) || entry.layer !== layer) {
        this.reconciler.patcher.deleteItems(entry.billboard, entry.path);
        this.entries.delete(id);
      }
    }

    for (const visual of visuals) {
      const existing = this.entries.get(visual.opening.id);
      if (existing) {
        this.patch(parent, visual, existing, strokeWidth);
      } else {
        this.create(parent, visual, layer, strokeWidth);
      }
    }
  }

  private patch(
    parent: Drawing,
    visual: Visual,
    entry: OverlayEntry,
    strokeWidth: number,
  ) {
    this.reconciler.patcher.updateItems(
      [
        entry.path,
        (item) => {
          item.position = parent.position;
          item.rotation = parent.rotation;
          item.scale = parent.scale;
          if (isPath(item)) {
            item.commands = visual.commands;
            item.style.strokeColor = visual.color;
            item.style.strokeWidth = strokeWidth;
          }
        },
      ],
      [
        entry.billboard,
        (item) => {
          item.position = visual.centre;
          if (isBillboard(item)) {
            item.image = openingImage(
              visual.opening.kind,
              visual.opening.open,
            );
          }
        },
      ],
    );
  }

  private create(
    parent: Drawing,
    visual: Visual,
    layer: string,
    strokeWidth: number,
  ) {
    const path = buildPath()
      .commands(visual.commands)
      .fillOpacity(0)
      .strokeColor(visual.color)
      .strokeOpacity(1)
      .strokeWidth(strokeWidth)
      .layer(layer as any)
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .scale(parent.scale)
      .disableAttachmentBehavior(["VISIBLE", "COPY"])
      .metadata({ [OVERLAY_OPENING_KEY]: visual.opening.id })
      .locked(true)
      .build();

    const billboard = buildBillboard(
      openingImage(visual.opening.kind, visual.opening.open),
      { dpi: 300, offset: { x: 40, y: 40 } },
    )
      .attachedTo(parent.id)
      .position(visual.centre)
      .layer(layer as any)
      .disableAttachmentBehavior(["SCALE", "VISIBLE", "COPY"])
      .metadata({ [OVERLAY_OPENING_KEY]: visual.opening.id })
      .maxViewScale(2)
      .locked(true)
      .build();

    this.entries.set(visual.opening.id, {
      billboard: billboard.id,
      path: path.id,
      layer,
    });
    this.reconciler.patcher.addItems(path, billboard);
  }
}

function polylineToCommands(points: Vector2[]): PathCommand[] {
  const out: PathCommand[] = [];
  if (points.length === 0) return out;
  out.push([Command.MOVE, points[0].x, points[0].y]);
  for (let i = 1; i < points.length; i++) {
    out.push([Command.LINE, points[i].x, points[i].y]);
  }
  return out;
}
