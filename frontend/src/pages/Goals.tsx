import { useState } from "react";
import { PiggyBank, Plus, Target, Trash2, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { inputDate, money, shortDate } from "@/lib/format";
import type { SavingGoal } from "@/types";

interface FormState {
  name: string;
  targetAmount: string;
  targetDate: string;
  color: string;
}

const emptyForm = (): FormState => ({
  name: "",
  targetAmount: "",
  targetDate: "",
  color: "#22c55e",
});

/** Página de Metas de ahorro: tarjetas con progreso y aportes. */
export function Goals() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const { data: goals = [] } = useApiQuery<SavingGoal[]>(["goals"], "/goals");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavingGoal | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<SavingGoal | null>(null);
  const [contributing, setContributing] = useState<SavingGoal | null>(null);
  const [contribution, setContribution] = useState("");
  const [error, setError] = useState("");

  const invalidate = [["goals"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) => (editing ? api.put(`/goals/${editing.id}`, payload) : api.post("/goals", payload)),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation(
    (id: number) => api.delete(`/goals/${id}`),
    invalidate,
    () => setDeleting(null),
  );
  const addContribution = useApiMutation(
    ({ id, amount }: { id: number; amount: number }) =>
      api.post(`/goals/${id}/contributions`, { date: inputDate(), amount }),
    invalidate,
    () => {
      setContributing(null);
      setContribution("");
    },
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (goal: SavingGoal) => {
    setEditing(goal);
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate ? inputDate(goal.targetDate) : "",
      color: goal.color,
    });
    setError("");
    setFormOpen(true);
  };

  const submit = () => {
    const targetAmount = Number(form.targetAmount);
    if (!form.name.trim() || !targetAmount || targetAmount <= 0) {
      setError("Nombre y monto objetivo válido son obligatorios");
      return;
    }
    save.mutate(
      {
        name: form.name.trim(),
        targetAmount,
        targetDate: form.targetDate || null,
        color: form.color,
      },
      { onError: (e) => setError(e.message) },
    );
  };

  return (
    <div>
      <PageHeader
        title="Metas de ahorro"
        description="Objetivos con barra de progreso: computadora, herramientas, viajes…"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva meta
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sin metas de ahorro"
          description="Crea tu primera meta y registra aportes para ver el progreso."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-4 w-4" style={{ color: goal.color }} />
                    {goal.name}
                  </CardTitle>
                  {goal.targetDate && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Objetivo: {shortDate(goal.targetDate)}
                    </p>
                  )}
                </div>
                {goal.achieved && (
                  <Badge variant="success">
                    <Trophy className="h-3 w-3" /> Lograda
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold tabular-nums">{money(goal.currentAmount, cur)}</span>
                  <span className="text-xs text-muted-foreground">
                    de {money(goal.targetAmount, cur)}
                  </span>
                </div>
                <Progress value={goal.progress} color={goal.color} />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">{goal.progress}%</p>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    variant="outline"
                    onClick={() => setContributing(goal)}
                  >
                    Aportar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(goal)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => setDeleting(goal)}
                    aria-label="Eliminar meta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario crear / editar */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar meta" : "Nueva meta de ahorro"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <Input
              placeholder="Comprar computadora"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Monto objetivo ({cur})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
            />
          </div>
          <div>
            <Label>Fecha objetivo (opcional)</Label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Color</Label>
            <Input
              type="color"
              className="h-9 w-20 cursor-pointer p-1"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {editing ? "Guardar cambios" : "Crear meta"}
          </Button>
        </div>
      </Dialog>

      {/* Registrar aporte */}
      <Dialog
        open={contributing !== null}
        onClose={() => setContributing(null)}
        title={`Aportar a «${contributing?.name ?? ""}»`}
        description={
          contributing
            ? `Faltan ${money(contributing.targetAmount - contributing.currentAmount, cur)}`
            : undefined
        }
        width="max-w-sm"
      >
        <Label>Monto del aporte ({cur})</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          autoFocus
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setContributing(null)}>
            Cancelar
          </Button>
          <Button
            disabled={addContribution.isPending || !Number(contribution)}
            onClick={() =>
              contributing && addContribution.mutate({ id: contributing.id, amount: Number(contribution) })
            }
          >
            Registrar aporte
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar meta"
        message={`¿Eliminar la meta «${deleting?.name ?? ""}»? Se borrará también su historial de aportes.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
