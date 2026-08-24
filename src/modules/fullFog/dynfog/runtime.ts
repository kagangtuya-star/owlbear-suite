// Small synchronous cache of async scene facts the reconciler needs.
//
// Actors run inside a synchronous reconcile pass, so they can't await
// `OBR.scene.grid.getDpi()` or `OBR.player.getRole()`. This module keeps
// those values warm and hands out plain getters; the owning module
// (`dynfog/index.ts`) refreshes them and re-runs the reconciler when one
// actually changes.

import OBR from "@owlbear-rodeo/sdk";

let sceneDpi = 150;
let role: "GM" | "PLAYER" = "PLAYER";
let playerId = "";
/** GM setting: may players see and toggle door/window indicators? */
let playerOpenings = true;
/** GM setting: show the GM's indicators even without the fog tool. */
let alwaysShowOverlay = false;

export function getSceneDpi(): number {
  return sceneDpi;
}
export function getRole(): "GM" | "PLAYER" {
  return role;
}
export function isGM(): boolean {
  return role === "GM";
}
export function getPlayerId(): string {
  return playerId;
}
export function getPlayerOpeningsEnabled(): boolean {
  return playerOpenings;
}
export function getAlwaysShowOverlay(): boolean {
  return alwaysShowOverlay;
}

/** @returns true when the value actually changed. */
export function setSceneDpi(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (sceneDpi === value) return false;
  sceneDpi = value;
  return true;
}

export function setRole(value: "GM" | "PLAYER"): boolean {
  if (role === value) return false;
  role = value;
  return true;
}

export function setPlayerId(value: string): boolean {
  if (playerId === value) return false;
  playerId = value;
  return true;
}

export function setPlayerOpeningsEnabled(value: boolean): boolean {
  if (playerOpenings === value) return false;
  playerOpenings = value;
  return true;
}

export function setAlwaysShowOverlay(value: boolean): boolean {
  if (alwaysShowOverlay === value) return false;
  alwaysShowOverlay = value;
  return true;
}

/** Pull the current values from OBR. Returns true when anything moved. */
export async function refreshRuntime(): Promise<boolean> {
  let changed = false;
  try {
    changed = setRole((await OBR.player.getRole()) as "GM" | "PLAYER") || changed;
  } catch {}
  try {
    changed = setPlayerId(await OBR.player.getId()) || changed;
  } catch {}
  try {
    if (await OBR.scene.isReady()) {
      changed = setSceneDpi(await OBR.scene.grid.getDpi()) || changed;
    }
  } catch {}
  return changed;
}
