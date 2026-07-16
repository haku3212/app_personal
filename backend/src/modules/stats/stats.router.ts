/**
 * Módulo Estadísticas — promedios históricos y récords personales.
 */
import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { asyncHandler, round2 } from "../../lib/http";

/** Agrupa montos por mes ("YYYY-MM") a partir de filas { date, amount }. */
function groupByMonth(rows: { date: Date; amount: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = dayjs(r.date).format("YYYY-MM");
    map.set(key, round2((map.get(key) ?? 0) + r.amount));
  }
  return map;
}

/** Devuelve la entrada con mayor valor de un mapa mes→monto. */
function maxEntry(map: Map<string, number>): { month: string; amount: number } | null {
  let best: { month: string; amount: number } | null = null;
  for (const [month, amount] of map) {
    if (!best || amount > best.amount) best = { month, amount };
  }
  return best;
}

export const statsRouter = Router();

statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const db = prisma();
    const [expenses, incomes, worklogs, savings] = await Promise.all([
      db.expense.findMany({ select: { date: true, amount: true, description: true } }),
      db.income.findMany({ select: { date: true, amount: true, source: true } }),
      db.workLog.findMany({ select: { date: true, hours: true, expectedPay: true } }),
      db.goalContribution.aggregate({ _sum: { amount: true } }),
    ]);

    // Días con actividad para calcular promedios reales (no días calendario).
    const expenseDays = new Set(expenses.map((e) => dayjs(e.date).format("YYYY-MM-DD"))).size;
    const totalExpense = round2(expenses.reduce((s, e) => s + e.amount, 0));
    const totalIncome = round2(incomes.reduce((s, i) => s + i.amount, 0));

    const expenseByMonth = groupByMonth(expenses);
    const incomeByMonth = groupByMonth(incomes);
    const monthCount = Math.max(1, expenseByMonth.size);

    // Récords individuales.
    const biggestExpense = expenses.reduce<(typeof expenses)[number] | null>(
      (best, e) => (!best || e.amount > best.amount ? e : best),
      null,
    );
    const biggestIncome = incomes.reduce<(typeof incomes)[number] | null>(
      (best, i) => (!best || i.amount > best.amount ? i : best),
      null,
    );

    // Horas y pagos.
    const totalHours = round2(worklogs.reduce((s, w) => s + w.hours, 0));
    const totalPay = round2(worklogs.reduce((s, w) => s + w.expectedPay, 0));
    const hoursByMonth = new Map<string, number>();
    for (const w of worklogs) {
      const key = dayjs(w.date).format("YYYY-MM");
      hoursByMonth.set(key, round2((hoursByMonth.get(key) ?? 0) + w.hours));
    }

    res.json({
      spendPerDay: expenseDays ? round2(totalExpense / expenseDays) : 0,
      spendPerMonth: round2(totalExpense / monthCount),
      incomePerMonth: round2(totalIncome / Math.max(1, incomeByMonth.size)),
      totalSaved: round2(savings._sum.amount ?? 0),
      mostExpensiveMonth: maxEntry(expenseByMonth),
      bestIncomeMonth: maxEntry(incomeByMonth),
      biggestExpense,
      biggestIncome,
      totalHours,
      avgHourlyPay: totalHours ? round2(totalPay / totalHours) : 0,
      hoursByMonth: [...hoursByMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, hours]) => ({ month, hours })),
    });
  }),
);
