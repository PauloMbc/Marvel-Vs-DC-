import { defineConfig } from "vite";

export default defineConfig({
  // For GitHub Pages project hosting, use base: "/Marvel-Vs-DC-/".
  // For root-domain static hosting, keep "/".
  base: "/",
  build: { outDir: "dist", sourcemap: true }
});