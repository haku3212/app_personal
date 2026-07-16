/**
 * Módulo Búsqueda global — encuentra cualquier movimiento en toda la app.
 * Devuelve resultados heterogéneos con un formato uniforme para la UI.
 */
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
import { ownerWhere } from "../../lib/owner";

export interface SearchResult {
  type: "income" | "expense" | "worklog" | "loan" | "note" | "goal";
  id: number;
  title: string;
  subtitle: string;
  amount: number | null;
  date: string | null;
}

const LIMIT = 8; // resultados máximos por tipo

export const searchRouter = Router();

/** GET /api/search?q=texto (busca también montos exactos si q es numérico). */
searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = ((req.query.q as string | undefined) ?? "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const amount = Number(q.replace(",", "."));
    const byAmount = Number.isFinite(amount) && amount > 0 ? amount : undefined;
    const db = prisma();
    const owned = ownerWhere(req);

    const [incomes, expenses, worklogs, loans, notes, goals] = await Promise.all([
      db.income.findMany({
        where: {
          ...owned,
          OR: [
            { source: { contains: q } },
            { description: { contains: q } },
            { notes: { contains: q } },
            ...(byAmount ? [{ amount: byAmount }] : []),
          ],
        },
        include: { category: true },
        take: LIMIT,
        orderBy: { date: "desc" },
      }),
      db.expense.findMany({
        where: {
          ...owned,
          OR: [
            { description: { contains: q } },
            { notes: { contains: q } },
            ...(byAmount ? [{ amount: byAmount }] : []),
          ],
        },
        include: { category: true },
        take: LIMIT,
        orderBy: { date: "desc" },
      }),
      db.workLog.findMany({
        where: {
          ...owned,
          OR: [
            { company: { contains: q } },
            { project: { contains: q } },
            { place: { contains: q } },
            { description: { contains: q } },
          ],
        },
        take: LIMIT,
        orderBy: { date: "desc" },
      }),
      db.loan.findMany({
        where: {
          ...owned,
          OR: [
            { person: { contains: q } },
            { notes: { contains: q } },
            ...(byAmount ? [{ amount: byAmount }] : []),
          ],
        },
        take: LIMIT,
        orderBy: { date: "desc" },
      }),
      db.note.findMany({
        where: { ...owned, OR: [{ title: { contains: q } }, { content: { contains: q } }] },
        take: LIMIT,
        orderBy: { updatedAt: "desc" },
      }),
      db.savingGoal.findMany({ where: { ...owned, name: { contains: q } }, take: LIMIT }),
    ]);

    const results: SearchResult[] = [
      ...incomes.map((i): SearchResult => ({
        type: "income",
        id: i.id,
        title: i.source,
        subtitle: i.category?.name ?? i.description ?? "Ingreso",
        amount: i.amount,
        date: i.date.toISOString(),
      })),
      ...expenses.map((e): SearchResult => ({
        type: "expense",
        id: e.id,
        title: e.description ?? e.category?.name ?? "Gasto",
        subtitle: e.category?.name ?? "Gasto",
        amount: e.amount,
        date: e.date.toISOString(),
      })),
      ...worklogs.map((w): SearchResult => ({
        type: "worklog",
        id: w.id,
        title: w.project ?? w.company ?? "Jornada",
        subtitle: `${w.hours} h — ${w.place ?? w.company ?? ""}`,
        amount: w.expectedPay,
        date: w.date.toISOString(),
      })),
      ...loans.map((l): SearchResult => ({
        type: "loan",
        id: l.id,
        title: l.person,
        subtitle: l.type === "LENT" ? "Yo presté" : "Me prestaron",
        amount: l.amount,
        date: l.date.toISOString(),
      })),
      ...notes.map((n): SearchResult => ({
        type: "note",
        id: n.id,
        title: n.title,
        subtitle: n.content.slice(0, 80),
        amount: null,
        date: n.updatedAt.toISOString(),
      })),
      ...goals.map((g): SearchResult => ({
        type: "goal",
        id: g.id,
        title: g.name,
        subtitle: "Meta de ahorro",
        amount: g.targetAmount,
        date: g.targetDate?.toISOString() ?? null,
      })),
    ];

    res.json(results);
  }),
);
