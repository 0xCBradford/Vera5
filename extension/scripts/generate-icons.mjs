import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Generates the browser/extension icons (toolbar, extensions page, etc.) from
 * the canonical Vera5 logo mark. The transparent mark is centered on an
 * on-brand void-black tile so it reads cleanly at every size and on any
 * toolbar background. Run with: npm run icons
 */
const here = dirname(fileURLToPath(import.meta.url));
const markPath = resolve(here, "../../assets/logo-mark.svg");
const outDir = resolve(here, "../public/icons");
const sizes = [16, 32, 48, 128];
const TILE = "#0b0e11";

for (const size of sizes) {
  const padding = size <= 32 ? 1 : Math.round(size * 0.1);
  const inner = size - padding * 2;
  const mark = await sharp(markPath, { density: 512 })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: TILE },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(resolve(outDir, `icon${size}.png`));
  console.log(`generate-icons: wrote icon${size}.png`);
}
