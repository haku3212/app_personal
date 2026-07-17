/**
 * Módulo Categorías — categorías editables de ingresos y gastos.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, parseBody, parseId } from "../../lib/http";
import { audit } from "../../lib/audit";
import { ensureOwned, ownerData, ownerWhere } from "../../lib/owner";

const categorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(50),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido").default("#8b5cf6"),
  icon: z.string().max(50).nullish(),
});

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const kind = req.query.kind as string | undefined;
    const categories = await prisma().category.findMany({
      where: { ...ownerWhere(req), ...(kind ? { kind } : {}) },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  }),
);

categoriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(categorySchema, req.body);
    const created = await prisma().category.create({ data: { ...data, ...ownerData(req) } });
    await audit(req, "CREATE", "category", created.id, `Categoria creada: ${created.name}`);
    res.status(201).json(created);
  }),
);

categoriesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(categorySchema.partial(), req.body);
    await ensureOwned(req, "category", id);
    const updated = await prisma().category.update({ where: { id }, data });
    await audit(req, "UPDATE", "category", updated.id, `Categoria editada: ${updated.name}`);
    res.json(updated);
  }),
);

categoriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "category", id);
    const current = await prisma().category.findUnique({ where: { id } });
    const inUse = await prisma().income.count({ where: { ...ownerWhere(req), categoryId: id } });
    const inUseExpense = await prisma().expense.count({ where: { ...ownerWhere(req), categoryId: id } });
    if (inUse + inUseExpense > 0) {
      // Se permite borrar: los movimientos quedan sin categoría (SetNull),
      // pero avisamos en la respuesta cuántos quedaron huérfanos.
      await prisma().category.delete({ where: { id } });
      await audit(req, "DELETE", "category", id, `Categoria eliminada: ${current?.name ?? id}`);
      res.json({ ok: true, detached: inUse + inUseExpense });
      return;
    }
    await prisma().category.delete({ where: { id } });
    await audit(req, "DELETE", "category", id, `Categoria eliminada: ${current?.name ?? id}`);
    res.json({ ok: true, detached: 0 });
  }),
);

/** Lanza 404 si la categoría no existe (usado por otros módulos). */
export async function assertCategory(id: number | null | undefined): Promise<void> {
  if (id == null) return;
  const found = await prisma().category.findUnique({ where: { id } });
  if (!found) throw new ApiError(404, "La categoría indicada no existe");
}
