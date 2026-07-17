/**
 * Registro central de rutas: cada módulo se monta bajo /api/<nombre>.
 * Agregar un módulo futuro = 1 import + 1 línea aquí.
 */
import { Router } from "express";
import { accountsRouter } from "./modules/accounts/accounts.router";
import { auditRouter } from "./modules/audit/audit.router";
import { authRouter } from "./modules/auth/auth.router";
import { backupsRouter } from "./modules/backups/backups.router";
import { calendarRouter } from "./modules/calendar/calendar.router";
import { categoriesRouter } from "./modules/categories/categories.router";
import { dashboardRouter } from "./modules/dashboard/dashboard.router";
import { expensesRouter } from "./modules/expenses/expenses.router";
import { goalsRouter } from "./modules/goals/goals.router";
import { incomesRouter } from "./modules/incomes/incomes.router";
import { loansRouter } from "./modules/loans/loans.router";
import { notesRouter } from "./modules/notes/notes.router";
import { notificationsRouter } from "./modules/notifications/notifications.router";
import { reportsRouter } from "./modules/reports/reports.router";
import { searchRouter } from "./modules/search/search.router";
import { settingsRouter } from "./modules/settings/settings.router";
import { statsRouter } from "./modules/stats/stats.router";
import { worklogsRouter } from "./modules/worklogs/worklogs.router";
import { usersRouter } from "./modules/users/users.router";
import { requireUserOrLegacy } from "./modules/auth/auth.middleware";

export function apiRouter(): Router {
  const router = Router();
  router.use("/auth", authRouter);
  router.use("/users", usersRouter);
  router.use(requireUserOrLegacy);
  router.use("/accounts", accountsRouter);
  router.use("/audit", auditRouter);
  router.use("/backups", backupsRouter);
  router.use("/calendar", calendarRouter);
  router.use("/categories", categoriesRouter);
  router.use("/dashboard", dashboardRouter);
  router.use("/expenses", expensesRouter);
  router.use("/goals", goalsRouter);
  router.use("/incomes", incomesRouter);
  router.use("/loans", loansRouter);
  router.use("/notes", notesRouter);
  router.use("/notifications", notificationsRouter);
  router.use("/reports", reportsRouter);
  router.use("/search", searchRouter);
  router.use("/settings", settingsRouter);
  router.use("/stats", statsRouter);
  router.use("/worklogs", worklogsRouter);
  return router;
}
