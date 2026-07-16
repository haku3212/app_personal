/**
 * Módulo Dashboard — agregados para las tarjetas y gráficos del inicio.
 * Todos los números del panel principal salen de este único endpoint.
 */
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler, round2 } from "../../lib/http";
import { lastMonths, monthRange } from "../../utils/dates";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const month = monthRange();
    const db = prisma();

    const [
      accounts,
      allIncomes,
      allExpenses,
      monthIncomes,
      monthExpenses,
      monthWork,
      loans,
      contributions,
    ] = await Promise.all([
      db.account.findMany({ where: { archived: false } }),
      db.income.aggregate({ _sum: { amount: true } }),
      db.expense.aggregate({ _sum: { amount: true } }),
      db.income.aggregate({
        where: { date: { gte: month.from, lte: month.to } },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: { date: { gte: month.from, lte: month.to } },
        _sum: { amount: true },
      }),
      db.workLog.aggregate({
        where: { date: { gte: month.from, lte: month.to } },
        _sum: { hours: true, expectedPay: true },
      }),
      db.loan.findMany({ include: { payments: true } }),
      db.goalContribution.aggregate({ _sum: { amount: true } }),
    ]);

    // Dinero disponible = saldos iniciales + todos los ingresos − todos los gastos.
    const initial = accounts.reduce((s, a) => s + a.initialBalance, 0);
    const available = round2(
      initial + (allIncomes._sum.amount ?? 0) - (allExpenses._sum.amount ?? 0),
    );

    // Préstamos pendientes (restando abonos).
    const remaining = (l: (typeof loans)[number]) =>
      Math.max(0, l.amount - l.payments.reduce((s, p) => s + p.amount, 0));
    const active = loans.filter((l) => l.status !== "PAID");
    const owedToMe = round2(
      active.filter((l) => l.type === "LENT").reduce((s, l) => s + remaining(l), 0),
    );
    const iOwe = round2(
      active.filter((l) => l.type === "BORROWED").reduce((s, l) => s + remaining(l), 0),
    );

    const incomeMonth = round2(monthIncomes._sum.amount ?? 0);
    const expenseMonth = round2(monthExpenses._sum.amount ?? 0);

    // Series de los últimos 6 meses para los gráficos.
    const months = lastMonths(6);
    const series = await Promise.all(
      months.map(async (m) => {
        const where = { date: { gte: m.range.from, lte: m.range.to } };
        const [inc, exp, work, savings] = await Promise.all([
          db.income.aggregate({ where, _sum: { amount: true } }),
          db.expense.aggregate({ where, _sum: { amount: true } }),
          db.workLog.aggregate({ where, _sum: { hours: true } }),
          db.goalContribution.aggregate({ where, _sum: { amount: true } }),
        ]);
        const income = round2(inc._sum.amount ?? 0);
        const expense = round2(exp._sum.amount ?? 0);
        return {
          month: m.label,
          income,
          expense,
          balance: round2(income - expense),
          hours: round2(work._sum.hours ?? 0),
          savings: round2(savings._sum.amount ?? 0),
        };
      }),
    );

    // Gastos del mes agrupados por categoría (para el gráfico de pastel).
    const monthExpenseRows = await db.expense.findMany({
      where: { date: { gte: month.from, lte: month.to } },
      include: { category: true },
    });
    const byCategory = new Map<string, { name: string; color: string; value: number }>();
    for (const e of monthExpenseRows) {
      const name = e.category?.name ?? "Sin categoría";
      const color = e.category?.color ?? "#94a3b8";
      const entry = byCategory.get(name) ?? { name, color, value: 0 };
      entry.value = round2(entry.value + e.amount);
      byCategory.set(name, entry);
    }

    res.json({
      cards: {
        available,
        incomeMonth,
        expenseMonth,
        balanceMonth: round2(incomeMonth - expenseMonth),
        hoursMonth: round2(monthWork._sum.hours ?? 0),
        expectedPayMonth: round2(monthWork._sum.expectedPay ?? 0),
        totalSavings: round2(contributions._sum.amount ?? 0),
        owedToMe,
        iOwe,
        totalLoans: loans.length,
      },
      series,
      expensesByCategory: [...byCategory.values()].sort((a, b) => b.value - a.value),
    });
  }),
);
