import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { deleteBudget, listBudgets, upsertBudget, type Budget, type BudgetPeriod } from "@/lib/budgets";
import { inputDate, money } from "@/lib/format";
import type { Category, Expense } from "@/types";

interface BudgetForm {
  id?: string;
  categoryId: string;
  period: BudgetPeriod;
  limit: string;
}

const emptyForm: BudgetForm = { categoryId: "", period: "MONTHLY", limit: "" };

const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
};

function statusFor(percent: number): { label: string; variant: "success" | "warning" | "danger" } {
  if (percent >= 100) return { label: "Excedido", variant: "danger" };
  if (percent >= 80) return { label: "Cuidado", variant: "warning" };
  return { label: "Bien", variant: "success" };
}

function periodRange(period: BudgetPeriod): { from: string; to: string; label: string } {
  const today = dayjs();
  if (period === "WEEKLY") {
    const start = today.startOf("week");
    const end = today.endOf("week");
    return {
      from: inputDate(start.toDate()),
      to: inputDate(end.toDate()),
      label: `${start.format("DD MMM")} - ${end.format("DD MMM")}`,
    };
  }
  if (period === "BIWEEKLY") {
    const start = today.date() <= 15 ? today.startOf("month") : today.date(16).startOf("day");
    const end = today.date() <= 15 ? today.date(15).endOf("day") : today.endOf("month");
    return {
      from: inputDate(start.toDate()),
      to: inputDate(end.toDate()),
      label: `${start.format("DD MMM")} - ${end.format("DD MMM")}`,
    };
  }
  const start = today.startOf("month");
  const end = today.endOf("month");
  return {
    from: inputDate(start.toDate()),
    to: inputDate(end.toDate()),
    label: today.format("MMMM YYYY"),
  };
}

export function Budgets() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const weekRange = periodRange("WEEKLY");
  const monthRange = periodRange("MONTHLY");
  const queryFrom = dayjs(weekRange.from).isBefore(dayjs(monthRange.from), "day") ? weekRange.from : monthRange.from;
  const { data: categories = [] } = useApiQuery<Category[]>(["categories", "EXPENSE"], "/categories?kind=EXPENSE");
  const { data: expensesData } = useApiQuery<{ items: Expense[]; total: number }>(
    ["expenses", "budget-periods", queryFrom, monthRange.to],
    `/expenses?from=${queryFrom}&to=${monthRange.to}`,
  );
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    void listBudgets().then(setBudgets);
  }, []);

  const spentByBudget = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expensesData?.items ?? []) {
      if (!expense.categoryId) continue;
      for (const period of ["WEEKLY", "BIWEEKLY", "MONTHLY"] as BudgetPeriod[]) {
        const range = periodRange(period);
        const date = dayjs(expense.date);
        if (date.isBefore(dayjs(range.from), "day") || date.isAfter(dayjs(range.to), "day")) continue;
        const key = `${expense.categoryId}:${period}`;
        map.set(key, (map.get(key) ?? 0) + expense.amount);
      }
    }
    return map;
  }, [expensesData?.items]);

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const totalSpent = budgets.reduce(
    (sum, budget) => sum + (spentByBudget.get(`${budget.categoryId}:${budget.period}`) ?? 0),
    0,
  );
  const totalPercent = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;

  const submit = async () => {
    setError("");
    try {
      await upsertBudget({
        id: form.id,
        categoryId: Number(form.categoryId),
        period: form.period,
        limit: Number(form.limit),
      });
      setBudgets(await listBudgets());
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const editBudget = (budget: Budget) => {
    setForm({ id: budget.id, categoryId: String(budget.categoryId), period: budget.period, limit: String(budget.limit) });
    setError("");
    setOpen(true);
  };

  const removeBudget = async (budget: Budget) => {
    await deleteBudget(budget.id);
    setBudgets(await listBudgets());
  };

  return (
    <div>
      <PageHeader
        title="Presupuestos"
        description="Limites semanales, quincenales y mensuales por categoria."
        actions={
          <Button onClick={() => { setForm(emptyForm); setError(""); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Presupuesto
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Resumen de presupuestos activos</CardTitle>
          <CardDescription>
            {money(totalSpent, cur)} gastados de {money(totalLimit, cur)} presupuestados entre todos los periodos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={totalPercent} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(totalPercent)}% usado</span>
            <span>{money(Math.max(totalLimit - totalSpent, 0), cur)} disponible</span>
          </div>
        </CardContent>
      </Card>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="grid min-h-56 place-items-center text-center">
            <div>
              <WalletCards className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Sin presupuestos</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Crea limites semanales, quincenales o mensuales por categoria para saber cuando estas cerca de pasarte.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {budgets.map((budget) => {
            const category = categoryMap.get(budget.categoryId);
            const spent = spentByBudget.get(`${budget.categoryId}:${budget.period}`) ?? 0;
            const percent = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
            const status = statusFor(percent);
            const range = periodRange(budget.period);
            return (
              <Card key={budget.id}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: category?.color ?? "#64748b" }}
                        />
                        {category?.name ?? "Categoria eliminada"}
                      </CardTitle>
                      <CardDescription>
                        {PERIOD_LABEL[budget.period]} · {range.label}
                      </CardDescription>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={Math.min(100, percent)} />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{money(spent, cur)}</span>
                    <span className="text-muted-foreground">de {money(budget.limit, cur)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Math.round(percent)}% usado</span>
                    <span>{money(budget.limit - spent, cur)} restante</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => editBudget(budget)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void removeBudget(budget)}>
                      <Trash2 className="h-3.5 w-3.5" /> Borrar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Editar presupuesto" : "Nuevo presupuesto"} width="max-w-sm">
        <div className="space-y-3">
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">Selecciona</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Periodo</Label>
            <Select
              value={form.period}
              onChange={(event) => setForm({ ...form, period: event.target.value as BudgetPeriod })}
            >
              <option value="WEEKLY">Semanal</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="MONTHLY">Mensual</option>
            </Select>
          </div>
          <div>
            <Label>Limite ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.limit}
              onChange={(event) => setForm({ ...form, limit: event.target.value })}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()}>Guardar</Button>
        </div>
      </Dialog>
    </div>
  );
}
