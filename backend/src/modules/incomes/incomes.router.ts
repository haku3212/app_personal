/**
 * Módulo Ingresos — registro y consulta de ingresos de dinero.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { rangeFilter } from "../../utils/dates";

const incomeSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  source: z.string().trim().min(1, "El origen es obligatorio").max(80),
  description: z.string().max(300).nullish(),
  paymentMethod: z.string().trim().min(1).max(50).default("Efectivo"),
  notes: z.string().max(500).nullish(),
  categoryId: z.number().int().positive().nullish(),
  accountId: z.number().int().positive().nullish(),
});

const include = { category: true, account: true } as const;

export const incomesRouter = Router();

/** GET /api/incomes?from&to&categoryId&q — listado con filtros. */
incomesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to, categoryId, q } = req.query as Record<string, string | undefined>;
    const incomes = await prisma().income.findMany({
      where: {
        date: rangeFilter(from, to),
        categoryId: categoryId ? Number(categoryId) : undefined,
        ...(q
          ? {
              OR: [
                { source: { contains: q } },
                { description: { contains: q } },
                { notes: { contains: q } },
              ],
            }
          : {}),
      },
      include,
      orderBy: { date: "desc" },
    });
    const total = round2(incomes.reduce((sum, i) => sum + i.amount, 0));
    res.json({ items: incomes, total });
  }),
);

incomesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(incomeSchema, req.body);
    const created = await prisma().income.create({
      data: { ...data, amount: round2(data.amount) },
      include,
    });
    res.status(201).json(created);
  }),
);

incomesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(incomeSchema.partial(), req.body);
    const updated = await prisma().income.update({
      where: { id },
      data: { ...data, ...(data.amount != null ? { amount: round2(data.amount) } : {}) },
      include,
    });
    res.json(updated);
  }),
);

incomesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await prisma().income.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
