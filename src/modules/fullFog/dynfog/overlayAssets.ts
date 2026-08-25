// Billboard images for the door / secret door / window / light
// indicators.
//
// `buildBillboard` needs explicit width/height/mime — Owlbear will not
// probe an SVG for its intrinsic size. 80×80 matches upstream's assets.

import type { ImageContent } from "@owlbear-rodeo/sdk";
import { assetUrl } from "../../../asset-base";
import type { OpeningKind } from "./opening/types";

function billboard(file: string): ImageContent {
  return {
    url: assetUrl(file),
    width: 80,
    height: 80,
    mime: "image/svg+xml",
  };
}

export const DOOR_CLOSED_IMAGE = billboard("fullfog-door-closed.svg");
export const DOOR_OPEN_IMAGE = billboard("fullfog-door-open.svg");
/** Shut window = a glazed pane. Still see-through — see
 *  `opening/types.ts` for why that isn't a contradiction. */
export const WINDOW_CLOSED_IMAGE = billboard("fullfog-window-billboard.svg");
/** Window swung open: see-through AND passable. */
export const WINDOW_OPEN_IMAGE = billboard("fullfog-window-open.svg");
export const SECRET_CLOSED_IMAGE = billboard("fullfog-secret-closed.svg");
export const SECRET_OPEN_IMAGE = billboard("fullfog-secret-open.svg");
export const LIGHT_IMAGE = billboard("fullfog-light-billboard.svg");

export function openingImage(kind: OpeningKind, open: boolean): ImageContent {
  if (kind === "window") {
    return open ? WINDOW_OPEN_IMAGE : WINDOW_CLOSED_IMAGE;
  }
  if (kind === "secret") {
    return open ? SECRET_OPEN_IMAGE : SECRET_CLOSED_IMAGE;
  }
  return open ? DOOR_OPEN_IMAGE : DOOR_CLOSED_IMAGE;
}

// Toolbar / context-menu icons (24×24 line art).
export const ICON_DOOR = assetUrl("fullfog-door-icon.svg");
export const ICON_WINDOW = assetUrl("fullfog-window-icon.svg");
export const ICON_SECRET = assetUrl("fullfog-secret-icon.svg");
export const ICON_LINE = assetUrl("fullfog-line-icon.svg");
export const ICON_TOGGLE = assetUrl("fullfog-toggle-icon.svg");
export const ICON_LIGHT = assetUrl("fullfog-light-icon.svg");
export const ICON_FOG = assetUrl("fullfog-icon.svg");
