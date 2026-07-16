/**
 * Cliente Prisma como singleton reiniciable.
 *
 * Se expone `resetPrisma()` porque el módulo de respaldos necesita cerrar la
 * conexión SQLite antes de restaurar/importar un archivo de base de datos.
 */
import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "../config/paths";

let client: PrismaClient | null = null;

/** Devuelve el cliente actual (lo crea si no existe). */
export function prisma(): PrismaClient {
  if (!client) {
    ensureDatabaseUrl();
    client = new PrismaClient();
  }
  return client;
}

/** Cierra la conexión actual; la próxima llamada a `prisma()` reconecta. */
export async function resetPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
