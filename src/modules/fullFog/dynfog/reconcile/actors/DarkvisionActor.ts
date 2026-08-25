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
// The ring lives on the ATTACHMENT layer. See `build()` for why that
// matters more than it looks like it should.
//
// EFFECT items are rejected by `OBR.scene.items.addItems` — they can
// only be added to the LOCAL scene, which is exactly where every dynfog
// child lives anyway. That also makes darkvision correctly per-client:
// your greyscale is yours.

import {
  buildEffect,
  type Effect,
  type Item,
  type Vector2,
} from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";
import { LIGHT_KEY } from "../../ids";
import { normaliseLightConfig, withDefaults } from "../../light/config";
import { getSceneDpi } from "../../runtime";

/**
 * `coord` runs 0..iSize across the effect's own box in SCENE units, so
 * the centre sits at iSize/2 and the outer radius is exactly half the
 * box. Declaration style (`float2`, an explicitly-passed `iSize`) is
 * copied from `bubbles`' HP shimmer, the shader in this codebase with
 * the most mileage on it.
 *
 * The output is PREMULTIPLIED, hence `grey * a` rather than `grey`. Any
 * neutral value works — SATURATION reads only the source's saturation,
 * which is zero for every grey — so 0.5 is arbitrary but honest.
 *
 * If the uniforms ever fail to bind they all read 0, and `d > rOuter`
 * then makes every pixel transparent. That is deliberate: the failure
 * mode is "darkvision does nothing", never "the whole screen is grey".
 */
const DARKVISION_SKSL = `uniform float2 iSize;
uniform float rInner;
uniform float rOuter;
uniform float feather;

half4 main(float2 coord) {
  float2 centre = iSize * 0.5;
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
    // Owlbear is documented in two directions on what it does to an
    // attached item's position at add time — `initiative/visualEffects`
    // relies on it snapping to the parent, `bubbles` relies on it
    // keeping the absolute value it was given. The Patcher flushes adds
    // before updates, so re-stating the position here settles it either
    // way, and it costs one field write per rebuild.
    this.reconciler.patcher.updateItems([
      item.id,
      (existing) => {
        existing.position = this.topLeft(parent, geometry);
      },
    ]);
  }

  /** The effect box is a 2R square centred on the token, and `position`
   *  is its top-left corner in scene units. */
  private topLeft(parent: Item, geometry: Geometry): Vector2 {
    return {
      x: parent.position.x - geometry.outer,
      y: parent.position.y - geometry.outer,
    };
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
      .position(this.topLeft(parent, geometry))
      .attachedTo(parent.id)
      // ATTACHMENT, not POST_PROCESS.
      //
      // POST_PROCESS is exactly what it sounds like: Owlbear runs those
      // over the finished frame in VIEWPORT space, which throws away
      // the world-space box this shader is built around. `coord` then
      // ran across the screen instead of across the light, the centre
      // landed off-screen, and every pixel came out past rInner — which
      // is why the first cut greyed the entire view the moment
      // darkvision was switched on, with no colour disc anywhere.
      //
      // ATTACHMENT is world-space and sits above MAP and CHARACTER, so
      // the ring drains colour from the terrain and the tokens, which
      // is the whole job. It sits BELOW fog, and that is correct too:
      // fog is opaque black, and desaturated black is black.
      .layer("ATTACHMENT")
      .disableAttachmentBehavior(["SCALE", "ROTATION", "COPY", "LOCKED"])
      // Bottom of the attachment layer. A blend mode only affects what
      // was drawn BEFORE it, so drawing first is what keeps HP bars,
      // buff bubbles and the rest of the attachment layer in colour.
      .disableAutoZIndex(true)
      .zIndex(0)
      .disableHit(true)
      .locked(true)
      .visible(parent.visible)
      .build();
  }
}
