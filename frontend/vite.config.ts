import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const DEFAULT_API_PORT = 4311;
const DEFAULT_WEB_PORT = 5174;

function readPortEnv(names: string[], fallback: number): number {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isInteger(value) && value > 0 && value <= 65535) return value;
  }
  return fallback;
}

const apiPort = readPortEnv(["PERSONAL_CONTROL_PORT", "VITE_API_PORT"], DEFAULT_API_PORT);
const webPort = readPortEnv(["PERSONAL_CONTROL_WEB_PORT", "VITE_PORT"], DEFAULT_WEB_PORT);

// Configuración de Vite: alias "@" → src y proxy /api hacia el backend local.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: "127.0.0.1",
    port: webPort,
    proxy: {
      "/api": { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
