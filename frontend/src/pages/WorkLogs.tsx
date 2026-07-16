import { useMemo, useState } from "react";
import { AlarmClockPlus, Banknote, Clock, Plus, Timer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { hours as fmtHours, inputDate, money, shortDate } from "@/lib/format";
import type { WorkLog, WorkSummary } from "@/types";

interface FormState {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  place: string;
  company: string;
  project: string;
  description: string;
  hourlyRate: string;
  fixedPay: string;
}

const emptyForm = (): FormState => ({
  date: inputDate(),
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: "60",
  place: "",
  company: "",
  project: "",
  description: "",
  hourlyRate: "",
  fixedPay: "",
});

/** Página de Horas de trabajo: resumen, filtros y registro de jornadas. */
export function WorkLogs() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (company) params.set("company", company);
    if (project) params.set("project", project);
    return params.toString();
  }, [from, to, company, project]);

  const { data } = useApiQuery<{ items: WorkLog[]; totalHours: number; totalPay: number }>(
    ["worklogs", query],
    `/worklogs${query ? `?${query}` : ""}`,
  );
  const { data: summary } = useApiQuery<WorkSummary>(["worklogs", "summary"], "/worklogs/summary");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<WorkLog | null>(null);
  const [error, setError] = useState("");

  const invalidate = [["worklogs"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) =>
      editing ? api.put(`/worklogs/${editing.id}`, payload) : api.post("/worklogs", payload),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation(
    (id: number) => api.delete(`/worklogs/${id}`),
    invalidate,
    () => setDeleting(null),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (log: WorkLog) => {
    setEditing(log);
    setForm({
      date: inputDate(log.date),
      startTime: log.startTime,
      endTime: log.endTime,
      breakMinutes: String(log.breakMinutes),
      place: log.place ?? "",
      company: log.company ?? "",
      project: log.project ?? "",
      description: log.description ?? "",
      hourlyRate: log.hourlyRate != null ? String(log.hourlyRate) : "",
      fixedPay: log.fixedPay != null ? String(log.fixedPay) : "",
    });
    setError("");
    setFormOpen(true);
  };

  const submit = () => {
    save.mutate(
      {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        breakMinutes: Number(form.breakMinutes) || 0,
        place: form.place || null,
        company: form.company || null,
        project: form.project || null,
        description: form.description || null,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
        fixedPay: form.fixedPay ? Number(form.fixedPay) : null,
      },
      { onError: (e) => setError(e.message) },
    );
  };

  const columns: Column<WorkLog>[] = [
    { header: "Fecha", cell: (r) => shortDate(r.date) },
    { header: "Horario", cell: (r) => `${r.startTime} – ${r.endTime}` },
    {
      header: "Horas",
      cell: (r) => (
        <span className="tabular-nums">
          {fmtHours(r.hours)}
          {r.overtime > 0 && (
            <span className="ml-1 text-[10px] text-amber-500">+{r.overtime} extra</span>
          )}
        </span>
      ),
    },
    { header: "Empresa", cell: (r) => r.company ?? "—" },
    { header: "Proyecto", cell: (r) => r.project ?? "—" },
    {
      header: "Pago esperado",
      cell: (r) => <span className="font-semibold tabular-nums">{money(r.expectedPay, cur)}</span>,
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Horas de trabajo"
        description={
          data ? `Filtrado: ${fmtHours(data.totalHours)} · ${money(data.totalPay, cur)}` : undefined
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Registrar jornada
          </Button>
        }
      />

      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Horas esta semana" value={fmtHours(summary.weekHours)} icon={Clock} />
          <StatCard title="Horas este mes" value={fmtHours(summary.monthHours)} icon={Timer} />
          <StatCard
            title="Horas extra (mes)"
            value={fmtHours(summary.monthOvertime)}
            icon={AlarmClockPlus}
            tone="warning"
          />
          <StatCard
            title="Pago esperado (mes)"
            value={money(summary.monthPay, cur)}
            icon={Banknote}
            tone="positive"
            hint={`Promedio ${fmtHours(summary.avgHoursPerDay)}/día trabajado`}
          />
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-4 lg:max-w-3xl">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Empresa</Label>
          <Input placeholder="Filtrar…" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <Label>Proyecto</Label>
          <Input placeholder="Filtrar…" value={project} onChange={(e) => setProject(e.target.value)} />
        </div>
      </div>

      {data && data.items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin jornadas registradas"
          description="Registra tu primera jornada; las horas y el pago se calculan solos."
        />
      ) : (
        <DataTable columns={columns} rows={data?.items ?? []} onEdit={openEdit} onDelete={setDeleting} />
      )}

      {/* Formulario */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar jornada" : "Registrar jornada"}
        description="Las horas reales, extras y el pago esperado se calculan automáticamente."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>Descanso (minutos)</Label>
            <Input
              type="number"
              min="0"
              value={form.breakMinutes}
              onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
            />
          </div>
          <div>
            <Label>Hora inicio</Label>
            <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div>
            <Label>Hora fin</Label>
            <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div>
            <Label>Pago por hora ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
            />
          </div>
          <div>
            <Label>Pago fijo ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.fixedPay}
              onChange={(e) => setForm({ ...form, fixedPay: e.target.value })}
            />
          </div>
          <div>
            <Label>Lugar</Label>
            <Input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Proyecto</Label>
            <Input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea
              placeholder="¿Qué hiciste en esta jornada?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {editing ? "Guardar cambios" : "Registrar jornada"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar jornada"
        message={`¿Eliminar la jornada del ${deleting ? shortDate(deleting.date) : ""}?`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
