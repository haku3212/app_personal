import { useState } from "react";
import { Banknote, Landmark, Plus, Vault, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Account } from "@/types";

const typeIcon = { CASH: Banknote, BANK: Landmark, OTHER: Vault } as const;
const typeLabel = { CASH: "Efectivo", BANK: "Banco", OTHER: "Otro" } as const;

interface FormState {
  name: string;
  type: Account["type"];
  initialBalance: string;
}

const emptyForm = (): FormState => ({ name: "", type: "CASH", initialBalance: "0" });

/** Control de efectivo: saldo en tiempo real por cuenta (caja, banco, efectivo). */
export function Cash() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const { data: accounts = [] } = useApiQuery<Account[]>(["accounts"], "/accounts");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [error, setError] = useState("");

  const invalidate = [["accounts"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) =>
      editing ? api.put(`/accounts/${editing.id}`, payload) : api.post("/accounts", payload),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation(
    (id: number) => api.delete(`/accounts/${id}`),
    invalidate,
    () => setDeleting(null),
  );

  const total = accounts.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setFormOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      initialBalance: String(account.initialBalance),
    });
    setError("");
    setFormOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    save.mutate(
      {
        name: form.name.trim(),
        type: form.type,
        initialBalance: Number(form.initialBalance) || 0,
      },
      { onError: (e) => setError(e.message) },
    );
  };

  return (
    <div>
      <PageHeader
        title="Control de efectivo"
        description="Cuánto dinero deberías tener ahora mismo, cuenta por cuenta"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva cuenta
          </Button>
        }
      />

      <div className="mb-5 max-w-sm">
        <StatCard title="Saldo total" value={money(total, cur)} icon={Wallet} tone="positive" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => {
          const Icon = typeIcon[account.type];
          return (
            <Card key={account.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {account.name}
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">{typeLabel[account.type]}</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{money(account.balance, cur)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Saldo inicial: {money(account.initialBalance, cur)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(account)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => setDeleting(account)}
                  >
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar cuenta" : "Nueva cuenta"}
        width="max-w-sm"
      >
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Account["type"] })}
            >
              <option value="CASH">Efectivo / Caja</option>
              <option value="BANK">Banco</option>
              <option value="OTHER">Otro</option>
            </Select>
          </div>
          <div>
            <Label>Saldo inicial ({cur})</Label>
            <Input
              type="number"
              step="0.01"
              value={form.initialBalance}
              onChange={(e) => setForm({ ...form, initialBalance: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Guardar
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar cuenta"
        message={`¿Eliminar la cuenta «${deleting?.name ?? ""}»? Los movimientos asociados quedarán sin cuenta.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
