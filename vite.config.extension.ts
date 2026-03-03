import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "dist/extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        extension: path.resolve(__dirname, "extension.html"),
        background: path.resolve(__dirname, "client/background-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
  root: ".",
  publicDir: "public",
});
