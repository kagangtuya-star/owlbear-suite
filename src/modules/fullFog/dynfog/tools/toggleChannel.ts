// Player → GM door/window toggle channel.
//
// FOG-layer items are GM-writable only, so a player can't flip an
// opening directly no matter what the UI lets them click. They ask; the
// GM's background applies. The GM is also the single point where the
// "players may open doors" permission is enforced — a hand-rolled
// message can't bypass it.

import OBR from "@owlbear-rodeo/sdk";
import { BC_TOGGLE_OPENING, type ToggleRequest } from "../ids";
import { toggleOpening } from "../opening/mutate";
import { getPlayerOpeningsEnabled, isGM } from "../runtime";

let unsubscribe: (() => void) | null = null;

/** Ask the GM to flip an opening. */
export function requestToggle(itemId: string, openingId: string): void {
  const payload: ToggleRequest = { itemId, openingId };
  try {
    OBR.broadcast.sendMessage(BC_TOGGLE_OPENING, payload as any, {
      destination: "REMOTE",
    });
  } catch (e) {
    console.warn("[dynfog] toggle broadcast failed", e);
  }
}

/** GM side: listen for requests and apply them. Idempotent. */
export function startToggleListener(): void {
  if (unsubscribe) return;
  try {
    unsubscribe = OBR.broadcast.onMessage(BC_TOGGLE_OPENING, async (event) => {
      if (!isGM()) return;
      if (!getPlayerOpeningsEnabled()) return;
      const data = event.data as ToggleRequest | undefined;
      if (
        !data ||
        typeof data.itemId !== "string" ||
        typeof data.openingId !== "string"
      ) {
        return;
      }
      await toggleOpening(data.itemId, data.openingId);
    });
  } catch (e) {
    console.warn("[dynfog] toggle listener failed", e);
  }
}

export function stopToggleListener(): void {
  if (!unsubscribe) return;
  try {
    unsubscribe();
  } catch {}
  unsubscribe = null;
}
