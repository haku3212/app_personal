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
import { audit } from "../../lib/audit";
import { backupsDir, databaseFile } from "../../config/paths";
import { ownerWhere } from "../../lib/owner";

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
  asyncHandler(async (req, res) => {
    const name = createBackup();
    await audit(req, "CREATE", "backup", name, `Respaldo creado: ${name}`);
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
    await audit(req, "RESTORE", "backup", req.params.name, `Respaldo restaurado: ${req.params.name}`);
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
  asyncHandler(async (req, res) => {
    await audit(req, "EXPORT", "backup", null, "Base de datos exportada");
    res.download(databaseFile(), `personal-control-${dayjs().format("YYYY-MM-DD")}.sqlite`);
  }),
);

/** GET /api/backups/export-json - exporta datos del usuario activo en JSON. */
backupsRouter.get(
  "/export-json",
  asyncHandler(async (req, res) => {
    const db = prisma();
    const owned = ownerWhere(req);
    const payload = {
      exportedAt: new Date().toISOString(),
      user: req.user ? { id: req.user.id, username: req.user.username, displayName: req.user.displayName } : null,
      settings: await db.setting.findUnique({ where: { id: 1 } }),
      accounts: await db.account.findMany({ where: owned }),
      categories: await db.category.findMany({ where: owned }),
      incomes: await db.income.findMany({ where: owned }),
      expenses: await db.expense.findMany({ where: owned }),
      worklogs: await db.workLog.findMany({ where: owned }),
      loans: await db.loan.findMany({ where: owned, include: { payments: true } }),
      goals: await db.savingGoal.findMany({ where: owned, include: { contributions: true } }),
      notes: await db.note.findMany({ where: owned, include: { items: true } }),
    };
    await audit(req, "EXPORT", "backup", "json", "Datos del usuario exportados en JSON");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="personal-control-${dayjs().format("YYYY-MM-DD")}.json"`);
    res.json(payload);
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
    await audit(req, "IMPORT", "backup", null, "Base de datos importada");
    res.json({ ok: true });
  }),
);
