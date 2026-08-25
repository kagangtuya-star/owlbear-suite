// dynfog — the suite's dynamic-fog engine.
//
// Runs on EVERY client (walls and lights are local per-client items, so
// each client has to derive its own). Registration order matters:
// OpeningReactor caches the geometry the wall + overlay reactors read,
// so it goes first.
//
// GM-only pieces (the fog-tool modes and the light context menu) are
// gated on role; the toggle tool is registered for players too when the
// GM allows it.

import OBR from "@owlbear-rodeo/sdk";
import { Reconciler } from "./reconcile/Reconciler";
import { OpeningReactor } from "./reconcile/reactors/OpeningReactor";
import { WallReactor } from "./reconcile/reactors/WallReactor";
import {
  LightReactor,
  SelfLightReactor,
} from "./reconcile/reactors/LightReactor";
import { DarkvisionReactor } from "./reconcile/reactors/DarkvisionReactor";
import { LightOcclusion } from "./light/occlusion";
import { initOverlay, syncOverlays, teardownOverlay } from "./overlay";
import { createLineMode, removeLineMode } from "./tools/createLineMode";
import {
  createOpeningMode,
  removeOpeningModes,
} from "./tools/createOpeningMode";
import { createToggleTool, removeToggleTool } from "./tools/createToggleTool";
import {
  startToggleListener,
  stopToggleListener,
} from "./tools/toggleChannel";
import { createLightMenu, removeLightMenu } from "./light/createLightMenu";
import {
  getPlayerOpeningsEnabled,
  isGM,
  refreshRuntime,
  setAlwaysShowOverlay,
  setDarkvisionForGM,
  setLightOcclusionEnabled,
  setPlayerOpeningsEnabled,
  setSceneDpi,
} from "./runtime";

export interface DynfogOptions {
  /** Players may see + operate door/window indicators. */
  playerOpenings: boolean;
  /** GM keeps their indicators visible without the fog tool. */
  alwaysShowOverlay: boolean;
  /** Hide other people's lights unless a wall-free sight line reaches
   *  them from one of your own. See `light/occlusion.ts`. */
  lightOcclusion: boolean;
  /** Apply the darkvision desaturation on the GM's screen too. */
  darkvisionForGM: boolean;
  /**
   * Register the AUTHORING surface — light context menu, the fog-tool
   * line/door/window modes, the indicator overlays and the player
   * toggle tool.
   *
   * The wall engine itself always runs: it is what turns fog shapes
   * (including the fog editor's traced outline) into vision-blocking
   * walls, and every channel needs that. Only the authoring UI is
   * channel-gated — see `feature-flags.ts::STABLE_HIDES`.
   */
  authoring: boolean;
}

let reconciler: Reconciler | null = null;
let occlusion: LightOcclusion | null = null;
let started = false;
let authoring = false;
const subscriptions: Array<() => void> = [];
let gmToolsRegistered = false;
let toggleToolWanted = false;

async function syncGmTools(): Promise<void> {
  const want = authoring && isGM();
  if (want && !gmToolsRegistered) {
    gmToolsRegistered = true;
    try {
      await createLightMenu();
      await createLineMode();
      if (reconciler) {
        await createOpeningMode(reconciler, "door");
        await createOpeningMode(reconciler, "window");
        await createOpeningMode(reconciler, "secret");
      }
    } catch (e) {
      console.warn("[dynfog] GM tool registration failed", e);
    }
  } else if (!want && gmToolsRegistered) {
    gmToolsRegistered = false;
    await removeLightMenu();
    await removeLineMode();
    await removeOpeningModes();
  }
}

async function syncToggleTool(): Promise<void> {
  // The GM always keeps the tool; players only get it when allowed.
  const want = authoring && (isGM() || getPlayerOpeningsEnabled());
  if (want === toggleToolWanted) return;
  toggleToolWanted = want;
  if (want) await createToggleTool(reconciler);
  else await removeToggleTool();
}

/** Push the suite's scene-level settings into the engine. Called by
 *  `fullFog/index.ts` whenever suite state changes. */
export async function applyDynfogSettings(
  options: DynfogOptions,
): Promise<void> {
  authoring = options.authoring;
  const a = setPlayerOpeningsEnabled(options.playerOpenings);
  const b = setAlwaysShowOverlay(options.alwaysShowOverlay);
  // Both of these change what the reactors should be producing, not
  // just how they look, so they need a full refresh rather than an
  // overlay resync: occlusion re-allows every light it had hidden, and
  // the darkvision reactor's filter answers differently.
  const c = setLightOcclusionEnabled(options.lightOcclusion);
  const d = setDarkvisionForGM(options.darkvisionForGM);
  await syncGmTools();
  await syncToggleTool();
  if ((a || b || c || d) && reconciler && authoring) {
    syncOverlays(reconciler);
    reconciler.refresh();
  }
}

export async function setupDynfog(options: DynfogOptions): Promise<void> {
  if (started) {
    await applyDynfogSettings(options);
    return;
  }
  started = true;
  authoring = options.authoring;

  setPlayerOpeningsEnabled(options.playerOpenings);
  setAlwaysShowOverlay(options.alwaysShowOverlay);
  setLightOcclusionEnabled(options.lightOcclusion);
  setDarkvisionForGM(options.darkvisionForGM);
  await refreshRuntime();

  reconciler = new Reconciler();
  reconciler.register(new OpeningReactor(reconciler));
  reconciler.register(new WallReactor(reconciler));
  if (authoring) {
    reconciler.register(new LightReactor(reconciler));
    reconciler.register(new SelfLightReactor(reconciler));
    reconciler.register(new DarkvisionReactor(reconciler));
    // Occlusion runs after every reactor has settled, so it reads the
    // walls and the light positions from the SAME pass.
    occlusion = new LightOcclusion(reconciler);
    subscriptions.push(
      reconciler.onAfterReconcile(() => occlusion?.run()),
    );
    await initOverlay(reconciler);
    startToggleListener();
  }
  await syncGmTools();
  await syncToggleTool();

  // Grid dpi feeds 墙体外扩; scene swaps and grid edits both move it.
  try {
    subscriptions.push(
      OBR.scene.grid.onChange((grid) => {
        if (setSceneDpi(grid.dpi) && reconciler) reconciler.refresh();
      }),
    );
  } catch {}

  // A player promoted to GM mid-session needs the GM tools, and their
  // overlay has to move from DRAWING to CONTROL.
  try {
    subscriptions.push(
      OBR.player.onChange(() => {
        void (async () => {
          const changed = await refreshRuntime();
          if (!changed) return;
          await syncGmTools();
          await syncToggleTool();
          if (reconciler) {
            if (authoring) syncOverlays(reconciler);
            reconciler.refresh();
          }
        })();
      }),
    );
  } catch {}

  try {
    subscriptions.push(
      OBR.scene.onReadyChange((ready) => {
        if (!ready) return;
        void (async () => {
          await refreshRuntime();
          if (reconciler && authoring) syncOverlays(reconciler);
        })();
      }),
    );
  } catch {}
}

export async function teardownDynfog(): Promise<void> {
  if (!started) return;
  started = false;

  for (const unsubscribe of subscriptions.splice(0)) {
    try {
      unsubscribe();
    } catch {}
  }

  stopToggleListener();
  await removeToggleTool();
  toggleToolWanted = false;
  if (gmToolsRegistered) {
    gmToolsRegistered = false;
    await removeLightMenu();
    await removeLineMode();
    await removeOpeningModes();
  }

  occlusion?.reset();
  occlusion = null;

  if (reconciler) {
    teardownOverlay(reconciler);
    reconciler.delete();
    reconciler = null;
  }
}
