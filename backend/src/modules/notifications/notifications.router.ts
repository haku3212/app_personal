import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { asyncHandler, round2 } from "../../lib/http";
import { ownerWhere } from "../../lib/owner";
import { dayRange } from "../../utils/dates";

export interface AppNotification {
  id: string;
  level: "info" | "warning" | "danger";
  title: string;
  detail: string;
}

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = prisma();
    const notifications: AppNotification[] = [];
    const today = dayRange();
    const in7days = dayjs().add(7, "day").endOf("day").toDate();
    const owned = ownerWhere(req);

    const [dueLoans, goals, todayExpenses, todayWork] = await Promise.all([
      db.loan.findMany({
        where: { ...owned, status: { not: "PAID" }, dueDate: { not: null, lte: in7days } },
        include: { payments: true },
      }),
      db.savingGoal.findMany({ where: { ...owned, achieved: false }, include: { contributions: true } }),
      db.expense.count({ where: { ...owned, date: { gte: today.from, lte: today.to } } }),
      db.workLog.count({ where: { ...owned, date: { gte: today.from, lte: today.to } } }),
    ]);

    for (const loan of dueLoans) {
      const principalPaid = loan.payments.reduce((sum, payment) => sum + (payment.principalAmount || payment.amount), 0);
      const interestPaid = loan.payments.reduce((sum, payment) => sum + (payment.interestAmount ?? 0), 0);
      const interestExpected = round2(loan.amount * ((loan.interestRate ?? 0) / 100));
      const remaining = round2(Math.max(0, loan.amount - principalPaid) + Math.max(0, interestExpected - interestPaid));
      const overdue = dayjs(loan.dueDate).isBefore(dayjs(), "day");
      const who = loan.type === "LENT" ? `${loan.person} te debe` : `Debes a ${loan.person}`;
      notifications.push({
        id: `loan-${loan.id}`,
        level: overdue ? "danger" : "warning",
        title: overdue ? "Prestamo vencido" : "Prestamo por vencer",
        detail: `${who} ${remaining} - vence ${dayjs(loan.dueDate).format("DD/MM/YYYY")}`,
      });
    }

    for (const goal of goals) {
      const current = goal.contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
      const pct = goal.targetAmount > 0 ? (current / goal.targetAmount) * 100 : 0;
      if (pct >= 90) {
        notifications.push({
          id: `goal-${goal.id}`,
          level: "info",
          title: "Meta casi lograda",
          detail: `"${goal.name}" va en ${round2(pct)} % - faltan ${round2(goal.targetAmount - current)}`,
        });
      }
      if (goal.targetDate && dayjs(goal.targetDate).diff(dayjs(), "day") <= 7 && pct < 100) {
        notifications.push({
          id: `goal-date-${goal.id}`,
          level: dayjs(goal.targetDate).isBefore(dayjs(), "day") ? "danger" : "warning",
          title: "Meta por vencer",
          detail: `"${goal.name}" vence ${dayjs(goal.targetDate).format("DD/MM/YYYY")} y va en ${round2(pct)} %`,
        });
      }
    }

    if (dayjs().hour() >= 12) {
      if (todayExpenses === 0) {
        notifications.push({
          id: "no-expenses-today",
          level: "info",
          title: "Sin gastos registrados hoy",
          detail: "Si gastaste algo, registralo para mantener el control.",
        });
      }
      if (todayWork === 0) {
        notifications.push({
          id: "no-work-today",
          level: "info",
          title: "Sin horas registradas hoy",
          detail: "Registra tu jornada si trabajaste hoy.",
        });
      }
    }

    res.json(notifications);
  }),
);
