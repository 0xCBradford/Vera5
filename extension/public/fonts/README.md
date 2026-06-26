# Vera5 bundled fonts

CSP forbids remote/CDN fonts, so the brand typefaces must ship locally as `woff2`
in this folder. The extension references them via `@font-face` in
`src/styles/tokens.css` using extension-relative paths (`/fonts/...`).

Drop these exact files here (until then, the UI falls back to system fonts):

| File                          | Family          | Weight | Used for                         |
| ----------------------------- | --------------- | ------ | -------------------------------- |
| `Inter-Regular.woff2`         | Inter           | 400    | UI / body                        |
| `Inter-Medium.woff2`          | Inter           | 500    | UI / body                        |
| `Inter-SemiBold.woff2`        | Inter           | 600    | labels / buttons                 |
| `Inter-Bold.woff2`            | Inter           | 700    | headings                         |
| `JetBrainsMono-Medium.woff2`  | JetBrains Mono  | 500    | IOC values, hashes, IPs, code    |
| `SpaceGrotesk-Bold.woff2`     | Space Grotesk   | 700    | the "Vera5" wordmark ONLY        |

Sources (SIL Open Font License):

- Inter: https://github.com/rsms/inter (subset to the four weights above)
- JetBrains Mono: https://github.com/JetBrains/JetBrainsMono
- Space Grotesk: https://github.com/floriankarsten/space-grotesk
