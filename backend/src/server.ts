/**
 * Entrada standalone del backend (desarrollo: `npm run dev:backend`).
 * En producción Electron importa `startServer` de app.ts directamente.
 */
import { ensureDatabaseUrl } from "./config/paths";
import { DEFAULT_API_PORT, readPortEnv } from "./config/ports";
import { startServer } from "./app";

const PORT = readPortEnv(["PERSONAL_CONTROL_PORT", "PORT"], DEFAULT_API_PORT);

ensureDatabaseUrl();

startServer(PORT).catch((err) => {
  console.error("[api] No se pudo iniciar el servidor:", err);
  process.exit(1);
});
