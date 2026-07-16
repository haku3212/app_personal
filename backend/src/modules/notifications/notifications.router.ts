/**
 * Módulo Notificaciones — avisos calculados en el momento:
 *  - Préstamos vencidos o por vencer (7 días).
 *  - Metas de ahorro cercanas al objetivo (≥ 90 %).
 *  - Hoy sin gastos registrados / sin horas registradas.
 */
import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { asyncHandler, round2 } from "../../lib/http";
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
  asyncHandler(async (_req, res) => {
    const db = prisma();
    const notifications: AppNotification[] = [];
    const today = dayRange();
    const in7days = dayjs().add(7, "day").endOf("day").toDate();

    const [dueLoans, goals, todayExpenses, todayWork] = await Promise.all([
      db.loan.findMany({
        where: { status: { not: "PAID" }, dueDate: { not: null, lte: in7days } },
        include: { payments: true },
      }),
      db.savingGoal.findMany({ where: { achieved: false }, include: { contributions: true } }),
      db.expense.count({ where: { date: { gte: today.from, lte: today.to } } }),
      db.workLog.count({ where: { date: { gte: today.from, lte: today.to } } }),
    ]);

    for (const loan of dueLoans) {
      const remaining = round2(
        loan.amount - loan.payments.reduce((s, p) => s + p.amount, 0),
      );
      const overdue = dayjs(loan.dueDate).isBefore(dayjs(), "day");
      const who = loan.type === "LENT" ? `${loan.person} te debe` : `Debes a ${loan.person}`;
      notifications.push({
        id: `loan-${loan.id}`,
        level: overdue ? "danger" : "warning",
        title: overdue ? "Préstamo vencido" : "Préstamo por vencer",
        detail: `${who} ${remaining} — vence ${dayjs(loan.dueDate).format("DD/MM/YYYY")}`,
      });
    }

    for (const goal of goals) {
      const current = goal.contributions.reduce((s, c) => s + c.amount, 0);
      const pct = goal.targetAmount > 0 ? (current / goal.targetAmount) * 100 : 0;
      if (pct >= 90) {
        notifications.push({
          id: `goal-${goal.id}`,
          level: "info",
          title: "Meta casi lograda 🎉",
          detail: `"${goal.name}" va en ${round2(pct)} % — faltan ${round2(goal.targetAmount - current)}`,
        });
      }
    }

    // Recordatorios de registro diario (solo después del mediodía para no molestar).
    if (dayjs().hour() >= 12) {
      if (todayExpenses === 0) {
        notifications.push({
          id: "no-expenses-today",
          level: "info",
          title: "Sin gastos registrados hoy",
          detail: "¿No gastaste nada hoy o falta registrarlo?",
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
