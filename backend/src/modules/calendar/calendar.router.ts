/**
 * Módulo Calendario — todos los movimientos de un mes agrupados por día.
 */
import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, round2 } from "../../lib/http";
import { ownerWhere } from "../../lib/owner";

export interface CalendarDay {
  date: string; // "YYYY-MM-DD"
  income: number;
  expense: number;
  hours: number;
  loans: { person: string; type: string; amount: number }[];
}

export const calendarRouter = Router();

/** GET /api/calendar?month=2026-07 */
calendarRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const monthParam = (req.query.month as string | undefined) ?? dayjs().format("YYYY-MM");
    const start = dayjs(`${monthParam}-01`);
    if (!start.isValid()) throw new ApiError(400, "Mes inválido, use YYYY-MM");
    const range = { gte: start.startOf("month").toDate(), lte: start.endOf("month").toDate() };
    const owned = ownerWhere(req);

    const db = prisma();
    const [incomes, expenses, worklogs, loans] = await Promise.all([
      db.income.findMany({ where: { ...owned, date: range }, select: { date: true, amount: true } }),
      db.expense.findMany({ where: { ...owned, date: range }, select: { date: true, amount: true } }),
      db.workLog.findMany({ where: { ...owned, date: range }, select: { date: true, hours: true } }),
      db.loan.findMany({
        where: { ...owned, date: range },
        select: { date: true, person: true, type: true, amount: true },
      }),
    ]);

    const days = new Map<string, CalendarDay>();
    const dayOf = (d: Date) => dayjs(d).format("YYYY-MM-DD");
    const get = (d: Date): CalendarDay => {
      const key = dayOf(d);
      let entry = days.get(key);
      if (!entry) {
        entry = { date: key, income: 0, expense: 0, hours: 0, loans: [] };
        days.set(key, entry);
      }
      return entry;
    };

    for (const i of incomes) get(i.date).income = round2(get(i.date).income + i.amount);
    for (const e of expenses) get(e.date).expense = round2(get(e.date).expense + e.amount);
    for (const w of worklogs) get(w.date).hours = round2(get(w.date).hours + w.hours);
    for (const l of loans)
      get(l.date).loans.push({ person: l.person, type: l.type, amount: l.amount });

    res.json({ month: monthParam, days: [...days.values()] });
  }),
);
