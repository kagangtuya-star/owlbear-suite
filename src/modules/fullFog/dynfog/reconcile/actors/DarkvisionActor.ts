// Darkvision — colour up close, greyscale out to the edge of the light.
//
// D&D's darkvision lets you see in the dark, but not in colour. A light
// carrying `colorRadius` renders a ring `EFFECT` over itself: fully
// transparent inside `colorRadius`, opaque from there out to
// `attenuationRadius`.
//
// The trick is the blend mode. Skia's SATURATION takes the SATURATION
// of the source and the hue + luminosity of the backdrop, so painting a
// neutral grey over the map drains the colour out of it while leaving
// every brightness and detail intact. No sampling, no second render
// pass, one shader.
//
// Known approximations, both harmless in practice:
//   * The ring ignores walls, so it desaturates through them. Anything
//     behind a wall is under fog anyway, and desaturated black is
//     black.
//   * Two darkvision tokens overlapping stack their rings; the second
//     one has nothing left to desaturate, so it is a no-op.
//
// EFFECT items are rejected by `OBR.scene.items.addItems` — they can
// only be added to the LOCAL scene, which is exactly where every dynfog
// child lives anyway. That also makes darkvision correctly per-client:
// your greyscale is yours.

import { buildEffect, type Effect, type Item } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";
import { LIGHT_KEY } from "../../ids";
import { normaliseLightConfig, withDefaults } from "../../light/config";
import { getSceneDpi } from "../../runtime";

/**
 * `coord` runs 0..iSize over the effect's own box, so the centre is at
 * iSize/2 and the outer radius is exactly half the box.
 *
 * The output is PREMULTIPLIED, hence `grey * a` rather than `grey`. Any
 * neutral value works — SATURATION reads only the source's saturation,
 * which is zero for every grey — so 0.5 is arbitrary but honest.
 *
 * `smoothstep` over the last stretch before `rInner` keeps the boundary
 * from crawling with jagged pixels as the token moves.
 */
const DARKVISION_SKSL = `uniform vec2 iSize;
uniform float rInner;
uniform float rOuter;
uniform float feather;

half4 main(float2 coord) {
  vec2 centre = iSize * 0.5;
  float d = distance(coord, centre);
  // Outside the light entirely: nothing to drain, and leaving it clear
  // stops the ring from greying out map the token cannot light at all.
  if (d > rOuter) return half4(0.0);
  float a = smoothstep(rInner, rInner + feather, d);
  return half4(0.5 * a, 0.5 * a, 0.5 * a, a);
}`;

/** Width of the colour→greyscale transition, as a fraction of a grid
 *  cell. Purely cosmetic; a hard edge reads as a rendering bug. */
const FEATHER_CELLS = 0.12;

interface Geometry {
  /** Half the effect box = the outer (greyscale) radius. */
  outer: number;
  /** Colour survives inside this. */
  inner: number;
  feather: number;
}

/** Null when this item should not have a darkvision ring at all. */
export function darkvisionGeometry(parent: Item): Geometry | null {
  const raw = (parent.metadata as Record<string, unknown> | undefined)?.[
    LIGHT_KEY
  ];
  const config = normaliseLightConfig(raw);
  if (!config) return null;
  const full = withDefaults(config, getSceneDpi());
  const inner = full.colorRadius;
  const outer = full.attenuationRadius;
  // 0 disables it; an inner radius at or past the light's own reach
  // means everything it lights is in colour, i.e. also disabled.
  if (!(inner > 0) || !(outer > inner)) return null;
  return {
    outer,
    inner,
    feather: Math.max(2, getSceneDpi() * FEATHER_CELLS),
  };
}

export class DarkvisionActor extends Actor {
  private effect: string | null = null;
  /** Geometry the current effect item was built with. Effects are not
   *  patchable in place for width/height (Owlbear's partial-update path
   *  does not propagate those to the renderer), so a size change means
   *  delete + re-add. */
  private built: Geometry | null = null;

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    this.rebuild(parent);
  }

  delete(): void {
    if (this.effect) this.reconciler.patcher.deleteItems(this.effect);
    this.effect = null;
    this.built = null;
  }

  update(parent: Item): void {
    this.rebuild(parent);
  }

  private rebuild(parent: Item): void {
    const geometry = darkvisionGeometry(parent);
    if (!geometry) {
      this.delete();
      return;
    }
    if (
      this.effect &&
      this.built &&
      this.built.outer === geometry.outer &&
      this.built.inner === geometry.inner &&
      this.built.feather === geometry.feather
    ) {
      // Same size: position rides along on the POSITION attachment, so
      // only `visible` can still be stale.
      const visible = parent.visible;
      this.reconciler.patcher.updateItems([
        this.effect,
        (item) => {
          if (item.visible !== visible) item.visible = visible;
        },
      ]);
      return;
    }
    if (this.effect) this.reconciler.patcher.deleteItems(this.effect);
    const item = this.build(parent, geometry);
    this.effect = item.id;
    this.built = geometry;
    this.reconciler.patcher.addItems(item);
  }

  private build(parent: Item, geometry: Geometry): Effect {
    const size = geometry.outer * 2;
    return buildEffect()
      .effectType("STANDALONE")
      .blendMode("SATURATION")
      .width(size)
      .height(size)
      .sksl(DARKVISION_SKSL)
      .uniforms([
        { name: "iSize", value: { x: size, y: size } },
        { name: "rInner", value: geometry.inner },
        { name: "rOuter", value: geometry.outer },
        { name: "feather", value: geometry.feather },
      ])
      // `position` is the box's TOP-LEFT in scene units, so centring on
      // the token means backing off by the radius on both axes.
      .position({
        x: parent.position.x - geometry.outer,
        y: parent.position.y - geometry.outer,
      })
      .attachedTo(parent.id)
      // Above the fog, below the CONTROL layer's UI, so it drains
      // colour from the map, the tokens and the fog alike but never
      // from a tool overlay.
      .layer("POST_PROCESS")
      .disableAttachmentBehavior(["SCALE", "ROTATION", "COPY", "LOCKED"])
      .disableAutoZIndex(true)
      .zIndex(1)
      .disableHit(true)
      .locked(true)
      .visible(parent.visible)
      .build();
  }
}
