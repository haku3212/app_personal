import { useMemo, useState } from "react";
import { HandCoins, Plus, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { inputDate, money, shortDate } from "@/lib/format";
import type { Loan, LoanSummary } from "@/types";

const statusBadge: Record<Loan["status"], { label: string; variant: "success" | "warning" | "danger" }> = {
  PAID: { label: "Pagado", variant: "success" },
  PARTIAL: { label: "Parcial", variant: "warning" },
  PENDING: { label: "Pendiente", variant: "danger" },
};

interface FormState {
  type: Loan["type"];
  person: string;
  amount: string;
  interestRate: string;
  date: string;
  dueDate: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  type: "LENT",
  person: "",
  amount: "",
  interestRate: "",
  date: inputDate(),
  dueDate: "",
  notes: "",
});

/** Página de Préstamos: yo presté / me prestaron, con abonos parciales. */
export function Loans() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";

  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    return params.toString();
  }, [filterType, filterStatus]);

  const { data: loans = [] } = useApiQuery<Loan[]>(["loans", query], `/loans${query ? `?${query}` : ""}`);
  const { data: summary } = useApiQuery<LoanSummary>(["loans", "summary"], "/loans/summary");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<Loan | null>(null);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [paymentPrincipal, setPaymentPrincipal] = useState("");
  const [paymentInterest, setPaymentInterest] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState("");

  const invalidate = [["loans"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) => (editing ? api.put(`/loans/${editing.id}`, payload) : api.post("/loans", payload)),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation(
    (id: number) => api.delete(`/loans/${id}`),
    invalidate,
    () => setDeleting(null),
  );
  const addPayment = useApiMutation(
    ({ id, principalAmount, interestAmount, note }: { id: number; principalAmount: number; interestAmount: number; note?: string }) =>
      api.post(`/loans/${id}/payments`, { date: inputDate(), principalAmount, interestAmount, note: note || null }),
    invalidate,
    () => {
      setPaying(null);
      setPaymentPrincipal("");
      setPaymentInterest("");
      setPaymentNote("");
    },
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (loan: Loan) => {
    setEditing(loan);
    setForm({
      type: loan.type,
      person: loan.person,
      amount: String(loan.amount),
      interestRate: loan.interestRate ? String(loan.interestRate) : "",
      date: inputDate(loan.date),
      dueDate: loan.dueDate ? inputDate(loan.dueDate) : "",
      notes: loan.notes ?? "",
    });
    setError("");
    setFormOpen(true);
  };

  const submit = () => {
    const amount = Number(form.amount);
    if (!form.person.trim() || !amount || amount <= 0) {
      setError("Persona y monto válido son obligatorios");
      return;
    }
    save.mutate(
      {
        type: form.type,
        person: form.person.trim(),
        amount,
        interestRate: Number(form.interestRate || 0),
        date: form.date,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      },
      { onError: (e) => setError(e.message) },
    );
  };

  const columns: Column<Loan>[] = [
    {
      header: "Tipo",
      cell: (r) => (
        <Badge variant={r.type === "LENT" ? "default" : "warning"}>
          {r.type === "LENT" ? "Yo presté" : "Me prestaron"}
        </Badge>
      ),
    },
    { header: "Persona", cell: (r) => <span className="font-medium">{r.person}</span> },
    { header: "Fecha", cell: (r) => shortDate(r.date) },
    { header: "Vence", cell: (r) => (r.dueDate ? shortDate(r.dueDate) : "—") },
    {
      header: "Progreso",
      cell: (r) => (
        <div className="min-w-28">
          <Progress value={(r.principalPaid / r.amount) * 100} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Capital: {money(r.principalPaid, cur)} de {money(r.amount, cur)}
          </p>
        </div>
      ),
    },
    {
      header: "Interes",
      cell: (r) => (
        <div className="min-w-28 text-xs">
          <p className="font-medium">{r.interestRate}%</p>
          <p className="text-muted-foreground">
            {money(r.interestPaid, cur)} de {money(r.interestExpected, cur)}
          </p>
        </div>
      ),
    },
    {
      header: "Estado",
      cell: (r) => <Badge variant={statusBadge[r.status].variant}>{statusBadge[r.status].label}</Badge>,
    },
    {
      header: "Pendiente",
      cell: (r) => (
        <div className="text-right">
          <p className="font-semibold tabular-nums">{money(r.totalRemaining, cur)}</p>
          {r.interestRemaining > 0 && <p className="text-[10px] text-muted-foreground">incl. {money(r.interestRemaining, cur)} interes</p>}
        </div>
      ),
      className: "text-right",
    },
    {
      header: "",
      cell: (r) =>
        r.status !== "PAID" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPaying(r);
              setPaymentPrincipal("");
              setPaymentInterest("");
              setPaymentNote("");
            }}
          >
            {r.type === "LENT" ? "Cobrar" : "Pagar"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Préstamos"
        description="Dinero que prestaste y dinero que te prestaron"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo préstamo
          </Button>
        }
      />

      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Me deben" value={money(summary.owedToMe, cur)} icon={Users} tone="warning" />
          <StatCard title="Debo" value={money(summary.iOwe, cur)} icon={HandCoins} tone="negative" />
          <StatCard title="Préstamos activos" value={String(summary.activeLoans)} icon={Wallet} />
          <StatCard title="Total histórico" value={String(summary.totalLoans)} icon={HandCoins} />
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:max-w-md">
        <div>
          <Label>Tipo</Label>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos</option>
            <option value="LENT">Yo presté</option>
            <option value="BORROWED">Me prestaron</option>
          </Select>
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="PARTIAL">Parcial</option>
            <option value="PAID">Pagado</option>
          </Select>
        </div>
      </div>

      {loans.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Sin préstamos registrados"
          description="Registra el dinero que prestas o te prestan para no perderle el rastro."
        />
      ) : (
        <DataTable columns={columns} rows={loans} onEdit={openEdit} onDelete={setDeleting} />
      )}

      {/* Formulario crear / editar */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar préstamo" : "Nuevo préstamo"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Loan["type"] })}
            >
              <option value="LENT">Yo presté</option>
              <option value="BORROWED">Me prestaron</option>
            </Select>
          </div>
          <div>
            <Label>Persona</Label>
            <Input
              placeholder="Nombre"
              value={form.person}
              onChange={(e) => setForm({ ...form, person: e.target.value })}
            />
          </div>
          <div>
            <Label>Monto ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Interes (%)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej. 10"
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
            />
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Fecha límite (opcional)</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {editing ? "Guardar cambios" : "Registrar préstamo"}
          </Button>
        </div>
      </Dialog>

      {/* Registrar abono */}
      <Dialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        title={`${paying?.type === "LENT" ? "Cobrar" : "Pagar"} a ${paying?.person ?? ""}`}
        description={paying ? `Capital pendiente: ${money(paying.remaining, cur)} | Interes pendiente: ${money(paying.interestRemaining, cur)}` : undefined}
        width="max-w-sm"
      >
        <div className="grid gap-3">
          <div>
            <Label>Pago a capital ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={paymentPrincipal}
              onChange={(e) => setPaymentPrincipal(e.target.value)}
            />
          </div>
          <div>
            <Label>Pago de interes ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={paymentInterest}
              onChange={(e) => setPaymentInterest(e.target.value)}
            />
          </div>
          <div>
            <Label>Nota</Label>
            <Textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
          </div>
        </div>
        {addPayment.isError && (
          <p className="mt-2 text-xs text-red-500">{(addPayment.error as Error).message}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPaying(null)}>
            Cancelar
          </Button>
          <Button
            disabled={addPayment.isPending || Number(paymentPrincipal || 0) + Number(paymentInterest || 0) <= 0}
            onClick={() =>
              paying &&
              addPayment.mutate({
                id: paying.id,
                principalAmount: Number(paymentPrincipal || 0),
                interestAmount: Number(paymentInterest || 0),
                note: paymentNote,
              })
            }
          >
            Registrar {paying?.type === "LENT" ? "cobro" : "pago"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar préstamo"
        message={`¿Eliminar el préstamo de ${deleting?.person ?? ""} por ${deleting ? money(deleting.amount, cur) : ""}? Se borrarán también sus abonos.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
