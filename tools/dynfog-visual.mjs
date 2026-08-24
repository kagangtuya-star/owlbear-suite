#!/usr/bin/env node
// Render the dynfog geometry proof sheet.
//   node tools/dynfog-visual.mjs [out.svg]
process.env.DYNFOG_ENTRY = "tools/dynfog-visual.entry.ts";
await import("./dynfog-selftest.mjs");
