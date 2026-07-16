/**
 * Módulo Respaldos — copias del archivo SQLite con un botón,
 * restauración, exportación y importación de la base de datos.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import express from "express";
import { prisma, resetPrisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { backupsDir, databaseFile } from "../../config/paths";

/** Nombre seguro dentro del directorio de respaldos (evita path traversal). */
function safeBackupPath(name: string): string {
  if (!/^[\w.-]+\.sqlite$/.test(name)) {
    throw new ApiError(400, "Nombre de respaldo inválido");
  }
  return path.join(backupsDir(), name);
}

/** Crea una copia de la base con marca de tiempo. Devuelve el nombre. */
export function createBackup(): string {
  const name = `respaldo-${dayjs().format("YYYY-MM-DD_HH-mm-ss")}.sqlite`;
  fs.copyFileSync(databaseFile(), path.join(backupsDir(), name));
  return name;
}

export const backupsRouter = Router();

/** GET /api/backups — lista de respaldos existentes. */
backupsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const files = fs
      .readdirSync(backupsDir())
      .filter((f) => f.endsWith(".sqlite"))
      .map((name) => {
        const stat = fs.statSync(path.join(backupsDir(), name));
        return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(files);
  }),
);

/** POST /api/backups — crear respaldo ahora. */
backupsRouter.post(
  "/",
  asyncHandler(async (_req, res) => {
    const name = createBackup();
    res.status(201).json({ ok: true, name });
  }),
);

/** POST /api/backups/:name/restore — restaurar un respaldo. */
backupsRouter.post(
  "/:name/restore",
  asyncHandler(async (req, res) => {
    const file = safeBackupPath(req.params.name ?? "");
    if (!fs.existsSync(file)) throw new ApiError(404, "El respaldo no existe");

    // Copia de seguridad automática antes de sobrescribir, por si acaso.
    createBackup();

    // Cerrar la conexión SQLite antes de reemplazar el archivo.
    await resetPrisma();
    fs.copyFileSync(file, databaseFile());
    prisma(); // reconecta
    res.json({ ok: true });
  }),
);

/** DELETE /api/backups/:name — eliminar un respaldo. */
backupsRouter.delete(
  "/:name",
  asyncHandler(async (req, res) => {
    const file = safeBackupPath(req.params.name ?? "");
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  }),
);

/** GET /api/backups/export — descargar la base de datos actual. */
backupsRouter.get(
  "/export",
  asyncHandler(async (_req, res) => {
    res.download(databaseFile(), `personal-control-${dayjs().format("YYYY-MM-DD")}.sqlite`);
  }),
);

/**
 * POST /api/backups/import — importar una base (cuerpo binario crudo).
 * La UI envía el archivo con fetch y Content-Type application/octet-stream.
 */
backupsRouter.post(
  "/import",
  express.raw({ type: "application/octet-stream", limit: "200mb" }),
  asyncHandler(async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ApiError(400, "Archivo vacío o inválido");
    }
    // Validación mínima: cabecera estándar de SQLite.
    if (!body.subarray(0, 16).toString("utf8").startsWith("SQLite format 3")) {
      throw new ApiError(400, "El archivo no es una base de datos SQLite válida");
    }
    createBackup(); // respaldo de la base actual antes de reemplazarla
    await resetPrisma();
    fs.writeFileSync(databaseFile(), body);
    prisma();
    res.json({ ok: true });
  }),
);
