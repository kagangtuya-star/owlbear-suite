#!/usr/bin/env node
// Bundle + run the dynfog geometry self-test under node.
//   node tools/dynfog-selftest.mjs
//
// Uses rolldown (already a vite dependency) so there's nothing extra to
// install and no network access is needed.
//
// The Owlbear SDK reads `window.location` at module scope to find its
// parent frame, so the bundle gets a minimal DOM shim prepended. None of
// the geometry under test touches the DOM — the shim only exists so the
// import doesn't throw.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("rolldown/package.json");
const pkg = require("rolldown/package.json");
const rolldownBin = join(dirname(pkgPath), pkg.bin.rolldown);

const BANNER = `
globalThis.window = globalThis.window || {
  location: { search: "", origin: "http://localhost", href: "http://localhost/" },
  addEventListener() {}, removeEventListener() {}, postMessage() {},
  parent: { postMessage() {} },
  setTimeout: setTimeout, clearTimeout: clearTimeout,
};
globalThis.document = globalThis.document || {
  addEventListener() {}, removeEventListener() {},
  createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
  documentElement: { style: {} },
};
globalThis.self = globalThis.self || globalThis;
`;

const entry = process.env.DYNFOG_ENTRY || "tools/dynfog-selftest.entry.ts";
const runArgs = process.argv.slice(2);
const out = mkdtempSync(join(tmpdir(), "dynfog-selftest-"));
const bundle = join(out, "selftest.mjs");
try {
  execFileSync(
    process.execPath,
    [
      rolldownBin,
      entry,
      "-o", bundle,
      "-f", "esm",
      "-p", "node",
      "--banner", BANNER,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync(process.execPath, [bundle, ...runArgs], { stdio: "inherit" });
} finally {
  rmSync(out, { recursive: true, force: true });
}
