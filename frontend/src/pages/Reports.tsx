import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { useApiQuery } from "@/hooks/useCrud";
import { api } from "@/lib/api";
import type { Category } from "@/types";

type Kind = "incomes" | "expenses" | "worklogs";

const KINDS: { value: Kind; label: string }[] = [
  { value: "expenses", label: "Gastos" },
  { value: "incomes", label: "Ingresos" },
  { value: "worklogs", label: "Horas trabajadas" },
];

/** Generación de reportes Excel y PDF con filtros por fecha y categoría. */
export function Reports() {
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

  const download = async (format: "excel" | "pdf") => {
    setBusy(format);
    setError("");
    const params = new URLSearchParams({ kind });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (categoryId && kind !== "worklogs") params.set("categoryId", categoryId);
    try {
      await api.download(
        `/reports/${format}?${params.toString()}`,
        `reporte.${format === "excel" ? "xlsx" : "pdf"}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Exporta tus movimientos a Excel o PDF, filtrando por fechas y categoría"
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configurar reporte</CardTitle>
          <CardDescription>Elige qué exportar y en qué rango de fechas.</CardDescription>
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
                <Label>Categoría</Label>
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
              {busy === "excel" ? "Generando…" : "Descargar Excel"}
            </Button>
            <Button variant="secondary" onClick={() => download("pdf")} disabled={busy !== null}>
              <FileText className="h-4 w-4" />
              {busy === "pdf" ? "Generando…" : "Descargar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
