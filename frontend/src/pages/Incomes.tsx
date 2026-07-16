import { useMemo, useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
import type { Account, Category, Income } from "@/types";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "QR", "Tarjeta", "Otro"];
const SOURCES = ["Trabajo", "Madre", "Venta", "Freelance", "Otros"];

interface FormState {
  date: string;
  amount: string;
  source: string;
  categoryId: string;
  accountId: string;
  paymentMethod: string;
  description: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  date: inputDate(),
  amount: "",
  source: "Trabajo",
  categoryId: "",
  accountId: "",
  paymentMethod: "Efectivo",
  description: "",
  notes: "",
});

/** Página de Ingresos: filtros, tabla y formulario de alta/edición. */
export function Incomes() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";

  // Filtros de listado.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (filterCategory) params.set("categoryId", filterCategory);
    return params.toString();
  }, [from, to, filterCategory]);

  const { data } = useApiQuery<{ items: Income[]; total: number }>(
    ["incomes", query],
    `/incomes${query ? `?${query}` : ""}`,
  );
  const { data: categories = [] } = useApiQuery<Category[]>(
    ["categories", "INCOME"],
    "/categories?kind=INCOME",
  );
  const { data: accounts = [] } = useApiQuery<Account[]>(["accounts"], "/accounts");

  // Estado del formulario (crear/editar) y confirmación de borrado.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [error, setError] = useState("");

  const invalidate = [["incomes"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) =>
      editing ? api.put(`/incomes/${editing.id}`, payload) : api.post("/incomes", payload),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation(
    (id: number) => api.delete(`/incomes/${id}`),
    invalidate,
    () => setDeleting(null),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (income: Income) => {
    setEditing(income);
    setForm({
      date: inputDate(income.date),
      amount: String(income.amount),
      source: income.source,
      categoryId: income.categoryId ? String(income.categoryId) : "",
      accountId: income.accountId ? String(income.accountId) : "",
      paymentMethod: income.paymentMethod,
      description: income.description ?? "",
      notes: income.notes ?? "",
    });
    setError("");
    setFormOpen(true);
  };

  const submit = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Ingresa un monto válido mayor a 0");
      return;
    }
    save.mutate(
      {
        date: form.date,
        amount,
        source: form.source,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        accountId: form.accountId ? Number(form.accountId) : null,
        paymentMethod: form.paymentMethod,
        description: form.description || null,
        notes: form.notes || null,
      },
      { onError: (e) => setError(e.message) },
    );
  };

  const columns: Column<Income>[] = [
    { header: "Fecha", cell: (r) => shortDate(r.date) },
    { header: "Origen", cell: (r) => <span className="font-medium">{r.source}</span> },
    {
      header: "Categoría",
      cell: (r) =>
        r.category ? (
          <Badge variant="muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.category.color }} />
            {r.category.name}
          </Badge>
        ) : (
          "—"
        ),
    },
    { header: "Método", cell: (r) => r.paymentMethod },
    { header: "Descripción", cell: (r) => r.description ?? "—", className: "max-w-48 truncate" },
    {
      header: "Monto",
      cell: (r) => (
        <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          +{money(r.amount, cur)}
        </span>
      ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ingresos"
        description={data ? `Total filtrado: ${money(data.total, cur)}` : undefined}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo ingreso
          </Button>
        }
      />

      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:max-w-2xl">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Categoría</Label>
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {data && data.items.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin ingresos registrados"
          description="Registra tu primer ingreso con el botón «Nuevo ingreso»."
        />
      ) : (
        <DataTable columns={columns} rows={data?.items ?? []} onEdit={openEdit} onDelete={setDeleting} />
      )}

      {/* Formulario crear / editar */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar ingreso" : "Nuevo ingreso"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>Monto ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Origen</Label>
            <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Método de pago</Label>
            <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cuenta</Label>
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Descripción</Label>
            <Input
              placeholder="¿De qué fue este ingreso?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea
              placeholder="Notas adicionales…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {editing ? "Guardar cambios" : "Registrar ingreso"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar ingreso"
        message={`¿Eliminar el ingreso de ${deleting ? money(deleting.amount, cur) : ""} (${deleting?.source ?? ""})? Esta acción no se puede deshacer.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
