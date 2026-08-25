// Build-size + source-size report, so a cleanup pass can prove what it
// actually bought instead of asserting it.
//
//   node tools/size-report.mjs            print the current numbers
//   node tools/size-report.mjs --save     write tools/.size-baseline.json
//   node tools/size-report.mjs --diff     compare against that baseline
//
// Run `npm run build` first — this reads dist/, it does not build.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = path.join(ROOT, "dist");
const SRC = path.join(ROOT, "src");
const BASELINE = path.join(ROOT, "tools", ".size-baseline.json");

function walk(dir, filter, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

function gzipSize(file) {
  return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
}

function collect() {
  if (!fs.existsSync(DIST)) {
    throw new Error("dist/ not found — run `npm run build` first");
  }

  // Per-chunk gzip. Names carry a content hash, so key on the stable
  // prefix instead: background-2ZwHNOU2.js -> background.
  const chunks = {};
  for (const file of walk(path.join(DIST, "assets"), (f) => f.endsWith(".js"))) {
    const base = path.basename(file);
    const key = base.replace(/-[A-Za-z0-9_-]{8,}\.js$/, "");
    chunks[key] = (chunks[key] ?? 0) + gzipSize(file);
  }

  // The boot path: every chunk background.html pulls before the
  // extension can do anything. This is the number that matters most —
  // every client pays it on every load, and it is easy to regress by
  // importing something big for one string.
  const bootHtml = path.join(DIST, "background.html");
  let bootChunks = 0;
  let bootGzip = 0;
  if (fs.existsSync(bootHtml)) {
    const html = fs.readFileSync(bootHtml, "utf8");
    const names = [
      ...new Set([...html.matchAll(/\/assets\/([^"]+\.js)"/g)].map((m) => m[1])),
    ];
    bootChunks = names.length;
    for (const n of names) {
      const f = path.join(DIST, "assets", n);
      if (fs.existsSync(f)) bootGzip += gzipSize(f);
    }
  }

  const sources = walk(SRC, (f) => /\.tsx?$/.test(f));
  const lines = sources.reduce(
    (n, f) => n + fs.readFileSync(f, "utf8").split("\n").length,
    0,
  );

  const publicDir = path.join(ROOT, "public");
  const publicBytes = walk(publicDir, () => true).reduce(
    (n, f) => n + fs.statSync(f).size,
    0,
  );

  return {
    chunks,
    totalChunkGzip: Object.values(chunks).reduce((a, b) => a + b, 0),
    bootChunks,
    bootGzip,
    sourceFiles: sources.length,
    sourceLines: lines,
    publicBytes,
  };
}

function kb(n) {
  return (n / 1024).toFixed(1) + " kB";
}

const now = collect();
const mode = process.argv[2];

if (mode === "--save") {
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
  console.log("baseline written to tools/.size-baseline.json");
} else if (mode === "--diff") {
  if (!fs.existsSync(BASELINE)) throw new Error("no baseline — run --save first");
  const was = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const keys = [...new Set([...Object.keys(was.chunks), ...Object.keys(now.chunks)])];
  const rows = keys
    .map((k) => ({ k, a: was.chunks[k] ?? 0, b: now.chunks[k] ?? 0 }))
    .filter((r) => r.a !== r.b)
    .sort((x, y) => x.b - x.a - (y.b - y.a));
  if (rows.length === 0) console.log("no chunk changed size");
  for (const r of rows) {
    const d = r.b - r.a;
    console.log(
      `  ${r.k.padEnd(28)} ${kb(r.a).padStart(9)} -> ${kb(r.b).padStart(9)}  ${
        d > 0 ? "+" : ""
      }${kb(d)}`,
    );
  }
  if (was.bootGzip !== undefined) {
    const db = now.bootGzip - was.bootGzip;
    console.log(
      `
  ${"BOOT path (gzip)".padEnd(28)} ${kb(was.bootGzip).padStart(9)} -> ${kb(now.bootGzip).padStart(9)}  ${db > 0 ? "+" : ""}${kb(db)}   [${was.bootChunks} -> ${now.bootChunks} chunks]`,
    );
  }
  const dTotal = now.totalChunkGzip - was.totalChunkGzip;
  console.log(
    `\n  ${"TOTAL js (gzip)".padEnd(28)} ${kb(was.totalChunkGzip).padStart(9)} -> ${kb(
      now.totalChunkGzip,
    ).padStart(9)}  ${dTotal > 0 ? "+" : ""}${kb(dTotal)}`,
  );
  console.log(
    `  ${"source lines".padEnd(28)} ${String(was.sourceLines).padStart(9)} -> ${String(
      now.sourceLines,
    ).padStart(9)}  ${now.sourceLines - was.sourceLines >= 0 ? "+" : ""}${
      now.sourceLines - was.sourceLines
    }`,
  );
  console.log(
    `  ${"source files".padEnd(28)} ${String(was.sourceFiles).padStart(9)} -> ${String(
      now.sourceFiles,
    ).padStart(9)}  ${now.sourceFiles - was.sourceFiles >= 0 ? "+" : ""}${
      now.sourceFiles - was.sourceFiles
    }`,
  );
  console.log(
    `  ${"public/ bytes".padEnd(28)} ${kb(was.publicBytes).padStart(9)} -> ${kb(
      now.publicBytes,
    ).padStart(9)}  ${now.publicBytes - was.publicBytes > 0 ? "+" : ""}${kb(
      now.publicBytes - was.publicBytes,
    )}`,
  );
} else {
  const rows = Object.entries(now.chunks).sort((a, b) => b[1] - a[1]);
  console.log("chunk gzip sizes (top 15):");
  for (const [k, v] of rows.slice(0, 15)) {
    console.log(`  ${k.padEnd(28)} ${kb(v).padStart(9)}`);
  }
  console.log(
    `\n  BOOT path        ${kb(now.bootGzip)} across ${now.bootChunks} chunks`,
  );
  console.log(`  total js (gzip)  ${kb(now.totalChunkGzip)}`);
  console.log(`  source           ${now.sourceFiles} files, ${now.sourceLines} lines`);
  console.log(`  public/          ${kb(now.publicBytes)}`);
}
