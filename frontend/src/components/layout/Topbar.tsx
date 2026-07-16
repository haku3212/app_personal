import { Bell, LogOut, Menu, Moon, Search, Shield, Sun } from "lucide-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { listBudgets, type Budget } from "@/lib/budgets";
import { inputDate } from "@/lib/format";
import type { AppNotification, Expense } from "@/types";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
}

const levelDot: Record<AppNotification["level"], string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/** Barra superior: menú, búsqueda global, notificaciones y tema. */
export function Topbar({ onToggleSidebar, onOpenSearch }: TopbarProps) {
  const { data: settings } = useSettings();
  const { session, users, switchOwner, logout } = useAuth();
  const updateSettings = useUpdateSettings();
  const { data: notifications = [] } = useApiQuery<AppNotification[]>(
    ["notifications"],
    "/notifications",
  );
  const monthStart = inputDate(dayjs().startOf("month").toDate());
  const monthEnd = inputDate(dayjs().endOf("month").toDate());
  const { data: monthExpenses } = useApiQuery<{ items: Expense[]; total: number }>(
    ["notifications", "budget-expenses", monthStart, monthEnd],
    `/expenses?from=${monthStart}&to=${monthEnd}`,
  );
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    void listBudgets().then(setBudgets);
  }, [session?.activeOwnerUserId]);

  const budgetNotifications = useMemo<AppNotification[]>(() => {
    const items: AppNotification[] = [];
    for (const budget of budgets) {
      if (budget.period !== "MONTHLY") continue;
      const spent = (monthExpenses?.items ?? [])
        .filter((expense) => expense.categoryId === budget.categoryId)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
      if (percent >= 100) {
        items.push({ id: `budget-over-${budget.id}`, level: "danger", title: "Presupuesto excedido", detail: `Usaste ${Math.round(percent)}% de un presupuesto mensual.` });
      } else if (percent >= 80) {
        items.push({ id: `budget-warn-${budget.id}`, level: "warning", title: "Presupuesto cerca del limite", detail: `Ya vas por ${Math.round(percent)}% del presupuesto mensual.` });
      }
    }
    return items;
  }, [budgets, monthExpenses?.items]);
  const allNotifications = [...budgetNotifications, ...notifications];

  const isDark = document.documentElement.classList.contains("dark");
  const toggleTheme = () => updateSettings.mutate({ theme: isDark ? "light" : "dark" });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Buscador global (abre el diálogo Ctrl+K) */}
      <button
        onClick={onOpenSearch}
        className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar movimientos…</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {/* Notificaciones */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications((v) => !v)}
            aria-label="Notificaciones"
          >
            <Bell className="h-4.5 w-4.5" />
            {allNotifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {allNotifications.length}
              </span>
            )}
          </Button>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border bg-popover p-2 shadow-xl animate-scale-in">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Notificaciones
                </p>
                {allNotifications.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Todo en orden ✨
                  </p>
                ) : (
                  allNotifications.map((n) => (
                    <div key={n.id} className="flex gap-2 rounded-lg px-2 py-2 hover:bg-accent">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", levelDot[n.level])} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground">{n.detail}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {session && (
          session.role === "ADMIN" ? (
            <div className="flex min-w-28 items-center gap-1 sm:min-w-40">
              <Shield className="hidden h-4 w-4 text-primary sm:block" />
              <Select
                value={session.activeOwnerUserId}
                onChange={(event) => void switchOwner(event.target.value)}
                aria-label="Ver datos de usuario"
                className="h-8 max-w-28 text-xs sm:max-w-40"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} {user.role === "ADMIN" ? "(admin)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <span className="hidden max-w-32 truncate px-2 text-xs text-muted-foreground sm:inline">
              {session.displayName}
            </span>
          )
        )}
        {/* Cambio de tema */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
          {settings?.theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Cerrar sesion">
          <LogOut className="h-4.5 w-4.5" />
        </Button>
      </div>
    </header>
  );
}
