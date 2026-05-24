/* Music-board module — background side.
 *
 * Cluster-row "音乐" button → BC_TOGGLE (LOCAL) → flips room-wide
 * `open` flag in scene metadata. All clients react to the metadata
 * change by opening / closing their own music-board popover (which
 * carries the live audio + PeerJS pairing). Players never write the
 * open flag, never see the cluster button, never close their popover
 * — only DM controls visibility for the whole room.
 *
 * Audio + PeerJS live in the popover (music-board-page.ts) because
 * WebAudio autoplay needs a user gesture in THAT iframe. Background
 * just owns the open-flag + popover anchor.
 *
 * Layout: registers as a draggable panel via PANEL_IDS.musicBoard.
 * The popover anchor is `vw - RIGHT_INSET + userOff.dx` so user drags
 * persist across open/close.
 */

import OBR from "@owlbear-rodeo/sdk";
import { assetUrl } from "../../asset-base";
import {
  PANEL_IDS,
  getPanelOffset,
  registerPanelBbox,
  BC_PANEL_DRAG_END,
  BC_PANEL_RESET,
} from "../../utils/panelLayout";

interface DragEndPayload { panelId?: string; }

const POPOVER_ID = "com.obr-suite/music-board/popover";
const PAGE_URL   = assetUrl("music-board.html");
// IMPORTANT: keep this metadata key SEPARATE from the music-state key
// the popover writes. The popover overwrites its entire key on every
// peer message; if we shared a key our `open` flag would be lost on
// the first bgm-load and the popover would auto-close.
const META_KEY_OPEN  = "com.obr-suite/music-board:open";
const META_KEY_STATE = "com.obr-suite/music-board:state";
const BC_TOGGLE      = "com.obr-suite/music-board:toggle";
const BC_ACTIVE      = "com.obr-suite/music-board:state-active";
// Popover → background: minimize/expand. Background close+reopens the
// popover at the new dims (the only way to actually change the iframe's
// click hit-test region; setWidth/setHeight only resize the visual box
// and leave the old region blocking the canvas).
const BC_RESIZE      = "com.obr-suite/music-board:resize";

// Dimensions differ by role: the player popover has no pair-section
// (CSS hides it) so it can be much shorter. The width stays the same
// so the layout doesn't reflow inside.
const POPOVER_W      = 380;
const POPOVER_H_GM   = 540;
const POPOVER_H_PLYR = 300;
// Mini-mode dims: just big enough for the round vinyl button (36×36)
// + its turntable case (border + tonearm decoration). Anything bigger
// uselessly blocks canvas clicks; anything smaller crops the case.
const POPOVER_W_MINI = 92;
const POPOVER_H_MINI = 80;
// Clear OBR's right-side panels (people / scene settings) — 120 px
// gap leaves the popover well off the toolbar.
const RIGHT_INSET    = 120;
const TOP_INSET      = 56;

// Persistence keys for per-client mini state + auto-reconnect hint.
// Lives in the popover iframe's localStorage, but background also
// reads/writes them when re-opening the popover so the new iframe
// boots into the correct mode.
const LS_MINI = "obr-music-board:minimized";
const LS_PAIR = "obr-music-board:last-pair-code";

let popoverOpen = false;
let myRole: "GM" | "PLAYER" = "PLAYER";
const unsubs: Array<() => void> = [];

// Helper: detect mini state for a new popover open. Priority:
//   1. Explicit `opts.mini` from the resize broadcast
//   2. Saved localStorage value from a previous session
//   3. Role default — PLAYER boots minimized so it doesn't blanket
//      the canvas; GM boots full because they need the pair UI.
function resolveMiniMode(explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  try {
    const v = localStorage.getItem(LS_MINI);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {}
  return myRole === "PLAYER";
}

// Compute the popover's anchor (= its RIGHT edge, since transformOrigin
// is RIGHT) and TOP, applying the user's drag offset BUT clamping so
// the whole popover stays on-screen. Without the clamp, dragging the
// mini popover toward the right edge could push it (and its only drag
// handle) entirely off-screen — then there's nothing left to grab to
// pull it back, the "贴边拖不出来" bug. We keep an 8px margin on every
// side so the handle is always reachable. The clamp is applied at
// OPEN time (and in the bbox provider), so even a stale oversized
// stored offset self-heals on the next open.
const EDGE_MARGIN = 8;
function clampedAnchor(
  vw: number, vh: number, w: number, h: number, off: PanelOffset,
): { left: number; top: number } {
  // anchorRight = popover's right edge in viewport coords.
  let anchorRight = vw - RIGHT_INSET + off.dx;
  // Right edge ≤ vw-margin (stays on-screen) AND left edge
  // (= anchorRight - w) ≥ margin → anchorRight ≥ w + margin.
  anchorRight = Math.min(anchorRight, vw - EDGE_MARGIN);
  anchorRight = Math.max(anchorRight, w + EDGE_MARGIN);
  let top = TOP_INSET + off.dy;
  const maxTop = Math.max(EDGE_MARGIN, vh - h - EDGE_MARGIN);
  top = Math.min(Math.max(top, EDGE_MARGIN), maxTop);
  return { left: anchorRight, top };
}

interface PanelOffset { dx: number; dy: number; }

// Panel bbox provider — used by the layout-editor + drag-preview modal
// to render this panel's proxy at the right place. Returns the
// user-dragged offset-adjusted top-left rectangle, even when the
// popover isn't open.
registerPanelBbox(PANEL_IDS.musicBoard, async () => {
  try {
    let vw = 0, vh = 0;
    try { vw = await OBR.viewport.getWidth(); } catch {}
    try { vh = await OBR.viewport.getHeight(); } catch {}
    vw = Math.max(vw || 0, window.innerWidth || 0, 1024);
    vh = Math.max(vh || 0, window.innerHeight || 0, 720);
    const isPlayer = myRole === "PLAYER";
    // bbox uses the dims the popover would currently open at — so the
    // layout-editor proxy + drag-preview overlay match what the user
    // visually sees. mini popovers get the mini box; full popovers get
    // the role-appropriate full box.
    const mini = resolveMiniMode();
    const w = mini ? POPOVER_W_MINI : POPOVER_W;
    const h = mini
      ? POPOVER_H_MINI
      : (isPlayer ? POPOVER_H_PLYR : POPOVER_H_GM);
    const userOff = getPanelOffset(PANEL_IDS.musicBoard);
    // Same clamp as openPopover so the ghost the user grabs lines up
    // with where the popover actually is (and never off-screen).
    const a = clampedAnchor(vw, vh, w, h, userOff);
    return {
      left: a.left - w, // anchor is the RIGHT edge → top-left = right - w
      top:  a.top,
      width: w,
      height: h,
    };
  } catch { return null; }
});

export async function setupMusicBoard(): Promise<void> {
  try { myRole = (await OBR.player.getRole()) as "GM" | "PLAYER"; } catch {}

  // GM-only: react to the cluster-row toggle button.
  if (myRole === "GM") {
    try {
      const u = OBR.broadcast.onMessage(BC_TOGGLE, () => { void toggleRoomOpen(); });
      if (typeof u === "function") unsubs.push(u);
    } catch (e) {
      console.warn("[music-board] subscribe toggle failed", e);
    }
  }

  // EVERY client reacts to scene-metadata `open` flag.
  try { await OBR.scene.isReady(); } catch {}
  try {
    const meta = await OBR.scene.getMetadata().catch(() => ({} as any));
    const init = meta[META_KEY_OPEN] as any;
    await reactToOpenFlag(!!init?.open);
  } catch (e) {
    console.warn("[music-board] initial metadata read failed", e);
  }
  try {
    const u = OBR.scene.onMetadataChange((meta) => {
      const cur = meta[META_KEY_OPEN] as any;
      void reactToOpenFlag(!!cur?.open);
    });
    if (typeof u === "function") unsubs.push(u);
  } catch (e) {
    console.warn("[music-board] subscribe scene metadata failed", e);
  }

  // Drag-end → re-open at the new offset. The drag-preview modal saved
  // the new dx/dy in localStorage; openPopover re-reads it. OBR has no
  // setPosition for popovers, so a move requires a fresh open. We read
  // the saved mini state so a drag preserves the user's size, pass
  // autoReconnect so the freshly-opened iframe re-pairs, and fromResize
  // so the GM reads the live scene state on boot.
  try {
    const u = OBR.broadcast.onMessage(BC_PANEL_DRAG_END, async (event) => {
      const data = event.data as DragEndPayload | undefined;
      if (data?.panelId !== PANEL_IDS.musicBoard) return;
      if (popoverOpen) {
        const hadPair = await peekHadPair();
        await closePopover();
        await openPopover({ mini: resolveMiniMode(), autoReconnect: hadPair, fromResize: true });
      }
    });
    if (typeof u === "function") unsubs.push(u);
  } catch {}
  try {
    const u = OBR.broadcast.onMessage(BC_PANEL_RESET, async () => {
      if (popoverOpen) {
        const hadPair = await peekHadPair();
        await closePopover();
        await openPopover({ mini: resolveMiniMode(), autoReconnect: hadPair, fromResize: true });
      }
    });
    if (typeof u === "function") unsubs.push(u);
  } catch {}

  // Minimize / expand → the popover asks us to close+reopen at the new
  // size. setWidth/setHeight can't do this — OBR only re-computes the
  // iframe's click hit-test region on a real open, so a visual-only
  // shrink keeps blocking the canvas. We persist the new mini state +
  // pair code (so the reopened iframe boots correctly and re-pairs),
  // then close+reopen. LOCAL only — each client owns its own mini view.
  try {
    const u = OBR.broadcast.onMessage(BC_RESIZE, async (event) => {
      const data = event.data as { mini?: boolean; pairCode?: string } | undefined;
      if (!data || typeof data.mini !== "boolean") return;
      try { localStorage.setItem(LS_MINI, data.mini ? "1" : "0"); } catch {}
      if (data.pairCode && typeof data.pairCode === "string") {
        try { localStorage.setItem(LS_PAIR, data.pairCode); } catch {}
      }
      if (popoverOpen) {
        await closePopover();
        await openPopover({
          mini: data.mini,
          autoReconnect: !!data.pairCode,
          fromResize: true,
        });
      }
    });
    if (typeof u === "function") unsubs.push(u);
  } catch (e) {
    console.warn("[music-board] subscribe resize failed", e);
  }

  console.info("[music-board] module setup complete; role =", myRole);
}

// True iff there's a saved pair code AND the user role pairs at all
// (GM only — players never pair, they just receive scene metadata).
// Used to gate the autoReconnect URL param on reopen.
async function peekHadPair(): Promise<boolean> {
  if (myRole !== "GM") return false;
  try {
    const v = localStorage.getItem(LS_PAIR);
    return !!(v && v.trim());
  } catch {
    return false;
  }
}

async function toggleRoomOpen(): Promise<void> {
  if (myRole !== "GM") return;
  try {
    const meta = await OBR.scene.getMetadata();
    const cur = (meta[META_KEY_OPEN] as any) || {};
    const newOpen = !cur.open;
    const patch: Record<string, unknown> = {
      [META_KEY_OPEN]: { open: newOpen, ts: Date.now() },
    };
    // Going from closed → open: blank the music-state metadata too,
    // so old BGM / SFX entries from a previous pairing session don't
    // get replayed by every popover that just opened.
    if (newOpen) {
      patch[META_KEY_STATE] = {
        bgm: null,
        sfx: [],
        bus: { bgm: 0.8, sfx: 1.0 },
        ts: Date.now(),
      };
    }
    await OBR.scene.setMetadata(patch);
  } catch (e) {
    console.warn("[music-board] toggle failed", e);
  }
}

async function reactToOpenFlag(shouldBeOpen: boolean): Promise<void> {
  try {
    OBR.broadcast.sendMessage(BC_ACTIVE, { open: shouldBeOpen },
      { destination: "LOCAL" });
  } catch {}
  if (shouldBeOpen && !popoverOpen) {
    // Initial open — let resolveMiniMode pick the default (PLAYER
    // boots mini, GM boots full, but localStorage overrides both).
    // autoReconnect on initial open only if we have a saved pair code
    // from a prior session AND we're GM.
    await openPopover({ autoReconnect: await peekHadPair() });
  } else if (!shouldBeOpen && popoverOpen) {
    await closePopover();
  }
}

interface OpenPopoverOpts {
  mini?: boolean;          // explicit mini state override
  autoReconnect?: boolean; // pass ?auto=1 so the new iframe auto-pairs
  fromResize?: boolean;    // pass ?resize=1 so the GM iframe reads
                           // scene metadata on boot (continuing an
                           // existing session, not a fresh open)
}

async function openPopover(opts: OpenPopoverOpts = {}): Promise<void> {
  if (popoverOpen) return;
  const mini = resolveMiniMode(opts.mini);

  let vw = 0, vh = 0;
  try { vw = await OBR.viewport.getWidth(); } catch {}
  try { vh = await OBR.viewport.getHeight(); } catch {}
  vw = Math.max(vw || 0, window.innerWidth || 0, 1024);
  vh = Math.max(vh || 0, window.innerHeight || 0, 720);
  const isPlayer = myRole === "PLAYER";

  const w = mini ? POPOVER_W_MINI : POPOVER_W;
  const targetH = mini
    ? POPOVER_H_MINI
    : (isPlayer ? POPOVER_H_PLYR : POPOVER_H_GM);

  const userOff  = getPanelOffset(PANEL_IDS.musicBoard);
  const clampH   = Math.min(targetH, vh - 80);
  // Clamp the anchor so the popover (esp. the mini box + its drag
  // handle) never lands off-screen — fixes the "贴边拖不出来" bug. We
  // clamp with the ACTUAL open height (clampH) so the bottom-edge guard
  // matches what's rendered.
  const anchor = clampedAnchor(vw, vh, w, clampH, userOff);
  // ?mini=1 tells the popover to boot in minimized CSS layout; ?auto=1
  // tells it to programmatically re-pair after the DOM settles (GM
  // only — players don't pair).
  const qs = new URLSearchParams();
  qs.set("role", myRole);
  if (mini) qs.set("mini", "1");
  if (opts.autoReconnect && myRole === "GM") qs.set("auto", "1");
  if (opts.fromResize) qs.set("resize", "1");
  const url = `${PAGE_URL}?${qs.toString()}`;
  try {
    await OBR.popover.open({
      id: POPOVER_ID,
      url,
      width: w,
      height: clampH,
      anchorReference: "POSITION",
      // anchor.left is the popover's RIGHT edge (transformOrigin RIGHT);
      // clampedAnchor already kept it within [w+margin, vw-margin] so
      // dragging toward the edge can't strand it off-screen.
      anchorPosition: { left: anchor.left, top: anchor.top },
      anchorOrigin:    { horizontal: "RIGHT", vertical: "TOP" },
      transformOrigin: { horizontal: "RIGHT", vertical: "TOP" },
      hidePaper: true,
      disableClickAway: true,
    });
    popoverOpen = true;
  } catch (e) {
    console.warn("[music-board] popover.open failed", e);
  }
}

async function closePopover(): Promise<void> {
  if (!popoverOpen) return;
  try { await OBR.popover.close(POPOVER_ID); } catch {}
  popoverOpen = false;
}

export function teardownMusicBoard(): void {
  for (const u of unsubs.splice(0)) { try { u(); } catch {} }
  if (popoverOpen) {
    void OBR.popover.close(POPOVER_ID).catch(() => {});
    popoverOpen = false;
  }
}
