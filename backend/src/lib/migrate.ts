/**
 * Runner de migraciones embebido.
 *
 * En desarrollo las migraciones se aplican con `prisma migrate dev`.
 * En producción (Electron, 100 % offline) no existe la CLI de Prisma,
 * así que este runner aplica los .sql de `database/prisma/migrations`
 * directamente, usando la misma tabla de control `_prisma_migrations`
 * para no re-aplicar nada que ya esté registrado.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "./prisma";

/** Directorio de migraciones (Electron lo define vía PC_MIGRATIONS_DIR). */
function migrationsDir(): string {
  return (
    process.env.PC_MIGRATIONS_DIR ??
    path.resolve(__dirname, "..", "..", "..", "database", "prisma", "migrations")
  );
}

/** Crea la tabla de control si la base es nueva (mismo esquema que Prisma). */
async function ensureMigrationsTable(): Promise<void> {
  await prisma().$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);
}

/** Divide un archivo de migración en sentencias SQL individuales. */
function splitStatements(sql: string): string[] {
  // Primero se eliminan las líneas de comentario (-- CreateTable, etc.)
  // para que no queden pegadas al inicio de cada sentencia.
  const clean = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return clean
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Aplica las migraciones pendientes en orden. */
export async function runMigrations(): Promise<void> {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return;

  await ensureMigrationsTable();
  const applied = new Set(
    (
      await prisma().$queryRawUnsafe<{ migration_name: string }[]>(
        `SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`,
      )
    ).map((r) => r.migration_name),
  );

  const folders = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const name of folders) {
    if (applied.has(name)) continue;
    const sqlFile = path.join(dir, name, "migration.sql");
    if (!fs.existsSync(sqlFile)) continue;

    console.log(`[db] Aplicando migración ${name}…`);
    const sql = fs.readFileSync(sqlFile, "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    for (const statement of splitStatements(sql)) {
      await prisma().$executeRawUnsafe(statement);
    }
    await prisma().$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
       VALUES ('${crypto.randomUUID()}', '${checksum}', '${name}', current_timestamp, 1)`,
    );
  }
}
