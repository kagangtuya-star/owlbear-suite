// Regenerates the opening-indicator billboards.
//
// The old ones were upstream's: a door pictogram in a dark disc. A
// pictogram has an up, so it only reads from one side of the table, and
// half of one is unrecognisable — which matters because the player-side
// indicator sits UNDER the fog and is routinely half-covered.
//
// The replacement is a ring with four chevrons at 12/3/6/9 o'clock, so
// it has 4-fold rotational symmetry: any single quadrant identifies the
// whole mark, from any seat. State is encoded twice over, once in the
// chevron direction (out = open, in = shut) and once in colour, so it
// still reads without colour vision.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public", import.meta.url));

// Geometry, in the 80×80 box every billboard uses.
const C = 40; // centre
const R = 30; // ring radius
// Chevron apex / arms as distances from the centre along the axis.
const APEX_OUT = 22; // open: apex here, pointing away from the centre
const ARM_OUT = 10; // …arms this far back, and ±12 to the sides
const ARM_HALF = 12;

/** The 12-o'clock chevron; the other three are rotations of it. */
function chevron(open) {
  const apexY = open ? C - APEX_OUT : C - ARM_OUT;
  const armY = open ? C - ARM_OUT : C - APEX_OUT;
  return `M${C - ARM_HALF} ${armY} L${C} ${apexY} L${C + ARM_HALF} ${armY}`;
}

function svg({ color, open, dashed }) {
  const d = chevron(open);
  const ring = dashed ? ` stroke-dasharray="7 6"` : "";
  const arms = [0, 90, 180, 270]
    .map(
      (deg) =>
        `    <path d="${d}"${
          deg ? ` transform="rotate(${deg} ${C} ${C})"` : ""
        }/>`,
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <circle cx="${C}" cy="${C}" r="${R}" fill="#12151E" fill-opacity=".78"/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#12151E" stroke-opacity=".9" stroke-width="7"${ring}/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${color}" stroke-width="4"${ring}/>
  <g fill="none" stroke="#12151E" stroke-opacity=".9" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
${arms}
  </g>
  <g fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
${arms}
  </g>
</svg>
`;
}

// Colours are the ones in ids.ts, so the billboard and the coloured
// stretch of wall it sits on always agree.
const FILES = {
  "fullfog-door-open.svg": { color: "#85ff66", open: true },
  "fullfog-door-closed.svg": { color: "#ff4d4d", open: false },
  "fullfog-window-open.svg": { color: "#66ffd9", open: true },
  "fullfog-window-closed.svg": { color: "#5dade2", open: false },
  // Secret doors carry the dashed ring their indicator line already
  // uses, so the GM can tell one from a door the party can see.
  "fullfog-secret-open.svg": { color: "#d8a6ff", open: true, dashed: true },
  "fullfog-secret-closed.svg": { color: "#b06bff", open: false, dashed: true },
};

for (const [name, spec] of Object.entries(FILES)) {
  fs.writeFileSync(`${OUT}/${name}`, svg(spec));
  console.log("wrote", name);
}

// Retired: the old shut-window billboard, replaced by the -closed name
// so every kind now follows the same open/closed pattern.
const stale = `${OUT}/fullfog-window-billboard.svg`;
if (fs.existsSync(stale)) {
  fs.rmSync(stale);
  console.log("removed fullfog-window-billboard.svg");
}
