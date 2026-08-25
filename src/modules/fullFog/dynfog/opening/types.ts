// Openings — doors, secret doors and windows carved out of a fog wall.
//
// Stored as an array on the FOG-layer Drawing they belong to, under
// `OPENINGS_KEY`. Because the array lives in the SHARED scene it
// propagates to every client for free; each client then re-derives its
// own local Wall items from it.
//
// === Semantics ========================================================
//
// `open` means "a creature can pass through". Whether VISION passes is
// a separate question answered by `blocksVision`:
//
//   kind      open=true                     open=false
//   ────────  ────────────────────────────  ────────────────────────────
//   door      wall removed, vision passes   wall intact, vision blocked
//   secret    wall removed, vision passes   wall intact, vision blocked
//   window    wall removed, vision passes   wall removed, vision passes
//
// A window is glass: shut or not, you can see through it. That is the
// whole point of a window, and it's why `blocksVision` exists rather
// than the code testing `!open` directly. Owlbear's `Wall` items only
// affect VISION and never movement, so the "shut window still can't be
// climbed through" half of the rule is carried by the indicator's
// colour and icon and enforced at the table, not by the engine — see
// docs/DYNAMIC_FOG_PARITY.md.
//
// A SECRET door behaves exactly like a door for vision, but players
// never see its indicator and can never operate it: `playerVisible`
// gates the overlay, and the GM-side toggle listener re-checks it so a
// hand-rolled broadcast can't flip one either.

export type OpeningKind = "door" | "window" | "secret";

export interface Opening {
  /** Stable id. Player toggle requests reference this rather than an
   *  array index, so a concurrent delete can't flip the wrong door. */
  id: string;
  kind: OpeningKind;
  /** true ⇒ a creature can pass. See the table above for what that
   *  does (or doesn't) do to vision. */
  open: boolean;
  /** Index into `drawingToPolylines(drawing)`. */
  polyIndex: number;
  /** Normalised arc-length of the opening's two ends. Not necessarily
   *  ordered; consumers sort them. */
  t1: number;
  t2: number;
}

/**
 * Does this opening still block line of sight?
 *
 * The single source of truth for wall derivation (`wallGeometry`), the
 * cross-shape cut geometry (`OpeningActor`) and anything else that asks
 * "is there a hole here". Windows are never blocking.
 */
export function blocksVision(opening: Opening): boolean {
  if (opening.kind === "window") return false;
  return !opening.open;
}

/** The complement of `blocksVision` — this opening removes its stretch
 *  of wall. Named separately because that is what the geometry code is
 *  actually asking. */
export function cutsWall(opening: Opening): boolean {
  return !blocksVision(opening);
}

/** May a non-GM client see this opening's indicator and operate it? */
export function playerVisible(opening: Opening): boolean {
  return opening.kind !== "secret";
}

/** Default `open` for a freshly created opening of each kind.
 *
 *  Windows default to SHUT: a window in a wall is normally glazed and
 *  closed, and since a shut window is see-through anyway the default
 *  costs no visibility. Doors and secret doors default to shut too. */
export function defaultOpenState(_kind: OpeningKind): boolean {
  return false;
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
