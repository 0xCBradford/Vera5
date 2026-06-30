import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const outDir = process.env.VERA5_OUT_DIR ?? "dist";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        dev: "index.html",
        popup: "popup.html",
        sidepanel: "sidepanel.html",
        options: "options.html",
        background: "src/background/serviceWorker.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") return "background.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
