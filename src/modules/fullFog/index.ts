// fullFog module — map-fog editor entry + the dynamic-fog engine.
//
// Two halves:
//
//   1. EDITOR (GM only). Right-click a MAP-layer image → "编辑地图迷雾"
//      → fullscreen modal. Image decode, thresholding algorithms, mask
//      painting and save all live in `editor-page.ts`. It writes a
//      FOG-layer Path whose commands trace the walls it found.
//
//   2. ENGINE (`dynfog/`). A port of owlbear-rodeo/dynamic-fog: it
//      watches EVERY FOG-layer drawing — the editor's traced outline,
//      shapes drawn with Owlbear's own fog tool, and lines drawn with
//      our Line mode — and derives per-client `Wall` items from them,
//      minus any open doors / windows. It also owns light sources and
//      the door/window indicators.
//
// History (2026-08-25): the engine replaces three separate home-grown
// subsystems — a wall watcher that only understood the editor's own
// outline Path, a door tool that could only attach openings to that
// same Path, and a reduced light system with no angle / type / self
// light. See docs/DYNAMIC_FOG_PARITY.md.

import OBR from "@owlbear-rodeo/sdk";
import { assetUrl } from "../../asset-base";
import { getLocalLang, getState, onStateChange } from "../../state";
import { STABLE_HIDES } from "../../feature-flags";
import { CTX_EDIT_FOG, MODAL_ID, PLUGIN_ID } from "./types";
import {
  applyDynfogSettings,
  setupDynfog,
  teardownDynfog,
  type DynfogOptions,
} from "./dynfog";

const ICON_URL = assetUrl("fullfog-icon.svg");
const EDIT_PAGE_URL = assetUrl("fullfog-edit.html");

let registered = false;
let contextMenuRegistered = false;
const unsubs: Array<() => void> = [];

function currentOptions(): DynfogOptions {
  const state = getState();
  return {
    playerOpenings: state.fogPlayerDoors,
    alwaysShowOverlay: state.fogDoorOverlayAlways,
    // The authoring surface (light menu, fog-tool modes, indicators,
    // player toggle tool) is dev-channel only for now; the wall engine
    // runs everywhere because the stable fog editor depends on it.
    authoring: !STABLE_HIDES,
  };
}

async function openEditor(mapItemId: string): Promise<void> {
  try {
    await OBR.modal.close(MODAL_ID);
  } catch {}
  const url = `${EDIT_PAGE_URL}?id=${encodeURIComponent(mapItemId)}`;
  try {
    await OBR.modal.open({
      id: MODAL_ID,
      url,
      fullScreen: true,
      hidePaper: true,
    });
  } catch (e) {
    console.error("[fullFog] open editor failed", e);
  }
}

async function registerEditorMenu(): Promise<void> {
  if (contextMenuRegistered) return;
  const en = getLocalLang() === "en";
  try {
    await OBR.contextMenu.create({
      id: CTX_EDIT_FOG,
      icons: [
        {
          icon: ICON_URL,
          label: en ? "Edit map fog" : "编辑地图迷雾",
          filter: {
            every: [
              { key: "type", value: "IMAGE" },
              { key: "layer", value: "MAP" },
            ],
            max: 1,
          },
        },
      ],
      onClick: async (ctx) => {
        if (ctx.items.length > 0) await openEditor(ctx.items[0].id);
      },
    });
    contextMenuRegistered = true;
  } catch (e) {
    console.warn("[fullFog] contextMenu.create failed", e);
  }
}

export async function setupFullFog(): Promise<void> {
  if (registered) return;
  registered = true;

  let role: "GM" | "PLAYER" = "PLAYER";
  try {
    role = (await OBR.player.getRole()) as "GM" | "PLAYER";
  } catch {}

  if (role === "GM") await registerEditorMenu();

  // The engine runs on every client — Wall and Light items are local
  // per-client, so each client derives its own from the shared fog
  // drawings.
  await setupDynfog(currentOptions());

  // Keep the engine in step with the GM's suite settings.
  unsubs.push(
    onStateChange(() => {
      void applyDynfogSettings(currentOptions());
    }),
  );

  // A player promoted to GM mid-session should get the editor menu.
  try {
    unsubs.push(
      OBR.player.onChange((player) => {
        if (player.role === "GM") void registerEditorMenu();
      }),
    );
  } catch {}
}

export async function teardownFullFog(): Promise<void> {
  if (!registered) return;
  registered = false;
  for (const unsubscribe of unsubs.splice(0)) {
    try {
      unsubscribe();
    } catch {}
  }
  if (contextMenuRegistered) {
    contextMenuRegistered = false;
    try {
      await OBR.contextMenu.remove(CTX_EDIT_FOG);
    } catch {}
  }
  await teardownDynfog();
}

void PLUGIN_ID;
