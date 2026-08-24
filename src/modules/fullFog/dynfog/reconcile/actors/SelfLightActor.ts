// A small omnidirectional light on tokens whose main light is a CONE,
// so the torch-bearer isn't standing in their own dark spot.
// Port of upstream `SelfLightActor`.

import { buildLight, type Item } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import type { Reconciler } from "../Reconciler";

export class SelfLightActor extends Actor {
  private light: string;

  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const item = this.buildSelfLight(parent);
    this.light = item.id;
    this.reconciler.patcher.addItems(item);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light);
  }

  update(): void {
    // Nothing configurable — the self light is always the same size.
  }

  private buildSelfLight(parent: Item) {
    return buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .visible(parent.visible)
      .disableAttachmentBehavior(["SCALE", "COPY"])
      .attenuationRadius(75)
      .falloff(2)
      .sourceRadius(0)
      .build();
  }
}
