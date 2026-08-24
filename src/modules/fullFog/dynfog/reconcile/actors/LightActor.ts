// Any item carrying `LIGHT_KEY` → one native local `Light`.
//
// Native `Light` items are what Owlbear's own renderer raycasts against
// the `Wall` items, so light is clipped by walls, respects open doors,
// and reveals fog exactly like the built-in system. Port of upstream
// `LightActor`.

import { buildLight, isLight, type Item, type Light } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";
import { LIGHT_KEY } from "../../ids";
import { normaliseLightConfig, type LightConfig } from "../../light/config";

function readConfig(parent: Item): LightConfig {
  const raw = (parent.metadata as Record<string, unknown> | undefined)?.[
    LIGHT_KEY
  ];
  return normaliseLightConfig(raw) ?? {};
}

export class LightActor extends Actor {
  private light: string;

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const item = this.parentToLight(parent);
    this.light = item.id;
    this.reconciler.patcher.addItems(item);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light);
  }

  update(parent: Item): void {
    const config = readConfig(parent);
    this.reconciler.patcher.updateItems([
      this.light,
      (item) => {
        if (isLight(item)) applyLightConfig(parent, item, config);
      },
    ]);
  }

  private parentToLight(parent: Item): Light {
    const config = readConfig(parent);
    const light = buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .visible(parent.visible)
      // POSITION / ROTATION / VISIBLE inherit so the light tracks the
      // token during a drag without waiting for items.onChange. SCALE is
      // off so a 2× ogre doesn't get a 2× torch; COPY is off so
      // duplicating the token doesn't clone our local-only light.
      .disableAttachmentBehavior(["SCALE", "COPY"])
      .build();
    applyLightConfig(parent, light, config);
    return light;
  }
}

/** Shared by LightActor and its initial build — writes only the fields
 *  the config actually sets, leaving Owlbear's own defaults otherwise. */
export function applyLightConfig(
  parent: Item,
  light: Light,
  config: LightConfig,
): Light {
  if (
    config.attenuationRadius !== undefined &&
    config.attenuationRadius !== light.attenuationRadius
  ) {
    light.attenuationRadius = config.attenuationRadius;
  }
  if (
    config.sourceRadius !== undefined &&
    config.sourceRadius !== light.sourceRadius
  ) {
    light.sourceRadius = config.sourceRadius;
  }
  if (config.falloff !== undefined && config.falloff !== light.falloff) {
    light.falloff = config.falloff;
  }
  if (config.innerAngle !== undefined && config.innerAngle !== light.innerAngle) {
    light.innerAngle = config.innerAngle;
  }
  if (config.outerAngle !== undefined && config.outerAngle !== light.outerAngle) {
    light.outerAngle = config.outerAngle;
  }
  if (config.lightType !== undefined && config.lightType !== light.lightType) {
    light.lightType = config.lightType;
  }
  if (config.rotation !== undefined) {
    light.rotation = parent.rotation + config.rotation;
  }
  return light;
}
