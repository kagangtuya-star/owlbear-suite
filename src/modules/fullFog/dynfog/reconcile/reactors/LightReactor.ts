// Ports of upstream `LightReactor` + `SelfLightReactor`.

import type { Item } from "@owlbear-rodeo/sdk";
import { Reactor } from "../Reactor";
import type { Reconciler } from "../Reconciler";
import { LightActor } from "../actors/LightActor";
import { SelfLightActor } from "../actors/SelfLightActor";
import { LIGHT_KEY } from "../../ids";
import { normaliseLightConfig } from "../../light/config";

export class LightReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, LightActor);
  }

  filter(item: Item): boolean {
    return LIGHT_KEY in item.metadata;
  }
}

export class SelfLightReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, SelfLightActor);
  }

  filter(item: Item): boolean {
    if (!(LIGHT_KEY in item.metadata)) return false;
    const config = normaliseLightConfig(
      (item.metadata as Record<string, unknown>)[LIGHT_KEY],
    );
    if (!config) return false;
    // Only cone-shaped PRIMARY lights need a self light.
    return (
      config.outerAngle !== undefined &&
      config.outerAngle !== 360 &&
      (config.lightType === "PRIMARY" || config.lightType === undefined)
    );
  }
}
