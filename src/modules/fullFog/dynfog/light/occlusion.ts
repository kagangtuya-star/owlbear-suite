// Which lights may this client see?
//
// Owlbear renders every `Light` item in the local scene, so without
// this pass a player sees the glow of every torch in the dungeon —
// including the one an ambushing NPC is carrying three rooms away. Ugly
// in the best case, an information leak in the worst.
//
// The rule, per the GM's brief: a light belonging to someone else is
// hidden UNLESS a straight line from one of your own lights to it is
// unobstructed by a wall. Distance is deliberately not part of it —
// "can I see that lit thing from here" is a line-of-sight question, and
// a torch across a wide-open field is a torch you can see.
//
//   own light                    always visible
//   ambient light                always visible (fixed room lighting —
//                                sconces, braziers, daylight; the GM
//                                sets the flag per light)
//   any other light              visible iff some own, visible light
//                                has clear line of sight to it
//
// Consequences worth knowing:
//   * A player carrying no light sees no foreign lights at all, except
//     ambient ones. That is the intended reading of the rule, and it is
//     why `ambient` exists.
//   * Reachability is NOT transitive: a chain of NPC torches down a
//     corridor lights up one link at a time as you get line of sight to
//     each. The GM signed off on that simplification.
//   * The GM is exempt — they see everything, always.
//
// The pass runs after every reconcile (see `Reconciler.onAfterReconcile`),
// which is once per committed token move; Owlbear does not publish item
// changes mid-drag, so nothing here runs on a per-frame path.

import type { Reconciler } from "../reconcile/Reconciler";
import { LightReactor, SelfLightReactor } from "../reconcile/reactors/LightReactor";
import { WallReactor } from "../reconcile/reactors/WallReactor";
import {
  getLightOcclusionEnabled,
  getPlayerId,
  getSceneDpi,
  isGM,
} from "../runtime";
import { EMPTY_WALL_INDEX, WallIndex } from "./wallIndex";

/**
 * How far into the sight line to ignore walls, as a fraction of one
 * grid cell. A wall sconce token sits ON the wall it hangs from, and a
 * torchbearer standing in a doorway sits between two wall stubs —
 * without this both would be permanently self-occluded.
 */
const TRIM_CELLS = 0.18;

export class LightOcclusion {
  private reconciler: Reconciler;
  private index: WallIndex = EMPTY_WALL_INDEX;
  /** `WallReactor.geometrySignature()` the index was built from. null
   *  means "no index held". */
  private indexSignature: string | null = null;

  constructor(reconciler: Reconciler) {
    this.reconciler = reconciler;
  }

  /** Drop the cached index — call when occlusion is switched off or the
   *  engine is torn down, so a big traced map is not pinned in memory. */
  reset(): void {
    this.index = EMPTY_WALL_INDEX;
    this.indexSignature = null;
  }

  run(): void {
    const lights = this.reconciler.find(LightReactor);
    if (!lights) return;
    const actors = lights.getActors();
    const selfLights = this.reconciler.find(SelfLightReactor)?.getActors() ?? [];
    if (actors.length === 0 && selfLights.length === 0) return;

    // GM sees everything; so does everyone when the feature is off.
    // Both paths must actively re-allow, not just skip — the setting
    // can be turned off while lights are already hidden.
    if (isGM() || !getLightOcclusionEnabled()) {
      for (const actor of actors) actor.setAllowed(true);
      for (const actor of selfLights) actor.setAllowed(true);
      this.reset();
      return;
    }

    const me = getPlayerId();
    const own = actors.filter(
      (actor) => actor.ownerId === me && actor.parentVisible,
    );
    const index = this.ensureIndex();
    const trim = getSceneDpi() * TRIM_CELLS;

    const verdict = new Map<string, boolean>();
    for (const actor of actors) {
      const allowed =
        actor.ownerId === me ||
        actor.ambient ||
        own.some((source) => !index.blocked(source.position, actor.position, trim));
      actor.setAllowed(allowed);
      verdict.set(actor.parentId, allowed);
    }

    // A self light has no config of its own — it rides on whatever its
    // parent's main light was allowed. Defaulting to true covers the
    // impossible case of a self light without a main light.
    for (const actor of selfLights) {
      actor.setAllowed(verdict.get(actor.parentId) ?? true);
    }
  }

  private ensureIndex(): WallIndex {
    const walls = this.reconciler.find(WallReactor);
    if (!walls) return EMPTY_WALL_INDEX;
    const signature = walls.geometrySignature();
    if (this.indexSignature === signature) return this.index;
    this.index = WallIndex.build(walls.worldPolylines());
    this.indexSignature = signature;
    return this.index;
  }
}
