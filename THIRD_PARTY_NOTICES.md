# Third-Party Notices

Vera5 is licensed under the [MIT License](LICENSE). This file lists third-party software **included in the shipped browser extension package** built from `extension/` into `extension/dist/` (and packaged by `scripts/package-extension.ps1` for store upload).

Development-only dependencies (Vite, ESLint, Vitest, Playwright, TypeScript, and similar tooling) are **not** bundled into `dist/` and are not listed here.

---

## Bundled JavaScript libraries

The production build minifies and ships the following npm production dependencies in extension bundles (for example `assets/vendor-*.js` used by the popup and options pages):

### React

| Field | Value |
|-------|-------|
| Package | `react` |
| Version | 19.2.6 (see `extension/package.json`) |
| License | MIT |
| Copyright | Copyright (c) Meta Platforms, Inc. and affiliates. |
| Project | https://github.com/facebook/react |
| Use in Vera5 | Popup and options UI components |

### React DOM

| Field | Value |
|-------|-------|
| Package | `react-dom` |
| Version | 19.2.6 (see `extension/package.json`) |
| License | MIT |
| Copyright | Copyright (c) Meta Platforms, Inc. and affiliates. |
| Project | https://github.com/facebook/react |
| Use in Vera5 | Popup and options UI rendering |

### MIT License (React / React DOM)

```
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Bundled fonts (when shipped)

Manifest V3 content security policy requires local fonts (no remote CDN). When `woff2` files are present under `extension/dist/fonts/`, they are redistributed under the **SIL Open Font License 1.1**:

| Font family | Files (expected) | Upstream | License |
|-------------|------------------|----------|---------|
| Inter | `Inter-Regular.woff2`, `Inter-Medium.woff2`, `Inter-SemiBold.woff2`, `Inter-Bold.woff2` | https://github.com/rsms/inter | SIL Open Font License 1.1 |
| JetBrains Mono | `JetBrainsMono-Medium.woff2` | https://github.com/JetBrains/JetBrainsMono | SIL Open Font License 1.1 |
| Space Grotesk | `SpaceGrotesk-Bold.woff2` | https://github.com/floriankarsten/space-grotesk | SIL Open Font License 1.1 |

File names and usage: [extension/public/fonts/README.md](extension/public/fonts/README.md). If font binaries are absent from a build, the UI falls back to system fonts; no font files are included in that package.

---

## Third-party threat-intelligence services (not bundled)

Live enrichment connectors call vendor APIs over HTTPS when **you** enable them and supply **your** API keys. Vera5 does not redistribute vendor SDKs, datasets, or maintainer API credentials. Service terms and privacy policies are owned by each vendor; see [docs/api-integrations.md — Vendor terms, privacy, and acceptable use](docs/api-integrations.md#vendor-terms-privacy-and-acceptable-use). Vera5 source code includes connector modules and pivot link templates only.

---

## Updating this file

When production dependencies in `extension/package.json` change, or when new assets ship inside `extension/dist/`, update this notice and verify licenses before release. Run `npm run build` in `extension/` and inspect `dist/` for new bundled artifacts.
