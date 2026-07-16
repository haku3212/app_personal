import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Banknote, Calculator, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { getCashBox, upsertCashBox } from "@/lib/cashbox";
import { inputDate, money } from "@/lib/format";
import type { Expense, Income } from "@/types";

export function DailyCashBox() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const [date, setDate] = useState(inputDate());
  const [openingCash, setOpeningCash] = useState("");
  const [actualClosingCash, setActualClosingCash] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: incomesData } = useApiQuery<{ items: Income[]; total: number }>(["cashbox", "incomes", date], `/incomes?from=${date}&to=${date}`);
  const { data: expensesData } = useApiQuery<{ items: Expense[]; total: number }>(["cashbox", "expenses", date], `/expenses?from=${date}&to=${date}`);

  useEffect(() => {
    void getCashBox(date).then((box) => {
      setOpeningCash(box ? String(box.openingCash) : "");
      setActualClosingCash(box?.actualClosingCash != null ? String(box.actualClosingCash) : "");
      setNote(box?.note ?? "");
    });
  }, [date]);

  const incomeCash = useMemo(
    () => (incomesData?.items ?? []).filter((item) => item.paymentMethod === "Efectivo").reduce((sum, item) => sum + item.amount, 0),
    [incomesData?.items],
  );
  const expenseCash = useMemo(
    () => (expensesData?.items ?? []).filter((item) => item.paymentMethod === "Efectivo").reduce((sum, item) => sum + item.amount, 0),
    [expensesData?.items],
  );
  const expectedClosing = Number(openingCash || 0) + incomeCash - expenseCash;
  const difference = actualClosingCash ? Number(actualClosingCash) - expectedClosing : 0;

  const save = async () => {
    setMessage("");
    setError("");
    try {
      await upsertCashBox({
        date,
        openingCash: Number(openingCash || 0),
        actualClosingCash: actualClosingCash ? Number(actualClosingCash) : null,
        note,
      });
      setMessage("Caja guardada.");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Caja diaria" description="Apertura, movimientos en efectivo y cierre del dia." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Entradas efectivo" value={money(incomeCash, cur)} icon={Banknote} tone="positive" />
        <StatCard title="Salidas efectivo" value={money(expenseCash, cur)} icon={Banknote} tone="negative" />
        <StatCard title="Cierre esperado" value={money(expectedClosing, cur)} icon={Calculator} />
        <StatCard
          title="Diferencia"
          value={actualClosingCash ? money(difference, cur) : "Pendiente"}
          icon={Calculator}
          tone={difference === 0 ? "default" : difference > 0 ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dayjs(date).format("DD MMMM YYYY")}</CardTitle>
          <CardDescription>Registra el saldo inicial y el efectivo contado al cierre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div>
              <Label>Saldo inicial ({cur})</Label>
              <Input type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
            </div>
            <div>
              <Label>Efectivo contado ({cur})</Label>
              <Input type="number" min="0" step="0.01" value={actualClosingCash} onChange={(event) => setActualClosingCash(event.target.value)} />
            </div>
          </div>
          <div>
            <Label>Nota de cierre</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={() => void save()}>
            <Save className="h-4 w-4" /> Guardar caja
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
