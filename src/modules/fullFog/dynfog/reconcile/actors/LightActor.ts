// Any item carrying `LIGHT_KEY` → one native local `Light`.
//
// Native `Light` items are what Owlbear's own renderer raycasts against
// the `Wall` items, so light is clipped by walls, respects open doors,
// and reveals fog exactly like the built-in system. Port of upstream
// `LightActor`, plus the state `light/occlusion.ts` needs.
//
// VISIBLE attachment inheritance is deliberately DISABLED here. Two
// things decide whether this light renders — the parent token being
// visible, and (for a player) the light being reachable from one of
// their own lights without a wall in between — and Owlbear only knows
// about the first. So the actor owns `visible` outright and computes it
// from both.

import {
  buildLight,
  isLight,
  type Item,
  type Light,
  type Vector2,
} from "@owlbear-rodeo/sdk";
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
  readonly parentId: string;
  private light: string;

  /** Parent's world position — the origin of every line-of-sight query
   *  in `light/occlusion.ts`. */
  position: Vector2;
  /** Whoever owns the parent item. In Owlbear this IS the permission
   *  boundary: a player may edit only what they created. */
  ownerId: string;
  /** Parent's own `visible` flag. */
  parentVisible: boolean;
  /** `LightConfig.ambient` — exempt from occlusion. */
  ambient: boolean;
  /** Set by the occlusion pass. Starts true so a client with occlusion
   *  switched off behaves exactly as before. */
  allowed = true;

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    this.parentId = parent.id;
    this.position = { ...parent.position };
    this.ownerId = parent.createdUserId;
    this.parentVisible = parent.visible;
    this.ambient = readConfig(parent).ambient === true;
    const item = this.parentToLight(parent);
    this.light = item.id;
    this.reconciler.patcher.addItems(item);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light);
  }

  update(parent: Item): void {
    const config = readConfig(parent);
    this.position = { ...parent.position };
    this.ownerId = parent.createdUserId;
    this.parentVisible = parent.visible;
    this.ambient = config.ambient === true;
    const visible = this.parentVisible && this.allowed;
    this.reconciler.patcher.updateItems([
      this.light,
      (item) => {
        if (!isLight(item)) return;
        applyLightConfig(parent, item, config);
        if (item.visible !== visible) item.visible = visible;
      },
    ]);
  }

  /** Called by the occlusion pass. Only stages a patch when the answer
   *  actually moved, so a scene with nothing changing costs nothing. */
  setAllowed(allowed: boolean): void {
    if (this.allowed === allowed) return;
    this.allowed = allowed;
    const visible = this.parentVisible && allowed;
    this.reconciler.patcher.updateItems([
      this.light,
      (item) => {
        if (isLight(item) && item.visible !== visible) item.visible = visible;
      },
    ]);
  }

  private parentToLight(parent: Item): Light {
    const config = readConfig(parent);
    const light = buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .visible(parent.visible && this.allowed)
      // POSITION / ROTATION inherit so the light tracks the token
      // during a drag without waiting for items.onChange. SCALE is off
      // so a 2× ogre doesn't get a 2× torch; COPY is off so duplicating
      // the token doesn't clone our local-only light; VISIBLE is off
      // because occlusion owns it — see the header.
      .disableAttachmentBehavior(["SCALE", "COPY", "VISIBLE"])
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
