// Port of upstream `WallReactor`.

import type { Item } from "@owlbear-rodeo/sdk";
import { Reactor } from "../Reactor";
import type { Reconciler } from "../Reconciler";
import { WallActor } from "../actors/WallActor";
import { OpeningReactor } from "./OpeningReactor";
import { isFogDrawing } from "../../geom/drawing";

export class WallReactor extends Reactor {
  private opening: OpeningReactor;

  constructor(reconciler: Reconciler) {
    super(reconciler, WallActor);
    const opening = reconciler.find(OpeningReactor);
    if (!opening) {
      throw Error("WallReactor requires an OpeningReactor to be registered first");
    }
    this.opening = opening;
  }

  filter(item: Item): boolean {
    return isFogDrawing(item);
  }

  diff(a: Item, b: Item): boolean {
    // Re-evaluate every wall whenever ANY opening changed: a door on one
    // fog shape can cut a wall belonging to another. WallActor's own
    // signature check makes the no-op case cheap.
    return super.diff(a, b) || this.opening.getDidUpdate();
  }
}
