// Node entry: writes the dynfog geometry proof sheet to an SVG file.
import { writeFileSync } from "node:fs";
import { renderDynfogSvg } from "../src/modules/fullFog/dynfog/visual";

const out = process.argv[2] || "dynfog-walls.svg";
writeFileSync(out, renderDynfogSvg(), "utf8");
console.log(`wrote ${out}`);
