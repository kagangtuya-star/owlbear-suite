#!/usr/bin/env node
// Plain-HTTP static server for the built `dist/`, used for local visual
// checks. The vite dev server runs behind a self-signed cert (basicSsl),
// which the in-app browser refuses, so this serves the same files over
// http instead.
//   node tools/static-server.mjs [port] [dir]
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] || 5199);
const root = process.argv[3] || "dist";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

createServer((req, res) => {
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (path.startsWith("/suite/")) path = path.slice("/suite".length);
  if (path.endsWith("/")) path += "index.html";
  const file = join(root, normalize(path).replace(/^[\\/]+/, ""));
  try {
    if (!statSync(file).isFile()) throw new Error("not a file");
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] || "application/octet-stream",
    "access-control-allow-origin": "*",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`static server on http://localhost:${port}/suite/`);
});
