/**
 * Módulo Ajustes — moneda, tema, color de acento y respaldo automático.
 * Es una fila única (id = 1) que se crea sola si no existe.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody } from "../../lib/http";

const settingSchema = z.object({
  currency: z.string().trim().min(1).max(10),
  theme: z.enum(["light", "dark", "system"]),
  accentColor: z.string().trim().min(1).max(30),
  autoBackup: z.boolean(),
});

/** Devuelve los ajustes, creándolos con valores por defecto si no existen. */
export async function getSettings() {
  return prisma().setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  }),
);

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const patch = parseBody(settingSchema.partial(), req.body);
    await getSettings(); // garantiza que la fila exista
    const updated = await prisma().setting.update({ where: { id: 1 }, data: patch });
    res.json(updated);
  }),
);
