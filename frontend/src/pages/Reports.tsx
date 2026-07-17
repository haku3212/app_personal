import { useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Category, ReportInsights } from "@/types";

type Kind = "incomes" | "expenses" | "worklogs";

const KINDS: { value: Kind; label: string }[] = [
  { value: "expenses", label: "Gastos" },
  { value: "incomes", label: "Ingresos" },
  { value: "worklogs", label: "Horas trabajadas" },
];

export function Reports() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const [kind, setKind] = useState<Kind>("expenses");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState("");

  const { data: categories = [] } = useApiQuery<Category[]>(
    ["categories", kind === "incomes" ? "INCOME" : "EXPENSE"],
    `/categories?kind=${kind === "incomes" ? "INCOME" : "EXPENSE"}`,
  );
  const { data: insights } = useApiQuery<ReportInsights>(["reports", "insights"], "/reports/insights");

  const download = async (format: "excel" | "pdf") => {
    setBusy(format);
    setError("");
    const params = new URLSearchParams({ kind });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (categoryId && kind !== "worklogs") params.set("categoryId", categoryId);
    try {
      await api.download(`/reports/${format}?${params.toString()}`, `reporte.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Reportes" description="Ganancia, gastos y categorias que mas pesan en tu plata" />

      {insights && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {insights.periods.map((period) => (
              <StatCard
                key={period.label}
                title={period.label}
                value={money(period.profit, cur)}
                hint={`Ingresos ${money(period.income, cur)} · Gastos ${money(period.expense, cur)}`}
                icon={period.profit >= 0 ? TrendingUp : TrendingDown}
                tone={period.profit >= 0 ? "positive" : "negative"}
              />
            ))}
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>En que se fue la plata este mes</CardTitle>
                <CardDescription>Categorias ordenadas por gasto acumulado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.topCategories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Todavia no hay gastos este mes.</p>
                ) : (
                  insights.topCategories.map((category) => (
                    <div key={category.name}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                          <span className="truncate font-medium">{category.name}</span>
                          <span className="text-xs text-muted-foreground">{category.count} mov.</span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">{money(category.amount, cur)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, category.percent)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lectura rapida</CardTitle>
                <CardDescription>Lo mas importante para revisar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Wallet className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Balance del mes</p>
                    <p className="text-xs text-muted-foreground">
                      {money(insights.periods[2]?.profit ?? 0, cur)} despues de ingresos y gastos.
                    </p>
                  </div>
                </div>
                {insights.dangerCategory && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">Categoria mas pesada</p>
                      <p className="text-xs text-muted-foreground">
                        {insights.dangerCategory.name} lleva {money(insights.dangerCategory.amount, cur)} este mes.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Exportar reporte</CardTitle>
          <CardDescription>Elige que exportar y en que rango de fechas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tipo de reporte</Label>
              <Select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as Kind);
                  setCategoryId("");
                }}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
            {kind !== "worklogs" && (
              <div>
                <Label>Categoria</Label>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label>Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => download("excel")} disabled={busy !== null}>
              <FileSpreadsheet className="h-4 w-4" />
              {busy === "excel" ? "Generando..." : "Descargar Excel"}
            </Button>
            <Button variant="secondary" onClick={() => download("pdf")} disabled={busy !== null}>
              <FileText className="h-4 w-4" />
              {busy === "pdf" ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
