# Vera5 bundled fonts

CSP forbids remote/CDN fonts, so the brand typefaces must ship locally as `woff2`
in this folder. The extension references them via `@font-face` in
`src/styles/tokens.css` using extension-relative paths (`/fonts/...`).
Injected content UI resolves the same files through `chrome.runtime.getURL`.

These Latin-subset woff2 files are checked in for Phase 1. The UI falls back to
the system stack if a face is missing.

| File                          | Family          | Weight | Used for                         |
| ----------------------------- | --------------- | ------ | -------------------------------- |
| `Inter-Regular.woff2`         | Inter           | 400    | UI / body                        |
| `Inter-Medium.woff2`          | Inter           | 500    | UI / body                        |
| `Inter-SemiBold.woff2`        | Inter           | 600    | labels / buttons                 |
| `Inter-Bold.woff2`            | Inter           | 700    | headings                         |
| `JetBrainsMono-Medium.woff2`  | JetBrains Mono  | 500    | IOC values, hashes, IPs, code    |
| `SpaceGrotesk-Bold.woff2`     | Space Grotesk   | 700    | the "Vera5" wordmark ONLY        |

Sources (SIL Open Font License):

- Inter: https://github.com/rsms/inter (latin subset, four weights)
- JetBrains Mono: https://github.com/JetBrains/JetBrainsMono
- Space Grotesk: https://github.com/floriankarsten/space-grotesk

Do not load fonts from a runtime CDN. Replace faces in-place if a fuller
glyph coverage subset is needed later.
