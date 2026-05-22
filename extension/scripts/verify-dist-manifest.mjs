import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const distDir = path.join(extensionRoot, "dist");

function fail(message) {
  console.error(`verify-dist-manifest: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(distDir, "manifest.json"))) {
  fail("dist/manifest.json missing — run npm run build first");
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(distDir, "manifest.json"), "utf8")
);

const required = new Set();

function add(relativePath) {
  if (typeof relativePath === "string" && relativePath.length > 0) {
    required.add(relativePath);
  }
}

add(manifest.background?.service_worker);
for (const entry of manifest.content_scripts ?? []) {
  for (const js of entry.js ?? []) {
    add(js);
  }
}
add(manifest.action?.default_popup);
add(manifest.options_page);
for (const iconPath of Object.values(manifest.icons ?? {})) {
  add(iconPath);
}
for (const iconPath of Object.values(manifest.action?.default_icon ?? {})) {
  add(iconPath);
}

const missingManifestPaths = [...required].filter(
  (relativePath) => !fs.existsSync(path.join(distDir, relativePath))
);
if (missingManifestPaths.length > 0) {
  fail(
    `manifest entries missing on disk:\n  ${missingManifestPaths.join("\n  ")}`
  );
}

function resolveDistRelative(baseFile, url) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return null;
  }
  if (url.startsWith("/")) {
    return url.slice(1);
  }
  return path.posix.join(path.posix.dirname(baseFile), url);
}

function checkHtml(htmlRelative) {
  const html = fs.readFileSync(path.join(distDir, htmlRelative), "utf8");
  const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(
    (match) => match[1]
  );
  const broken = [];
  for (const ref of refs) {
    const resolved = resolveDistRelative(htmlRelative, ref);
    if (!resolved) {
      continue;
    }
    if (!fs.existsSync(path.join(distDir, resolved))) {
      broken.push(`${htmlRelative} → ${ref}`);
    }
  }
  if (broken.length > 0) {
    fail(`broken HTML asset references:\n  ${broken.join("\n  ")}`);
  }
}

if (manifest.action?.default_popup) {
  checkHtml(manifest.action.default_popup);
}
if (manifest.options_page) {
  checkHtml(manifest.options_page);
}

function checkJs(jsRelative) {
  const source = fs.readFileSync(path.join(distDir, jsRelative), "utf8");
  const imports = [...source.matchAll(/from\s*["'](\.\/[^"']+)["']/g)].map(
    (match) => match[1]
  );
  const broken = [];
  for (const importPath of imports) {
    const resolved = path.posix.join(path.posix.dirname(jsRelative), importPath);
    if (!fs.existsSync(path.join(distDir, resolved))) {
      broken.push(`${jsRelative} → ${importPath}`);
    }
  }
  if (broken.length > 0) {
    fail(`broken bundle imports:\n  ${broken.join("\n  ")}`);
  }
}

if (manifest.background?.service_worker) {
  checkJs(manifest.background.service_worker);
}
for (const entry of manifest.content_scripts ?? []) {
  for (const js of entry.js ?? []) {
    const source = fs.readFileSync(path.join(distDir, js), "utf8");
    if (/\bfrom\s*["']\.\//.test(source)) {
      fail(
        `${js} must be self-contained (content_scripts cannot load unlisted split chunks)`
      );
    }
  }
}

for (const entry of manifest.content_scripts ?? []) {
  for (const js of entry.js ?? []) {
    checkJs(js);
  }
}

console.log(
  `verify-dist-manifest: OK (${required.size} manifest paths, HTML and JS references checked)`
);
