// Light settings — runs INSIDE the right-click context menu via
// `contextMenu.create({ embed: { url, height } })`.
//
// Control set matches upstream dynamic-fog's Menu.tsx one-for-one
// (Range / Angle / Edge / Type / Rotate / Remove), plus the two extra
// sliders the suite's older panel had (core radius and the raw falloff
// value) so nothing is lost in the swap, plus two fields that are ours
// alone: the darkvision colour radius and the ambient flag. See
// `../light/config.ts` for what those two mean.
//
// The target is the current selection — that's the token whose context
// menu opened this embed — re-resolved on selection change so the panel
// follows if the GM clicks another light without closing the menu.

import OBR, { type GridScale, type Item } from "@owlbear-rodeo/sdk";
import { getLocalLang } from "../../../../state";
import { LIGHT_KEY } from "../ids";
import { isPlainObject } from "../meta";
import {
  ANGLE_CONE_INNER,
  ANGLE_CONE_OUTER,
  ANGLE_FULL_INNER,
  ANGLE_FULL_OUTER,
  FALLOFF_HARD,
  FALLOFF_SOFT,
  normaliseLightConfig,
  withDefaults,
  type LightConfig,
} from "./config";

const en = getLocalLang() === "en";
if (en) {
  document.title = "Light settings · fullFog";
  document.querySelectorAll<HTMLElement>("[data-en]").forEach((el) => {
    el.textContent = el.dataset.en!;
  });
  document.querySelectorAll<HTMLElement>("[data-en-title]").forEach((el) => {
    el.title = el.dataset.enTitle!;
  });
}

const panelEl = document.getElementById("panel") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const rangeEl = document.getElementById("range") as HTMLInputElement;
const rangeUnitEl = document.getElementById("range-unit") as HTMLSpanElement;
const angleEl = document.getElementById("angle") as HTMLDivElement;
const edgeEl = document.getElementById("edge") as HTMLDivElement;
const typeEl = document.getElementById("type") as HTMLDivElement;
const sourceEl = document.getElementById("source") as HTMLInputElement;
const sourceValEl = document.getElementById("source-val") as HTMLSpanElement;
const falloffEl = document.getElementById("falloff") as HTMLInputElement;
const falloffValEl = document.getElementById("falloff-val") as HTMLSpanElement;
const colorRadiusEl = document.getElementById("colorRadius") as HTMLInputElement;
const colorUnitEl = document.getElementById("color-unit") as HTMLSpanElement;
const ambientEl = document.getElementById("ambient") as HTMLDivElement;
const rotateBtn = document.getElementById("btn-rotate") as HTMLButtonElement;
const removeBtn = document.getElementById("btn-remove") as HTMLButtonElement;

let gridDpi = 150;
let gridScale: GridScale | null = null;
let targetIds: string[] = [];
let values: Required<LightConfig> | null = null;
/** True while we're repainting the UI from scene data — stops the
 *  input handlers from echoing that back as a write. */
let syncing = false;

function setStatus(text: string | null): void {
  if (text) {
    statusEl.textContent = text;
    statusEl.classList.remove("hidden");
    panelEl.classList.add("hidden");
  } else {
    statusEl.classList.add("hidden");
    panelEl.classList.remove("hidden");
  }
}

function setSegment(group: HTMLElement, value: string): void {
  for (const button of group.querySelectorAll<HTMLButtonElement>("button")) {
    button.setAttribute(
      "aria-pressed",
      button.dataset.value === value ? "true" : "false",
    );
  }
}

function pxToUnits(px: number): string {
  if (!gridScale) return String(Math.round(px));
  const { multiplier, digits } = gridScale.parsed;
  return ((px / gridDpi) * multiplier).toFixed(digits);
}

function unitsToPx(text: string): number {
  const parsed = parseFloat(text);
  if (!Number.isFinite(parsed)) return NaN;
  const multiplier = gridScale?.parsed.multiplier ?? 1;
  if (multiplier === 0) return NaN;
  return (parsed / multiplier) * gridDpi;
}

function paint(config: Required<LightConfig>): void {
  syncing = true;
  values = config;
  rangeEl.value = pxToUnits(config.attenuationRadius);
  rangeUnitEl.textContent = gridScale?.parsed.unit ?? "px";
  const isCone = config.outerAngle !== 360;
  setSegment(angleEl, isCone ? "CONE" : "FULL");
  setSegment(edgeEl, config.falloff > 1 ? "SOFT" : "HARD");
  setSegment(typeEl, config.lightType);
  sourceEl.value = String(Math.round(config.sourceRadius));
  sourceValEl.textContent = `${Math.round(config.sourceRadius)} px`;
  falloffEl.value = String(config.falloff);
  falloffValEl.textContent = config.falloff.toFixed(2);
  colorRadiusEl.value =
    config.colorRadius > 0 ? pxToUnits(config.colorRadius) : "0";
  colorUnitEl.textContent = gridScale?.parsed.unit ?? "px";
  setSegment(ambientEl, config.ambient ? "ON" : "OFF");
  rotateBtn.classList.toggle("hidden", !isCone);
  syncing = false;
}

/** Merge a patch into every selected item's light config. Reading the
 *  existing value per item (rather than writing a whole config built
 *  from the panel) keeps a multi-selection with different ranges from
 *  being flattened by a single toggle press. */
async function patch(update: Partial<LightConfig>): Promise<void> {
  if (targetIds.length === 0) return;
  try {
    await OBR.scene.items.updateItems(targetIds, (items) => {
      for (const item of items) {
        const metadata = item.metadata as Record<string, unknown>;
        const current = metadata[LIGHT_KEY];
        if (isPlainObject(current)) {
          Object.assign(current, update);
        } else {
          metadata[LIGHT_KEY] = { ...update };
        }
      }
    });
  } catch (e) {
    console.error("[dynfog/light-edit] write failed", e);
  }
}

async function load(): Promise<void> {
  let selection: string[] = [];
  try {
    selection = (await OBR.player.getSelection()) ?? [];
  } catch {}
  targetIds = selection;
  if (targetIds.length === 0) {
    setStatus(en ? "No token selected." : "未选中目标。");
    return;
  }

  try {
    gridDpi = await OBR.scene.grid.getDpi();
  } catch {}
  try {
    gridScale = await OBR.scene.grid.getScale();
  } catch {}

  let items: Item[] = [];
  try {
    items = await OBR.scene.items.getItems(targetIds);
  } catch {}
  const withLight = items.find((item) => LIGHT_KEY in item.metadata);
  if (!withLight) {
    setStatus(en ? "This token has no light." : "该目标没有光源。");
    return;
  }
  const config =
    normaliseLightConfig(
      (withLight.metadata as Record<string, unknown>)[LIGHT_KEY],
    ) ?? {};
  setStatus(null);
  paint(withDefaults(config, gridDpi));
}

// --- input wiring -----------------------------------------------------------

function commitRange(): void {
  if (syncing) return;
  const px = unitsToPx(rangeEl.value);
  if (!Number.isFinite(px) || px <= 0) {
    if (values) rangeEl.value = pxToUnits(values.attenuationRadius);
    return;
  }
  void patch({ attenuationRadius: px });
}

rangeEl.addEventListener("blur", commitRange);
rangeEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    commitRange();
    (event.target as HTMLElement).blur();
  } else if (event.key === "Escape") {
    if (values) rangeEl.value = pxToUnits(values.attenuationRadius);
    (event.target as HTMLElement).blur();
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    // One grid cell per press, ten with shift — same feel as upstream's
    // NumberField.
    event.preventDefault();
    if (!values) return;
    const step = gridDpi * (event.shiftKey ? 10 : 1);
    const next = Math.max(
      1,
      values.attenuationRadius + (event.key === "ArrowUp" ? step : -step),
    );
    values = { ...values, attenuationRadius: next };
    rangeEl.value = pxToUnits(next);
    void patch({ attenuationRadius: next });
  }
});

angleEl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.value) return;
  const cone = button.dataset.value === "CONE";
  setSegment(angleEl, button.dataset.value);
  rotateBtn.classList.toggle("hidden", !cone);
  void patch({
    innerAngle: cone ? ANGLE_CONE_INNER : ANGLE_FULL_INNER,
    outerAngle: cone ? ANGLE_CONE_OUTER : ANGLE_FULL_OUTER,
  });
});

edgeEl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.value) return;
  const soft = button.dataset.value === "SOFT";
  setSegment(edgeEl, button.dataset.value);
  const falloff = soft ? FALLOFF_SOFT : FALLOFF_HARD;
  falloffEl.value = String(falloff);
  falloffValEl.textContent = falloff.toFixed(2);
  void patch({ falloff });
});

typeEl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.value) return;
  setSegment(typeEl, button.dataset.value);
  void patch({ lightType: button.dataset.value as "PRIMARY" | "SECONDARY" });
});

let sliderTimer: number | null = null;
function scheduleSliderWrite(update: Partial<LightConfig>): void {
  if (sliderTimer !== null) clearTimeout(sliderTimer);
  sliderTimer = window.setTimeout(() => {
    sliderTimer = null;
    void patch(update);
  }, 120);
}

sourceEl.addEventListener("input", () => {
  if (syncing) return;
  const value = Number(sourceEl.value);
  sourceValEl.textContent = `${value} px`;
  scheduleSliderWrite({ sourceRadius: value });
});

falloffEl.addEventListener("input", () => {
  if (syncing) return;
  const value = Number(falloffEl.value);
  falloffValEl.textContent = value.toFixed(2);
  setSegment(edgeEl, value > 1 ? "SOFT" : "HARD");
  scheduleSliderWrite({ falloff: value });
});

/** Darkvision radius. 0 (or anything unparseable) means off, which
 *  is written as an explicit 0 rather than deleted, so a multi-select
 *  clears every light instead of leaving some on. */
function commitColorRadius(): void {
  if (syncing) return;
  const text = colorRadiusEl.value.trim();
  const parsed = parseFloat(text);
  if (text === "" || (Number.isFinite(parsed) && parsed <= 0)) {
    colorRadiusEl.value = "0";
    void patch({ colorRadius: 0 });
    return;
  }
  const px = unitsToPx(text);
  if (!Number.isFinite(px) || px <= 0) {
    if (values) {
      colorRadiusEl.value =
        values.colorRadius > 0 ? pxToUnits(values.colorRadius) : "0";
    }
    return;
  }
  void patch({ colorRadius: px });
}

colorRadiusEl.addEventListener("blur", commitColorRadius);
colorRadiusEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    commitColorRadius();
    (event.target as HTMLElement).blur();
  } else if (event.key === "Escape") {
    if (values) {
      colorRadiusEl.value =
        values.colorRadius > 0 ? pxToUnits(values.colorRadius) : "0";
    }
    (event.target as HTMLElement).blur();
  }
});

ambientEl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.value) return;
  setSegment(ambientEl, button.dataset.value);
  void patch({ ambient: button.dataset.value === "ON" });
});

rotateBtn.addEventListener("click", () => {
  if (!values) return;
  const rotation = (values.rotation + 90) % 360;
  values = { ...values, rotation };
  void patch({ rotation });
});

removeBtn.addEventListener("click", async () => {
  if (targetIds.length === 0) return;
  try {
    await OBR.scene.items.updateItems(targetIds, (items) => {
      for (const item of items) {
        delete (item.metadata as Record<string, unknown>)[LIGHT_KEY];
      }
    });
    setStatus(en ? "Light removed." : "光源已移除。");
  } catch (e) {
    console.error("[dynfog/light-edit] remove failed", e);
  }
});

OBR.onReady(async () => {
  await load();
  try {
    OBR.player.onChange(() => {
      void load();
    });
  } catch {}
  try {
    OBR.scene.items.onChange(() => {
      // Don't fight the user mid-edit: skip the repaint while a field
      // has focus.
      if (
        document.activeElement === rangeEl ||
        document.activeElement === colorRadiusEl
      ) {
        return;
      }
      void load();
    });
  } catch {}
});
