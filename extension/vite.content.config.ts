import { defineConfig } from "vite";

const outDir = process.env.VERA5_OUT_DIR ?? "dist";

export default defineConfig({
  build: {
    outDir,
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      input: {
        content: "src/content/contentScript.ts",
      },
      output: {
        entryFileNames: "content.js",
        inlineDynamicImports: true,
      },
    },
  },
});
