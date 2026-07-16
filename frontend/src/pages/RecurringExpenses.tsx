import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { inputDate, money } from "@/lib/format";
import {
  deleteRecurringExpense,
  listRecurringExpenses,
  markRecurringGenerated,
  upsertRecurringExpense,
  type RecurringExpense,
  type RecurringFrequency,
} from "@/lib/recurring";
import type { Account, Category } from "@/types";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "QR", "Tarjeta", "Otro"];
const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
};

const emptyForm = {
  id: "",
  name: "",
  amount: "",
  frequency: "MONTHLY" as RecurringFrequency,
  day: "1",
  categoryId: "",
  accountId: "",
  paymentMethod: "Efectivo",
  active: true,
};

function nextDueLabel(item: RecurringExpense): string {
  const today = dayjs();
  if (item.frequency === "WEEKLY") return "Esta semana";
  if (item.frequency === "BIWEEKLY") return today.date() <= 15 ? "Primera quincena" : "Segunda quincena";
  return `Dia ${Math.min(item.day, today.daysInMonth())}`;
}

export function RecurringExpenses() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const { data: categories = [] } = useApiQuery<Category[]>(["categories", "EXPENSE"], "/categories?kind=EXPENSE");
  const { data: accounts = [] } = useApiQuery<Account[]>(["accounts"], "/accounts");
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listRecurringExpenses().then(setItems);
  }, []);

  const createExpense = useApiMutation(
    async (item: RecurringExpense) => {
      const today = inputDate();
      await api.post("/expenses", {
        date: today,
        amount: item.amount,
        categoryId: item.categoryId,
        accountId: item.accountId,
        paymentMethod: item.paymentMethod,
        description: item.name,
        notes: `Generado desde gasto recurrente (${FREQUENCY_LABEL[item.frequency]})`,
      });
      await markRecurringGenerated(item.id, today);
    },
    [["expenses"], ...GLOBAL_KEYS],
    async () => {
      setItems(await listRecurringExpenses());
      setMessage("Gasto generado.");
    },
  );

  const submit = async () => {
    setError("");
    setMessage("");
    try {
      await upsertRecurringExpense({
        id: form.id || undefined,
        name: form.name,
        amount: Number(form.amount),
        frequency: form.frequency,
        day: Number(form.day),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        accountId: form.accountId ? Number(form.accountId) : null,
        paymentMethod: form.paymentMethod,
        active: form.active,
      });
      setItems(await listRecurringExpenses());
      setOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const edit = (item: RecurringExpense) => {
    setForm({
      id: item.id,
      name: item.name,
      amount: String(item.amount),
      frequency: item.frequency,
      day: String(item.day),
      categoryId: item.categoryId ? String(item.categoryId) : "",
      accountId: item.accountId ? String(item.accountId) : "",
      paymentMethod: item.paymentMethod,
      active: item.active,
    });
    setError("");
    setOpen(true);
  };

  const remove = async (item: RecurringExpense) => {
    await deleteRecurringExpense(item.id);
    setItems(await listRecurringExpenses());
  };

  return (
    <div>
      <PageHeader
        title="Gastos recurrentes"
        description="Pagos fijos, cuotas y suscripciones que se repiten."
        actions={
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Recurrente
          </Button>
        }
      />

      {(message || error) && (
        <p className={error ? "mb-3 text-sm text-red-500" : "mb-3 text-sm text-emerald-600 dark:text-emerald-400"}>
          {error || message}
        </p>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="grid min-h-56 place-items-center text-center">
            <div>
              <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Sin gastos recurrentes</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Crea pagos fijos para no olvidar alquiler, internet, cuotas o suscripciones.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>
                      {FREQUENCY_LABEL[item.frequency]} · {nextDueLabel(item)}
                    </CardDescription>
                  </div>
                  <Badge variant={item.active ? "success" : "muted"}>{item.active ? "Activo" : "Pausado"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold tabular-nums">{money(item.amount, cur)}</p>
                <p className="text-xs text-muted-foreground">
                  Ultimo generado: {item.lastGeneratedAt ? dayjs(item.lastGeneratedAt).format("DD/MM/YYYY") : "nunca"}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => createExpense.mutate(item)} disabled={!item.active || createExpense.isPending}>
                    Generar gasto
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => edit(item)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void remove(item)}>
                    <Trash2 className="h-3.5 w-3.5" /> Borrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Editar recurrente" : "Nuevo recurrente"} width="max-w-md">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <Label>Monto ({cur})</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </div>
          <div>
            <Label>Frecuencia</Label>
            <Select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as RecurringFrequency })}>
              <option value="WEEKLY">Semanal</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="MONTHLY">Mensual</option>
            </Select>
          </div>
          <div>
            <Label>Dia de referencia</Label>
            <Input type="number" min="1" max="31" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })} />
          </div>
          <div>
            <Label>Metodo</Label>
            <Select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
              {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">Sin categoria</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Cuenta</Label>
            <Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
              <option value="">Sin cuenta</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Activo
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => void submit()}>Guardar</Button>
        </div>
      </Dialog>
    </div>
  );
}
