import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const chromeManifestPath = path.join(extensionRoot, "public", "manifest.json");
const firefoxManifestPath = path.join(
  extensionRoot,
  "public",
  "manifest.firefox.json"
);

function fail(message) {
  console.error(`verify-firefox-manifest: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  const absolutePath = path.join(extensionRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} missing`);
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON — ${error.message}`);
  }
}

function assertEqualArrays(label, left, right) {
  const leftJson = JSON.stringify(left ?? []);
  const rightJson = JSON.stringify(right ?? []);
  if (leftJson !== rightJson) {
    fail(`${label} must match Chrome manifest.json:\n  chrome: ${leftJson}\n  firefox: ${rightJson}`);
  }
}

const chrome = readJson(path.join("public", "manifest.json"));
const firefox = readJson(path.join("public", "manifest.firefox.json"));

if (firefox.manifest_version !== 3) {
  fail("manifest.firefox.json must declare manifest_version 3");
}

const gecko = firefox.browser_specific_settings?.gecko;
if (!gecko?.id || typeof gecko.id !== "string") {
  fail("browser_specific_settings.gecko.id is required for Firefox MV3 packaging");
}

if (!Array.isArray(gecko.data_collection_permissions?.required)) {
  fail("browser_specific_settings.gecko.data_collection_permissions.required must be set");
}

assertEqualArrays("permissions", chrome.permissions, firefox.permissions);
assertEqualArrays(
  "host_permissions",
  chrome.host_permissions,
  firefox.host_permissions
);

if (!Array.isArray(firefox.background?.scripts) || firefox.background.scripts.length === 0) {
  fail("Firefox background must declare scripts[] for MV3 event background");
}

if (firefox.background.service_worker) {
  fail(
    "manifest.firefox.json must use background.scripts only (Firefox loads event background; Chrome build keeps service_worker in manifest.json)"
  );
}

if (firefox.background.scripts[0] !== chrome.background?.service_worker) {
  fail(
    `Firefox background.scripts[0] must match Chrome service_worker entry (${chrome.background?.service_worker})`
  );
}

if (firefox.background.type !== "module") {
  fail('Firefox background.type must be "module" to match the built ES module bundle');
}

if (JSON.stringify(chrome.content_scripts) !== JSON.stringify(firefox.content_scripts)) {
  fail("content_scripts must match Chrome manifest.json");
}

if (JSON.stringify(chrome.commands) !== JSON.stringify(firefox.commands)) {
  fail("commands must match Chrome manifest.json");
}

console.log(
  `verify-firefox-manifest: OK (gecko id ${gecko.id}, ${firefox.permissions.length} permissions, ${firefox.host_permissions.length} host_permissions, background ${firefox.background.scripts.join(", ")})`
);
