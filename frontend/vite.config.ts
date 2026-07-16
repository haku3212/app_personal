import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Configuración de Vite: alias "@" → src y proxy /api hacia el backend local.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:4310", changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
