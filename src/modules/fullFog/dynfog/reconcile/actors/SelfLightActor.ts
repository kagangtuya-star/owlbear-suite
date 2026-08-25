// A small omnidirectional light on tokens whose main light is a CONE,
// so the torch-bearer isn't standing in their own dark spot.
// Port of upstream `SelfLightActor`.
//
// It follows its parent light's occlusion verdict. Without that, a
// hidden NPC's cone light would still give away their position as a
// 75px puddle of light — the self light is small, but it is not
// nothing.

import { buildLight, isLight, type Item } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";

export class SelfLightActor extends Actor {
  readonly parentId: string;
  private light: string;
  private parentVisible: boolean;
  allowed = true;

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    this.parentId = parent.id;
    this.parentVisible = parent.visible;
    const item = this.buildSelfLight(parent);
    this.light = item.id;
    this.reconciler.patcher.addItems(item);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light);
  }

  update(parent: Item): void {
    this.parentVisible = parent.visible;
    this.applyVisibility();
  }

  setAllowed(allowed: boolean): void {
    if (this.allowed === allowed) return;
    this.allowed = allowed;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    const visible = this.parentVisible && this.allowed;
    this.reconciler.patcher.updateItems([
      this.light,
      (item) => {
        if (isLight(item) && item.visible !== visible) item.visible = visible;
      },
    ]);
  }

  private buildSelfLight(parent: Item) {
    return buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .visible(parent.visible && this.allowed)
      // VISIBLE is ours for the same reason it is in LightActor.
      .disableAttachmentBehavior(["SCALE", "COPY", "VISIBLE"])
      .attenuationRadius(75)
      .falloff(2)
      .sourceRadius(0)
      .build();
  }
}
