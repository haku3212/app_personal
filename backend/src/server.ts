/**
 * Entrada standalone del backend (desarrollo: `npm run dev:backend`).
 * En producción Electron importa `startServer` de app.ts directamente.
 */
import { ensureDatabaseUrl } from "./config/paths";
import { startServer } from "./app";

const PORT = Number(process.env.PORT ?? 4310);

ensureDatabaseUrl();

startServer(PORT).catch((err) => {
  console.error("[api] No se pudo iniciar el servidor:", err);
  process.exit(1);
});
