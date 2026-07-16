/**
 * Resolución de rutas de datos de la aplicación.
 *
 * - En desarrollo la base vive en `database/prisma/dev.db` (raíz del repo).
 * - En producción Electron define `PC_DATA_DIR` apuntando al directorio
 *   `userData` del usuario, donde se guardan la base y los respaldos.
 */
import fs from "node:fs";
import path from "node:path";

/** Directorio raíz de datos (base de datos + respaldos). */
export function dataDir(): string {
  const dir =
    process.env.PC_DATA_DIR ??
    path.resolve(__dirname, "..", "..", "..", "database", "prisma");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ruta absoluta del archivo SQLite. */
export function databaseFile(): string {
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    const raw = process.env.DATABASE_URL.slice("file:".length);
    return path.isAbsolute(raw) ? raw : path.resolve(dataDir(), raw);
  }
  return path.join(dataDir(), "dev.db");
}

/** Directorio donde se guardan los respaldos `.sqlite`. */
export function backupsDir(): string {
  const dir = path.join(dataDir(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Garantiza que DATABASE_URL esté definida antes de instanciar Prisma.
 * Electron (o el usuario) puede definirla; si no, se usa la ruta por defecto.
 */
export function ensureDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${databaseFile()}`;
  }
}
