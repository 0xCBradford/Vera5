import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
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
