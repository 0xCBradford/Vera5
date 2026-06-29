import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const distRelative = "dist-firefox";
const distDir = path.join(extensionRoot, distRelative);
const firefoxManifestSource = path.join(
  extensionRoot,
  "public",
  "manifest.firefox.json"
);

function fail(message) {
  console.error(`build-firefox: ${message}`);
  process.exit(1);
}

function run(label, command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: extensionRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

run("verify:firefox-manifest", "npm", ["run", "verify:firefox-manifest"]);

run("vite build (shells + background)", "npx", ["vite", "build"], {
  VERA5_OUT_DIR: distRelative,
});

run("vite build (content script)", "npx", ["vite", "build", "-c", "vite.content.config.ts"], {
  VERA5_OUT_DIR: distRelative,
});

if (!fs.existsSync(firefoxManifestSource)) {
  fail("public/manifest.firefox.json missing");
}

const firefoxManifest = JSON.parse(
  fs.readFileSync(firefoxManifestSource, "utf8")
);
fs.writeFileSync(
  path.join(distDir, "manifest.json"),
  `${JSON.stringify(firefoxManifest, null, 2)}\n`
);

const shippedFirefoxSourceManifest = path.join(distDir, "manifest.firefox.json");
if (fs.existsSync(shippedFirefoxSourceManifest)) {
  fs.rmSync(shippedFirefoxSourceManifest);
}

run("verify:dist-firefox", "node", ["scripts/verify-dist-manifest.mjs"], {
  VERA5_DIST_DIR: distRelative,
});

console.log(`build-firefox: OK (${distRelative}/ ready for temporary Firefox load)`);
