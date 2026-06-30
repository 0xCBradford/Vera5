import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repoRoot = path.join(extensionRoot, "..");
const envExamplePath = path.join(repoRoot, ".env.example");
const distArg = process.argv.find((entry) => entry.startsWith("--dist="));
const distRelative =
  distArg?.slice("--dist=".length) ?? process.env.VERA5_DIST_DIR ?? "dist";
const distDir = path.join(extensionRoot, distRelative);
const publicManifestPath = path.join(
  extensionRoot,
  "public",
  distRelative === "dist-firefox" ? "manifest.firefox.json" : "manifest.json"
);
const publicFirefoxManifestPath = path.join(
  extensionRoot,
  "public",
  "manifest.firefox.json"
);
const srcDir = path.join(extensionRoot, "src");
const iocRequestBoundariesPath = path.join(
  srcDir,
  "lib",
  "iocRequestBoundaries.ts"
);

const FETCH_ALLOWED_SOURCE_BASENAMES = new Set([
  "abuseipdbConnector.ts",
  "otxConnector.ts",
  "urlscanConnector.ts",
  "greynoiseConnector.ts",
  "virustotalConnector.ts",
  "shodanConnector.ts",
  "censysConnector.ts",
]);

const FETCH_GUARD_SOURCE_BASENAMES = new Set([
  "iocRequestBoundaries.ts",
]);

const TELEMETRY_HOST_SUBSTRINGS = [
  "analytics.google.com",
  "google-analytics.com",
  "googletagmanager.com",
  "sentry.io",
  "amplitude.com",
  "mixpanel.com",
  "segment.io",
  "segment.com",
  "posthog.com",
  "bugsnag.com",
  "datadoghq.com",
  "newrelic.com",
  "hotjar.com",
  "fullstory.com",
  "heap.io",
  "crashlytics.com",
];

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

function checkManifestDeclaredHostPermissions(manifestPath, declaredHosts) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const hostPermissions = manifest.host_permissions ?? [];

  if (!hostPermissions.includes("https://*/*")) {
    fail(`${manifestPath} must include https://*/* for analyst page access`);
  }

  for (const hostname of declaredHosts) {
    const explicitPermission = `https://${hostname}/*`;
    if (!hostPermissions.includes(explicitPermission)) {
      fail(
        `${manifestPath} missing explicit host permission for declared enrichment API: ${explicitPermission}`
      );
    }
    if (
      !hostPermissions.some((pattern) =>
        manifestHostPatternCoversHttpsHostname(pattern, hostname)
      )
    ) {
      fail(
        `${manifestPath} host_permissions do not cover declared enrichment API host: ${hostname}`
      );
    }
  }
}

function fail(message) {
  console.error(`verify-extension-security: ${message}`);
  process.exit(1);
}

function walkFiles(dir, extensions, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, extensions, files);
      continue;
    }
    if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkNoDynamicExecution(label, filePath, source) {
  if (/\beval\s*\(/.test(source)) {
    fail(`${label} ${filePath} contains eval()`);
  }
  if (/\bnew\s+Function\s*\(/.test(source)) {
    fail(`${label} ${filePath} contains new Function()`);
  }
}

function checkNoSensitiveProductionLogging(filePath, source) {
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
    return;
  }

  const basename = path.basename(filePath);

  if (basename === "devLog.ts") {
    if (/console\.(log|debug|info|warn|error)\(/.test(source)) {
      if (!/import\.meta\.env\.DEV/.test(source)) {
        fail(`${filePath} must gate console output with import.meta.env.DEV`);
      }
      if (
        !/if\s*\(\s*!import\.meta\.env\.DEV\s*\)\s*\{\s*return;\s*\}/.test(
          source
        )
      ) {
        fail(`${filePath} must return before console output when not in DEV`);
      }
    }
    return;
  }

  if (basename === "extensionContext.ts") {
    if (/console\.error\s*\(\s*error\s*\)/.test(source)) {
      fail(`${filePath} must not log raw error objects`);
    }
    if (!source.includes("formatSafeExtensionErrorMessage")) {
      fail(`${filePath} must redact errors before console.error`);
    }
    return;
  }

  if (/console\.(log|debug|info|warn|error)\(/.test(source)) {
    fail(
      `${filePath} uses console outside allowlisted devLog/extensionContext modules`
    );
  }

  const logCalls = source.matchAll(/console\.(log|debug|info|warn|error)\([^;]*/g);
  const sensitivePatterns = [
    /apiKeys?/i,
    /getApiKey|setApiKey|STORAGE_KEY_API_KEYS/i,
    /\bmatches\b/,
    /\bentries\b/,
    /tabScanSnapshot/i,
    /rawVendorJson/i,
    /JSON\.stringify/,
    /snapshot\.entries/i,
    /X-OTX-API-KEY|\bKey:\s*apiKey/i,
  ];
  for (const match of logCalls) {
    const call = match[0];
    for (const pattern of sensitivePatterns) {
      if (pattern.test(call)) {
        fail(
          `${filePath} logs sensitive enrichment material via ${call.slice(0, 96)}`
        );
      }
    }
  }
}

function checkDistBundlesForTelemetryHosts(distRoot) {
  for (const filePath of walkFiles(distRoot, [".js"])) {
    const source = fs.readFileSync(filePath, "utf8").toLowerCase();
    for (const host of TELEMETRY_HOST_SUBSTRINGS) {
      if (source.includes(host)) {
        fail(`${filePath} references telemetry/analytics host: ${host}`);
      }
    }
  }
}

function checkDistProductionLogging(distRoot) {
  for (const filePath of walkFiles(distRoot, [".js"])) {
    const basename = path.basename(filePath);
    if (/^vendor-/.test(basename) || /^dev-/.test(basename)) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    if (/console\.debug\(/.test(source)) {
      fail(`${filePath} ships console.debug in production bundle`);
    }
    if (/console\.error\s*\(\s*[A-Za-z_$][\w$]*\s*\)/.test(source)) {
      fail(
        `${filePath} may log raw objects via console.error(variable) in production bundle`
      );
    }
  }
}

const LEGACY_INLINE_TEST_SECRET_LITERALS = [
  "test-abuse-key",
  "test-otx-key",
  "test-key",
  "bad-key",
  "configured-key",
  "stored-secret",
  "stored-abuse-key",
  "secret-key",
  "secret-abuse-key",
  "abuse-secret",
  "otx-secret",
  "other-secret",
  "current-key",
  "imported-key",
  "otx-test-key",
  "abuse-test-key",
  "fresh-secret",
];

const FIXTURE_SENSITIVE_FIELD_PATTERN =
  /^(key|api[_-]?key|x-otx-api-key|authorization|token|secret|password|bearer|access[_-]?token|refresh[_-]?token)$/i;

function isSensitiveFixtureFieldName(key) {
  const normalized = key.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (FIXTURE_SENSITIVE_FIELD_PATTERN.test(normalized)) {
    return true;
  }
  return (
    normalized.endsWith("_key") ||
    normalized.endsWith("-key") ||
    normalized.includes("apikey") ||
    normalized.includes("api_key")
  );
}

function checkCommittedFixtureJsonRedaction(value, filePath, keyPath = "") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      checkCommittedFixtureJsonRedaction(
        entry,
        filePath,
        `${keyPath}[${index}]`
      )
    );
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = keyPath ? `${keyPath}.${key}` : key;
    if (
      isSensitiveFixtureFieldName(key) &&
      typeof entry === "string" &&
      entry !== "[redacted]" &&
      !entry.startsWith("test-fixture-")
    ) {
      fail(
        `${filePath} ${nextPath} must use [redacted] or test-fixture-* placeholders`
      );
    }
    checkCommittedFixtureJsonRedaction(entry, filePath, nextPath);
  }
}

function isCredentialEnvVarName(name) {
  return (
    /_(API_KEY|API_SECRET|API_TOKEN|SECRET|PASSWORD|TOKEN)$/i.test(name) ||
    /^(API_KEY|API_SECRET|API_TOKEN)$/i.test(name)
  );
}

function checkEnvExampleDocumentsSecretsWithoutValues() {
  if (!fs.existsSync(envExamplePath)) {
    fail(".env.example missing at repository root");
  }

  const lines = fs.readFileSync(envExamplePath, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, name, rawValue] = match;
    if (!isCredentialEnvVarName(name)) {
      continue;
    }
    const value = rawValue.trim();
    if (value.length > 0) {
      fail(
        `.env.example line ${index + 1}: ${name} must be documented without a credential value`
      );
    }
  }
}

function checkTestFixtureRedaction() {
  const fixturesDir = path.join(srcDir, "lib", "fixtures");
  for (const filePath of walkFiles(fixturesDir, [".json"])) {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    checkCommittedFixtureJsonRedaction(payload, filePath);
  }

  for (const filePath of walkFiles(srcDir, [".test.ts", ".test.tsx"])) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const literal of LEGACY_INLINE_TEST_SECRET_LITERALS) {
      if (
        source.includes(`"${literal}"`) ||
        source.includes(`'${literal}'`)
      ) {
        fail(
          `${filePath} uses legacy inline secret fixture "${literal}"; import from fixtureSecrets.ts`
        );
      }
    }
  }
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

function checkExtensionPageHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const refs = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
  for (const ref of refs) {
    if (/^https?:\/\//i.test(ref)) {
      fail(`${htmlPath} references remote asset: ${ref}`);
    }
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) {
    fail(`${htmlPath} contains inline <script> without src`);
  }
  if (/<meta[^>]+http-equiv=["']Content-Security-Policy["']/i.test(html)) {
    fail(`${htmlPath} sets a document CSP meta tag (use manifest default CSP)`);
  }
}

function checkShippedExtensionPages(manifest, distRoot) {
  const pages = [];
  if (manifest.options_page) {
    pages.push(manifest.options_page);
  }
  if (manifest.action?.default_popup) {
    pages.push(manifest.action.default_popup);
  }
  if (manifest.side_panel?.default_path) {
    pages.push(manifest.side_panel.default_path);
  }
  if (manifest.sidebar_action?.default_panel) {
    pages.push(manifest.sidebar_action.default_panel);
  }

  for (const page of pages) {
    const htmlPath = path.join(distRoot, page);
    if (!fs.existsSync(htmlPath)) {
      fail(`extension page missing from dist: ${page}`);
    }
    checkExtensionPageHtml(htmlPath);
  }
}

function checkLiveFetchLimitedToConnectors() {
  const declaredHosts = new Set(readDeclaredEnrichmentApiHosts());

  for (const filePath of walkFiles(srcDir, [".ts", ".tsx"])) {
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    if (!/\bfetch\s*\(/.test(source)) {
      continue;
    }
    if (
      !FETCH_ALLOWED_SOURCE_BASENAMES.has(path.basename(filePath)) &&
      !FETCH_GUARD_SOURCE_BASENAMES.has(path.basename(filePath))
    ) {
      fail(`${filePath} uses fetch() outside approved connector modules`);
    }
  }

  for (const basename of FETCH_ALLOWED_SOURCE_BASENAMES) {
    const filePath = path.join(srcDir, "lib", basename);
    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes("enrichmentFetch")) {
      fail(`${basename} must import enrichmentFetch for outbound domain blocking`);
    }
    if (!/deps\.fetch\s*\?\?\s*enrichmentFetch/.test(source)) {
      fail(`${basename} must default to deps.fetch ?? enrichmentFetch`);
    }
    const literalUrls = [
      ...source.matchAll(/https:\/\/[^\s"'`<>]+/g),
    ].map((match) => match[0]);
    for (const urlText of literalUrls) {
      let hostname;
      try {
        hostname = new URL(urlText).hostname;
      } catch {
        continue;
      }
      if (!declaredHosts.has(hostname)) {
        fail(`${basename} declares unexpected HTTPS origin: ${urlText}`);
      }
    }
  }
}

function checkConnectorFetchUsesGetWithoutBody(filePath, source) {
  const connectorFiles = new Set([
    "abuseipdbConnector.ts",
    "otxConnector.ts",
    "urlscanConnector.ts",
    "greynoiseConnector.ts",
    "virustotalConnector.ts",
    "shodanConnector.ts",
    "censysConnector.ts",
  ]);
  if (!connectorFiles.has(path.basename(filePath))) {
    return;
  }
  if (/fetch\s*\([^)]*\{[^}]*\bbody\s*:/s.test(source)) {
    fail(`${filePath} sends a request body from an enrichment connector`);
  }
  if (!/\bmethod:\s*["']GET["']/.test(source)) {
    fail(`${filePath} must use GET for vendor enrichment requests`);
  }
}

if (!fs.existsSync(distDir)) {
  fail(`${distRelative}/ missing — run npm run build first`);
}

const publicManifest = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
const declaredEnrichmentApiHosts = readDeclaredEnrichmentApiHosts();
checkManifestCsp(publicManifestPath);
if (publicManifestPath !== publicFirefoxManifestPath && fs.existsSync(publicFirefoxManifestPath)) {
  checkManifestCsp(publicFirefoxManifestPath);
}
checkManifestDeclaredHostPermissions(
  publicManifestPath,
  declaredEnrichmentApiHosts
);
checkShippedExtensionPages(publicManifest, distDir);

if (fs.existsSync(path.join(distDir, "manifest.json"))) {
  const distManifest = JSON.parse(
    fs.readFileSync(path.join(distDir, "manifest.json"), "utf8")
  );
  checkManifestCsp(path.join(distDir, "manifest.json"));
  checkManifestDeclaredHostPermissions(
    path.join(distDir, "manifest.json"),
    declaredEnrichmentApiHosts
  );
  checkShippedExtensionPages(distManifest, distDir);
}

checkLiveFetchLimitedToConnectors();

for (const filePath of walkFiles(srcDir, [".ts", ".tsx", ".js"])) {
  const source = fs.readFileSync(filePath, "utf8");
  checkNoDynamicExecution("source", filePath, source);
  checkNoSensitiveProductionLogging(filePath, source);
  checkConnectorFetchUsesGetWithoutBody(filePath, source);
}

for (const filePath of walkFiles(distDir, [".js"])) {
  const source = fs.readFileSync(filePath, "utf8");
  checkNoDynamicExecution("dist", filePath, source);
  if (/import\s*\(\s*["']https?:\/\//.test(source)) {
    fail(`${filePath} dynamically imports a remote module URL`);
  }
  if (/importScripts\s*\(\s*["']https?:\/\//.test(source)) {
    fail(`${filePath} loads remote code via importScripts()`);
  }
}

checkDistBundlesForTelemetryHosts(distDir);
checkDistProductionLogging(distDir);
checkTestFixtureRedaction();
checkEnvExampleDocumentsSecretsWithoutValues();

console.log(
  `verify-extension-security: OK (${distRelative}, extension pages CSP, no remote assets, no telemetry hosts in bundles, live fetch blocked outside declared API hosts, no eval/new Function, no sensitive production logging, redacted test fixtures, .env.example credential placeholders empty, enrichment GET without body)`
);
