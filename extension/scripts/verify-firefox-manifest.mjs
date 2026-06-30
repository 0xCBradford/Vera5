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
const iocRequestBoundariesPath = path.join(
  extensionRoot,
  "src",
  "lib",
  "iocRequestBoundaries.ts"
);

function readDeclaredEnrichmentApiHosts() {
  const source = fs.readFileSync(iocRequestBoundariesPath, "utf8");
  const match = source.match(
    /export const DECLARED_ENRICHMENT_API_HOSTS[^=]*=\s*\[([\s\S]*?)\]\s*as const/
  );
  if (!match) {
    fail(
      "could not parse DECLARED_ENRICHMENT_API_HOSTS from iocRequestBoundaries.ts"
    );
  }
  const hosts = [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
  if (hosts.length === 0) {
    fail("DECLARED_ENRICHMENT_API_HOSTS is empty in iocRequestBoundaries.ts");
  }
  return hosts;
}

function manifestHostPatternCoversHttpsHostname(pattern, hostname) {
  if (pattern === "https://*/*") {
    return true;
  }
  if (!pattern.startsWith("https://") || !pattern.endsWith("/*")) {
    return false;
  }
  const hostPattern = pattern.slice("https://".length, -2);
  if (hostPattern.startsWith("*.")) {
    const suffix = hostPattern.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }
  return hostname === hostPattern;
}

function checkManifestCsp(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const csp =
    manifest.content_security_policy?.extension_pages ??
    manifest.content_security_policy;
  if (typeof csp !== "string") {
    return;
  }
  const unsafe = ["unsafe-eval", "unsafe-inline"];
  for (const token of unsafe) {
    if (csp.includes(token)) {
      fail(`manifest CSP includes ${token}: ${csp}`);
    }
  }
  if (/script-src[^;]*https?:/i.test(csp)) {
    fail(`manifest CSP script-src includes a remote origin: ${csp}`);
  }
}

function checkManifestDeclaredHostPermissions(manifestLabel, manifest, declaredHosts) {
  const hostPermissions = manifest.host_permissions ?? [];

  if (!hostPermissions.includes("https://*/*")) {
    fail(`${manifestLabel} must include https://*/* for analyst page access`);
  }

  for (const hostname of declaredHosts) {
    const explicitPermission = `https://${hostname}/*`;
    if (!hostPermissions.includes(explicitPermission)) {
      fail(
        `${manifestLabel} missing explicit host permission for declared enrichment API: ${explicitPermission}`
      );
    }
    if (
      !hostPermissions.some((pattern) =>
        manifestHostPatternCoversHttpsHostname(pattern, hostname)
      )
    ) {
      fail(
        `${manifestLabel} host_permissions do not cover declared enrichment API host: ${hostname}`
      );
    }
  }
}

// Permissions that exist only on the Chromium build. The native Side Panel is
// Chromium-only (`chrome.sidePanel`); Firefox keeps its declared popup action
// instead, so the manifests intentionally diverge by exactly these entries.
const CHROME_ONLY_PERMISSIONS = new Set(["sidePanel"]);

function checkManifestRemoteOriginPosture(manifestLabel, manifest, chromeManifest) {
  if (manifest.options_page !== chromeManifest.options_page) {
    fail(`${manifestLabel} options_page must match Chrome manifest.json`);
  }

  // Chromium drives its action via the native Side Panel and therefore omits
  // action.default_popup. Firefox retains popup.html as its action surface.
  if (chromeManifest.side_panel?.default_path) {
    if (chromeManifest.action?.default_popup) {
      fail(
        "Chrome manifest.json must not declare action.default_popup while using side_panel (the popup would preempt openPanelOnActionClick)"
      );
    }
    if (!manifest.action?.default_popup) {
      fail(`${manifestLabel} must keep action.default_popup as its action surface`);
    }
    if (manifest.side_panel) {
      fail(`${manifestLabel} must not declare side_panel (Chromium-only API)`);
    }
    // Firefox has no chrome.sidePanel; it hosts the same persistent workspace
    // via sidebar_action pointed at the shared side-panel document. Chromium
    // ignores sidebar_action, so the two surfaces are declared per-browser.
    if (chromeManifest.sidebar_action) {
      fail(
        "Chrome manifest.json must not declare sidebar_action (Firefox-only API)"
      );
    }
    if (
      manifest.sidebar_action?.default_panel !== chromeManifest.side_panel.default_path
    ) {
      fail(
        `${manifestLabel} must host the workspace via sidebar_action.default_panel (${chromeManifest.side_panel.default_path})`
      );
    }
    return;
  }

  if (manifest.action?.default_popup !== chromeManifest.action?.default_popup) {
    fail(`${manifestLabel} action.default_popup must match Chrome manifest.json`);
  }
}

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

if (
  JSON.stringify(gecko.data_collection_permissions.required) !==
  JSON.stringify(["none"])
) {
  fail(
    'browser_specific_settings.gecko.data_collection_permissions.required must be ["none"] (no Mozilla data collection declared)'
  );
}

const chromeSharedPermissions = (chrome.permissions ?? []).filter(
  (permission) => !CHROME_ONLY_PERMISSIONS.has(permission)
);
const firefoxChromeOnlyPermissions = (firefox.permissions ?? []).filter(
  (permission) => CHROME_ONLY_PERMISSIONS.has(permission)
);
if (firefoxChromeOnlyPermissions.length > 0) {
  fail(
    `manifest.firefox.json must not declare Chromium-only permissions: ${firefoxChromeOnlyPermissions.join(", ")}`
  );
}
assertEqualArrays("permissions", chromeSharedPermissions, firefox.permissions);
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

const declaredEnrichmentApiHosts = readDeclaredEnrichmentApiHosts();
checkManifestDeclaredHostPermissions(
  "manifest.json",
  chrome,
  declaredEnrichmentApiHosts
);
checkManifestDeclaredHostPermissions(
  "manifest.firefox.json",
  firefox,
  declaredEnrichmentApiHosts
);

checkManifestCsp(chromeManifestPath);
checkManifestCsp(firefoxManifestPath);
checkManifestRemoteOriginPosture("manifest.firefox.json", firefox, chrome);

if (
  JSON.stringify(chrome.web_accessible_resources ?? []) !==
  JSON.stringify(firefox.web_accessible_resources ?? [])
) {
  fail("web_accessible_resources must match Chrome manifest.json");
}

if (
  JSON.stringify(chrome.content_security_policy ?? null) !==
  JSON.stringify(firefox.content_security_policy ?? null)
) {
  fail("content_security_policy must match Chrome manifest.json");
}

console.log(
  `verify-firefox-manifest: OK (gecko id ${gecko.id}, ${firefox.permissions.length} permissions, ${firefox.host_permissions.length} host_permissions, ${declaredEnrichmentApiHosts.length} declared enrichment API hosts covered, default MV3 CSP posture, no Mozilla data collection, background ${firefox.background.scripts.join(", ")})`
);
