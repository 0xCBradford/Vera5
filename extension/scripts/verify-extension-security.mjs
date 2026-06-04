import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const distDir = path.join(extensionRoot, "dist");
const publicManifestPath = path.join(
  extensionRoot,
  "public",
  "manifest.json"
);
const srcDir = path.join(extensionRoot, "src");

const LIVE_ENRICHMENT_FETCH_HOSTS = new Set([
  "api.abuseipdb.com",
  "otx.alienvault.com",
]);

const FETCH_ALLOWED_SOURCE_BASENAMES = new Set([
  "abuseipdbConnector.ts",
  "otxConnector.ts",
]);

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

function checkNoApiKeyLogging(filePath, source) {
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
    return;
  }

  const logCalls = source.matchAll(/console\.(log|debug|info|warn|error)\([^;]*/g);
  for (const match of logCalls) {
    const call = match[0];
    if (/apiKeys?|getApiKey|setApiKey|STORAGE_KEY_API_KEYS/i.test(call)) {
      fail(`${filePath} logs API key material via ${call.slice(0, 96)}`);
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

  for (const page of pages) {
    const htmlPath = path.join(distRoot, page);
    if (!fs.existsSync(htmlPath)) {
      fail(`extension page missing from dist: ${page}`);
    }
    checkExtensionPageHtml(htmlPath);
  }
}

function checkLiveFetchLimitedToConnectors() {
  for (const filePath of walkFiles(srcDir, [".ts", ".tsx"])) {
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    if (!/\bfetch\s*\(/.test(source)) {
      continue;
    }
    if (!FETCH_ALLOWED_SOURCE_BASENAMES.has(path.basename(filePath))) {
      fail(`${filePath} uses fetch() outside approved connector modules`);
    }
  }

  for (const basename of FETCH_ALLOWED_SOURCE_BASENAMES) {
    const filePath = path.join(srcDir, "lib", basename);
    const source = fs.readFileSync(filePath, "utf8");
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
      if (!LIVE_ENRICHMENT_FETCH_HOSTS.has(hostname)) {
        fail(`${basename} declares unexpected HTTPS origin: ${urlText}`);
      }
    }
  }
}

function checkConnectorFetchUsesGetWithoutBody(filePath, source) {
  const connectorFiles = new Set([
    "abuseipdbConnector.ts",
    "otxConnector.ts",
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
  fail("dist/ missing — run npm run build first");
}

const publicManifest = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
checkManifestCsp(publicManifestPath);
checkShippedExtensionPages(publicManifest, distDir);

if (fs.existsSync(path.join(distDir, "manifest.json"))) {
  const distManifest = JSON.parse(
    fs.readFileSync(path.join(distDir, "manifest.json"), "utf8")
  );
  checkManifestCsp(path.join(distDir, "manifest.json"));
  checkShippedExtensionPages(distManifest, distDir);
}

checkLiveFetchLimitedToConnectors();

for (const filePath of walkFiles(srcDir, [".ts", ".tsx", ".js"])) {
  const source = fs.readFileSync(filePath, "utf8");
  checkNoDynamicExecution("source", filePath, source);
  checkNoApiKeyLogging(filePath, source);
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

console.log(
  "verify-extension-security: OK (extension pages CSP, no remote assets, live fetch origins limited to connectors, no eval/new Function, no API key logging, enrichment GET without body)"
);
