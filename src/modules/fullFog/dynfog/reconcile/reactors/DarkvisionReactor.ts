// Owns one DarkvisionActor per light that has a colour radius.
//
// Whose darkvision applies is a per-client question, and the answer is
// "mine". A ring is only built for items THIS client owns, because the
// greyscale is a statement about what the viewer can perceive — an
// ally's darkvision has no business draining the colour out of your
// screen.
//
// The GM owns every NPC in the scene, so applying the same rule to them
// would grey out most of the map. They are exempt unless they ask for
// it (`fogDarkvisionForGM`), which is how you preview what a player is
// about to see.

import type { Item } from "@owlbear-rodeo/sdk";
import { Reactor } from "../Reactor";
import type { Reconciler } from "../Reconciler";
import { DarkvisionActor, darkvisionGeometry } from "../actors/DarkvisionActor";
import { LIGHT_KEY } from "../../ids";
import { getDarkvisionForGM, getPlayerId, isGM } from "../../runtime";

export class DarkvisionReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, DarkvisionActor);
  }

  filter(item: Item): boolean {
    if (!(LIGHT_KEY in item.metadata)) return false;
    if (isGM()) {
      if (!getDarkvisionForGM()) return false;
    } else if (item.createdUserId !== getPlayerId()) {
      return false;
    }
    return darkvisionGeometry(item) !== null;
  }
}
