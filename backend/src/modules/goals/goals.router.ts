/**
 * Módulo Metas de ahorro — objetivos con aportes y barra de progreso.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { ensureOwned, ownerData, ownerWhere } from "../../lib/owner";

const goalSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  targetAmount: z.number().positive("El objetivo debe ser mayor a 0"),
  targetDate: z.coerce.date().nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#22c55e"),
  icon: z.string().max(50).nullish(),
});

const contributionSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive("El aporte debe ser mayor a 0"),
  note: z.string().max(300).nullish(),
});

/** Adjunta progreso calculado (monto actual y porcentaje). */
function withProgress<T extends { targetAmount: number; contributions: { amount: number }[] }>(
  goal: T,
) {
  const currentAmount = round2(goal.contributions.reduce((s, c) => s + c.amount, 0));
  return {
    ...goal,
    currentAmount,
    progress: goal.targetAmount > 0 ? Math.min(100, round2((currentAmount / goal.targetAmount) * 100)) : 0,
  };
}

export const goalsRouter = Router();

goalsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const goals = await prisma().savingGoal.findMany({
      where: ownerWhere(req),
      include: { contributions: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(goals.map(withProgress));
  }),
);

goalsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(goalSchema, req.body);
    const created = await prisma().savingGoal.create({
      data: { ...data, ...ownerData(req), targetAmount: round2(data.targetAmount) },
      include: { contributions: true },
    });
    res.status(201).json(withProgress(created));
  }),
);

goalsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const patch = parseBody(goalSchema.partial(), req.body);
    await ensureOwned(req, "savingGoal", id);
    const updated = await prisma().savingGoal.update({
      where: { id },
      data: patch,
      include: { contributions: { orderBy: { date: "desc" } } },
    });
    res.json(withProgress(updated));
  }),
);

/** POST /api/goals/:id/contributions — registrar un aporte. */
goalsRouter.post(
  "/:id/contributions",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(contributionSchema, req.body);
    await ensureOwned(req, "savingGoal", id);
    await prisma().goalContribution.create({
      data: { ...data, amount: round2(data.amount), goalId: id },
    });
    const goal = await prisma().savingGoal.findUniqueOrThrow({
      where: { id },
      include: { contributions: { orderBy: { date: "desc" } } },
    });
    const enriched = withProgress(goal);
    // Marca la meta como lograda automáticamente al llegar al 100 %.
    if (!goal.achieved && enriched.currentAmount >= goal.targetAmount) {
      await prisma().savingGoal.update({ where: { id }, data: { achieved: true } });
      enriched.achieved = true;
    }
    res.status(201).json(enriched);
  }),
);

goalsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "savingGoal", id);
    await prisma().savingGoal.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
