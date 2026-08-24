// Openings — doors and windows carved out of a fog wall.
//
// Stored as an array on the FOG-layer Drawing they belong to, under
// `OPENINGS_KEY`. Because the array lives in the SHARED scene it
// propagates to every client for free; each client then re-derives its
// own local Wall items from it.
//
// Semantics (both kinds share one rule — `open === true` means the wall
// segment is removed, i.e. vision passes):
//
//   door    default closed (blocks vision), red → green when opened
//   window  default open   (see-through),   cyan → grey when shuttered
//
// Owlbear `Wall` items only affect VISION, never movement, so "you can
// see through a window but not walk through it" isn't expressible. A
// window is therefore "a normally-open, separately-styled opening that
// can be shuttered", which is the closest useful thing.

export type OpeningKind = "door" | "window";

export interface Opening {
  /** Stable id. Player toggle requests reference this rather than an
   *  array index, so a concurrent delete can't flip the wrong door. */
  id: string;
  kind: OpeningKind;
  /** true ⇒ this stretch of wall is removed (vision passes). */
  open: boolean;
  /** Index into `drawingToPolylines(drawing)`. */
  polyIndex: number;
  /** Normalised arc-length of the opening's two ends. Not necessarily
   *  ordered; consumers sort them. */
  t1: number;
  t2: number;
}

/** Default `open` for a freshly created opening of each kind. */
export function defaultOpenState(kind: OpeningKind): boolean {
  return kind === "window";
}

let idCounter = 0;

/** Collision-resistant id that doesn't need `crypto` (background
 *  iframes on http dev servers don't always have `crypto.randomUUID`). */
export function newOpeningId(): string {
  idCounter = (idCounter + 1) % 0xffff;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(
    Math.random() * 0xffffff,
  ).toString(36)}`;
}
