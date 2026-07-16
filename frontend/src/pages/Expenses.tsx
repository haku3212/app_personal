import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, CalendarRange, Plus, TrendingDown } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { inputDate, money, shortDate } from "@/lib/format";
import type { Account, Category, Expense, ExpenseSummary } from "@/types";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "QR", "Tarjeta", "Otro"];

interface FormState {
  date: string;
  amount: string;
  categoryId: string;
  accountId: string;
  paymentMethod: string;
  description: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  date: inputDate(),
  amount: "",
  categoryId: "",
  accountId: "",
  paymentMethod: "Efectivo",
  description: "",
  notes: "",
});

export function Expenses() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (filterCategory) params.set("categoryId", filterCategory);
    if (filterAccount) params.set("accountId", filterAccount);
    if (filterMethod) params.set("paymentMethod", filterMethod);
    if (minAmount) params.set("min", minAmount);
    if (maxAmount) params.set("max", maxAmount);
    return params.toString();
  }, [filterAccount, filterCategory, filterMethod, from, maxAmount, minAmount, to]);

  const { data } = useApiQuery<{ items: Expense[]; total: number }>(
    ["expenses", query],
    `/expenses${query ? `?${query}` : ""}`,
  );
  const { data: summary } = useApiQuery<ExpenseSummary>(["expenses", "summary"], "/expenses/summary");
  const { data: categories = [] } = useApiQuery<Category[]>(["categories", "EXPENSE"], "/categories?kind=EXPENSE");
  const { data: accounts = [] } = useApiQuery<Account[]>(["accounts"], "/accounts");

  const invalidate = [["expenses"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) => editing ? api.put(`/expenses/${editing.id}`, payload) : api.post("/expenses", payload),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation((id: number) => api.delete(`/expenses/${id}`), invalidate, () => setDeleting(null));

  const setPreset = (preset: "week" | "biweek" | "month") => {
    const now = new Date();
    if (preset === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setFrom(inputDate(start));
      setTo(inputDate(end));
      return;
    }
    if (preset === "biweek") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() <= 15 ? 1 : 16);
      const end = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 15) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFrom(inputDate(start));
      setTo(inputDate(end));
      return;
    }
    setFrom(inputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(inputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setFilterCategory("");
    setFilterAccount("");
    setFilterMethod("");
    setMinAmount("");
    setMaxAmount("");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      date: inputDate(expense.date),
      amount: String(expense.amount),
      categoryId: expense.categoryId ? String(expense.categoryId) : "",
      accountId: expense.accountId ? String(expense.accountId) : "",
      paymentMethod: expense.paymentMethod,
      description: expense.description ?? "",
      notes: expense.notes ?? "",
    });
    setError("");
    setFormOpen(true);
  };

  const submit = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Ingresa un monto valido mayor a 0");
      return;
    }
    save.mutate(
      {
        date: form.date,
        amount,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        accountId: form.accountId ? Number(form.accountId) : null,
        paymentMethod: form.paymentMethod,
        description: form.description || null,
        notes: form.notes || null,
      },
      { onError: (e) => setError(e.message) },
    );
  };

  const columns: Column<Expense>[] = [
    { header: "Fecha", cell: (r) => shortDate(r.date) },
    {
      header: "Categoria",
      cell: (r) => r.category ? (
        <Badge variant="muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.category.color }} />
          {r.category.name}
        </Badge>
      ) : "Sin categoria",
    },
    { header: "Descripcion", cell: (r) => r.description ?? "-", className: "max-w-56 truncate" },
    { header: "Metodo", cell: (r) => r.paymentMethod },
    { header: "Cuenta", cell: (r) => r.account?.name ?? "-", className: "max-w-32 truncate" },
    {
      header: "Monto",
      cell: (r) => <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">-{money(r.amount, cur)}</span>,
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gastos"
        description={data ? `Total filtrado: ${money(data.total, cur)}` : undefined}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo gasto</Button>}
      />

      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Hoy" value={money(summary.today, cur)} icon={CalendarClock} tone="negative" />
          <StatCard title="Esta semana" value={money(summary.week, cur)} icon={CalendarDays} tone="negative" />
          <StatCard title="Este mes" value={money(summary.month, cur)} icon={CalendarRange} tone="negative" />
          <StatCard title="Este ano" value={money(summary.year, cur)} icon={TrendingDown} tone="negative" />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPreset("week")}>Semana</Button>
        <Button size="sm" variant="outline" onClick={() => setPreset("biweek")}>Quincena</Button>
        <Button size="sm" variant="outline" onClick={() => setPreset("month")}>Mes</Button>
        <Button size="sm" variant="ghost" onClick={clearFilters}>Limpiar</Button>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Categoria</Label>
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Cuenta</Label>
          <Select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
            <option value="">Todas</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Metodo</Label>
          <Select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
            <option value="">Todos</option>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <div><Label>Minimo</Label><Input type="number" min="0" step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
        <div><Label>Maximo</Label><Input type="number" min="0" step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></div>
      </div>

      {data && data.items.length === 0 ? (
        <EmptyState icon={TrendingDown} title="Sin gastos registrados" description="Registra tu primer gasto." />
      ) : (
        <DataTable columns={columns} rows={data?.items ?? []} onEdit={openEdit} onDelete={setDeleting} />
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Editar gasto" : "Nuevo gasto"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Fecha</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Monto ({cur})</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Sin categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Metodo</Label>
            <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Cuenta</Label>
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">Sin cuenta</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Descripcion</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Observaciones</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending}>{editing ? "Guardar cambios" : "Registrar gasto"}</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar gasto"
        message={`Eliminar el gasto de ${deleting ? money(deleting.amount, cur) : ""}? Esta accion no se puede deshacer.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
