import { useState } from "react";
import { Banknote, NotebookPen, Plus, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { inputDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Account, Category } from "@/types";

type Mode = "expense" | "income" | "note";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "QR", "Tarjeta", "Otro"];
const SOURCES = ["Trabajo", "Venta", "Freelance", "Otros"];

export function QuickAdd() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const { data: expenseCategories = [] } = useApiQuery<Category[]>(["categories", "EXPENSE"], "/categories?kind=EXPENSE");
  const { data: incomeCategories = [] } = useApiQuery<Category[]>(["categories", "INCOME"], "/categories?kind=INCOME");
  const { data: accounts = [] } = useApiQuery<Account[]>(["accounts"], "/accounts");
  const [mode, setMode] = useState<Mode>("expense");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: inputDate(),
    amount: "",
    categoryId: "",
    accountId: "",
    paymentMethod: "Efectivo",
    source: "Trabajo",
    title: "",
    detail: "",
  });

  const save = useApiMutation(
    async () => {
      if (mode === "note") {
        if (!form.title.trim()) throw new Error("Escribe un titulo para la nota");
        return api.post("/notes", { title: form.title.trim(), content: form.detail, pinned: false, items: [] });
      }
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Ingresa un monto valido mayor a 0");
      if (mode === "expense") {
        return api.post("/expenses", {
          date: form.date,
          amount,
          categoryId: form.categoryId ? Number(form.categoryId) : null,
          accountId: form.accountId ? Number(form.accountId) : null,
          paymentMethod: form.paymentMethod,
          description: form.detail || "Gasto rapido",
          notes: null,
        });
      }
      return api.post("/incomes", {
        date: form.date,
        amount,
        source: form.source,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        accountId: form.accountId ? Number(form.accountId) : null,
        paymentMethod: form.paymentMethod,
        description: form.detail || "Ingreso rapido",
        notes: null,
      });
    },
    [["incomes"], ["expenses"], ["notes"], ...GLOBAL_KEYS],
    () => {
      setMessage("Guardado.");
      setError("");
      setForm((current) => ({
        ...current,
        amount: "",
        title: "",
        detail: "",
      }));
    },
  );

  const submit = () => {
    setMessage("");
    setError("");
    save.mutate(undefined, { onError: (err) => setError((err as Error).message) });
  };

  const categories = mode === "income" ? incomeCategories : expenseCategories;

  return (
    <div>
      <PageHeader title="Registro rapido" description="Captura movimientos y notas en pocos toques." />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Nuevo registro
            </CardTitle>
            <CardDescription>Elige el tipo y guarda sin abrir formularios largos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "expense" as const, label: "Gasto", icon: TrendingDown },
                { value: "income" as const, label: "Ingreso", icon: TrendingUp },
                { value: "note" as const, label: "Nota", icon: NotebookPen },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setMode(item.value);
                    setForm((current) => ({ ...current, categoryId: "" }));
                  }}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors",
                    mode === item.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ))}
            </div>

            {mode !== "note" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                </div>
                <div>
                  <Label>Monto ({cur})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    autoFocus
                  />
                </div>
                {mode === "income" && (
                  <div>
                    <Label>Origen</Label>
                    <Select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
                      {SOURCES.map((source) => (
                        <option key={source}>{source}</option>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">Sin categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Metodo</Label>
                  <Select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Cuenta</Label>
                  <Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                    <option value="">Sin cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Detalle</Label>
                  <Input
                    value={form.detail}
                    onChange={(event) => setForm({ ...form, detail: event.target.value })}
                    placeholder={mode === "expense" ? "Ej: almuerzo, taxi, mercado" : "Ej: pago, venta, adelanto"}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Titulo</Label>
                  <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus />
                </div>
                <div>
                  <Label>Contenido</Label>
                  <Textarea value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

            <Button className="w-full sm:w-auto" onClick={submit} disabled={save.isPending}>
              <Plus className="h-4 w-4" /> Guardar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" /> Atajos
            </CardTitle>
            <CardDescription>Flujo recomendado para telefono.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Usa Gasto para compras pequenas del dia.</p>
            <p>Usa Ingreso para pagos rapidos o ventas.</p>
            <p>Usa Nota para pendientes que no son dinero.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
