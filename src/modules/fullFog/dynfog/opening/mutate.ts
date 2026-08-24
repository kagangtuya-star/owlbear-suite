// Writes to the shared `Opening[]` on a FOG-layer Drawing.
//
// Only the GM can update FOG-layer items, so every mutation goes
// through here and players reach it via the broadcast in
// `tools/toggleChannel.ts`.

import OBR from "@owlbear-rodeo/sdk";
import { OPENINGS_KEY } from "../ids";
import { readOpenings, serialiseOpenings } from "./read";
import type { Opening } from "./types";

async function editOpenings(
  itemId: string,
  edit: (openings: Opening[]) => Opening[] | null,
): Promise<void> {
  try {
    await OBR.scene.items.updateItems([itemId], (items) => {
      const item = items[0];
      if (!item) return;
      const current = readOpenings(item);
      const next = edit(current);
      if (!next) return;
      (item.metadata as Record<string, unknown>)[OPENINGS_KEY] =
        serialiseOpenings(next);
    });
  } catch (e) {
    console.warn("[dynfog] opening update failed", e);
  }
}

export async function addOpening(
  itemId: string,
  opening: Opening,
): Promise<void> {
  await editOpenings(itemId, (openings) => [...openings, opening]);
}

export async function toggleOpening(
  itemId: string,
  openingId: string,
): Promise<void> {
  await editOpenings(itemId, (openings) => {
    let hit = false;
    const next = openings.map((o) => {
      if (o.id !== openingId) return o;
      hit = true;
      return { ...o, open: !o.open };
    });
    return hit ? next : null;
  });
}

export async function setOpeningState(
  itemId: string,
  openingId: string,
  open: boolean,
): Promise<void> {
  await editOpenings(itemId, (openings) => {
    let changed = false;
    const next = openings.map((o) => {
      if (o.id !== openingId || o.open === open) return o;
      changed = true;
      return { ...o, open };
    });
    return changed ? next : null;
  });
}

export async function deleteOpening(
  itemId: string,
  openingId: string,
): Promise<void> {
  await editOpenings(itemId, (openings) => {
    const next = openings.filter((o) => o.id !== openingId);
    return next.length === openings.length ? null : next;
  });
}
