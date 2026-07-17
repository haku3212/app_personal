import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2, Save, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { parseBankPdf, type BankMovement } from "@/lib/bankImport";
import { money, shortDate } from "@/lib/format";
import type { Account, Category } from "@/types";

function categoryFor(categories: Category[], movement: BankMovement): string {
  const kind = movement.kind === "income" ? "INCOME" : "EXPENSE";
  return String(
    categories.find((category) => category.kind === kind && category.name.toLowerCase() === movement.suggestedCategory?.toLowerCase())?.id ?? "",
  );
}

export function BankImport() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = useApiQuery<Category[]>(["categories", "all"], "/categories");
  const { data: accounts = [] } = useApiQuery<Account[]>(["accounts"], "/accounts");
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totals = useMemo(
    () =>
      movements.reduce(
        (acc, movement) => {
          if (!movement.selected) return acc;
          if (movement.kind === "income") acc.income += movement.amount;
          else acc.expense += movement.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [movements],
  );

  const readFile = async (file: File) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const parsed = await parseBankPdf(file);
      setMovements(parsed.map((movement) => ({ ...movement, categoryId: categoryFor(categories, movement) })));
      setMessage(`${parsed.length} movimientos detectados. Revisa antes de guardar.`);
    } catch (err) {
      setError((err as Error).message || "No se pudo leer el PDF.");
    } finally {
      setLoading(false);
    }
  };

  const update = (id: string, patch: Partial<BankMovement>) => {
    setMovements((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const save = useApiMutation(
    async () => {
      for (const movement of movements.filter((item) => item.selected)) {
        if (movement.kind === "income") {
          await api.post("/incomes", {
            date: movement.date,
            amount: movement.amount,
            source: movement.description.slice(0, 80) || "Ingreso bancario",
            description: `Importado del banco. Transaccion ${movement.transactionId}`,
            paymentMethod: "Banco",
            notes: `${movement.channel} ${movement.time}. Saldo: ${movement.balance}`,
            categoryId: movement.categoryId ? Number(movement.categoryId) : null,
            accountId: movement.accountId ? Number(movement.accountId) : null,
          });
        } else {
          await api.post("/expenses", {
            date: movement.date,
            amount: movement.amount,
            description: movement.description.slice(0, 250) || "Gasto bancario",
            paymentMethod: "Banco",
            notes: `Importado del banco. Transaccion ${movement.transactionId}. ${movement.channel} ${movement.time}. Saldo: ${movement.balance}`,
            categoryId: movement.categoryId ? Number(movement.categoryId) : null,
            accountId: movement.accountId ? Number(movement.accountId) : null,
          });
        }
      }
    },
    [["incomes"], ["expenses"], ["reports"], ...GLOBAL_KEYS],
    () => {
      setMessage("Movimientos guardados.");
      setMovements([]);
    },
  );

  return (
    <div>
      <PageHeader title="Importar banco" description="Sube un extracto PDF, revisa los movimientos y guardalos como ingresos o gastos." />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Extracto PDF</CardTitle>
          <CardDescription>Compatible con extractos que tengan fecha, descripcion, debito, credito y saldo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-accent/60"
            onClick={() => inputRef.current?.click()}
          >
            {loading ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="mb-2 h-8 w-8 text-primary" />}
            <p className="text-sm font-medium">{loading ? "Leyendo PDF..." : "Seleccionar extracto PDF"}</p>
            <p className="mt-1 text-xs text-muted-foreground">La app no guarda el archivo, solo lee los movimientos.</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
            />
          </div>
          {message && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {movements.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Ingresos seleccionados</p>
              <p className="text-lg font-semibold">{money(totals.income, cur)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Gastos seleccionados</p>
              <p className="text-lg font-semibold">{money(totals.expense, cur)}</p>
            </Card>
          </div>

          <div className="mb-4 flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setMovements((items) => items.map((item) => ({ ...item, selected: true })))}>
              Seleccionar todo
            </Button>
            <Button variant="outline" onClick={() => setMovements((items) => items.map((item) => ({ ...item, selected: false })))}>
              Quitar todo
            </Button>
            <Button onClick={() => save.mutate({})} disabled={save.isPending || !movements.some((item) => item.selected)}>
              <Save className="h-4 w-4" /> {save.isPending ? "Guardando..." : "Guardar seleccionados"}
            </Button>
          </div>

          <div className="space-y-3">
            {movements.map((movement) => (
              <Card key={movement.id} className={!movement.selected ? "opacity-60" : undefined}>
                <CardContent className="grid gap-3 p-3 lg:grid-cols-[auto_1fr_150px_170px_150px] lg:items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={movement.selected}
                      onChange={(event) => update(movement.id, { selected: event.target.checked })}
                    />
                    <Badge variant={movement.kind === "income" ? "success" : "danger"}>{movement.kind === "income" ? "Ingreso" : "Gasto"}</Badge>
                  </label>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{movement.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {shortDate(movement.date)} {movement.time} · Transaccion {movement.transactionId}
                    </p>
                  </div>

                  <p className="font-semibold tabular-nums">{money(movement.amount, cur)}</p>

                  <div>
                    <Label className="text-[11px]">Categoria</Label>
                    <Select value={movement.categoryId} onChange={(event) => update(movement.id, { categoryId: event.target.value })}>
                      <option value="">Sin categoria</option>
                      {categories
                        .filter((category) => category.kind === (movement.kind === "income" ? "INCOME" : "EXPENSE"))
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px]">Cuenta</Label>
                    <Select value={movement.accountId} onChange={(event) => update(movement.id, { accountId: event.target.value })}>
                      <option value="">Sin cuenta</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {movements.length === 0 && !loading && (
        <Card>
          <CardContent className="grid min-h-40 place-items-center text-center">
            <div>
              <FileUp className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sube un PDF para empezar.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
