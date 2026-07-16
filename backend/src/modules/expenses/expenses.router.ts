/**
 * Módulo Gastos — registro, filtros y totales (día / semana / mes / año).
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { dayRange, monthRange, rangeFilter, weekRange, yearRange } from "../../utils/dates";

const expenseSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  description: z.string().max(300).nullish(),
  paymentMethod: z.string().trim().min(1).max(50).default("Efectivo"),
  notes: z.string().max(500).nullish(),
  categoryId: z.number().int().positive().nullish(),
  accountId: z.number().int().positive().nullish(),
});

const include = { category: true, account: true } as const;

/** Suma de gastos dentro de un rango de fechas. */
async function totalIn(range: { from: Date; to: Date }): Promise<number> {
  const agg = await prisma().expense.aggregate({
    where: { date: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
  });
  return round2(agg._sum.amount ?? 0);
}

export const expensesRouter = Router();

/** GET /api/expenses?from&to&categoryId&q — listado con filtros. */
expensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to, categoryId, accountId, paymentMethod, min, max, q } = req.query as Record<string, string | undefined>;
    const expenses = await prisma().expense.findMany({
      where: {
        date: rangeFilter(from, to),
        categoryId: categoryId ? Number(categoryId) : undefined,
        accountId: accountId ? Number(accountId) : undefined,
        paymentMethod: paymentMethod || undefined,
        amount: min || max ? { gte: min ? Number(min) : undefined, lte: max ? Number(max) : undefined } : undefined,
        ...(q
          ? { OR: [{ description: { contains: q } }, { notes: { contains: q } }] }
          : {}),
      },
      include,
      orderBy: { date: "desc" },
    });
    const total = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
    res.json({ items: expenses, total });
  }),
);

/** GET /api/expenses/summary — totales de hoy, semana, mes y año. */
expensesRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [today, week, month, year] = await Promise.all([
      totalIn(dayRange()),
      totalIn(weekRange()),
      totalIn(monthRange()),
      totalIn(yearRange()),
    ]);
    res.json({ today, week, month, year });
  }),
);

expensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(expenseSchema, req.body);
    const created = await prisma().expense.create({
      data: { ...data, amount: round2(data.amount) },
      include,
    });
    res.status(201).json(created);
  }),
);

expensesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(expenseSchema.partial(), req.body);
    const updated = await prisma().expense.update({
      where: { id },
      data: { ...data, ...(data.amount != null ? { amount: round2(data.amount) } : {}) },
      include,
    });
    res.json(updated);
  }),
);

expensesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await prisma().expense.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
