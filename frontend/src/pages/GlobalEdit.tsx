import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import type { SearchResult } from "@/types";

const meta: Record<SearchResult["type"], { label: string; route: string; endpoint: string; tone: "default" | "warning" | "danger" | "muted" }> = {
  income: { label: "Ingreso", route: "/ingresos", endpoint: "incomes", tone: "default" },
  expense: { label: "Gasto", route: "/gastos", endpoint: "expenses", tone: "danger" },
  worklog: { label: "Horas", route: "/horas", endpoint: "worklogs", tone: "muted" },
  loan: { label: "Prestamo", route: "/prestamos", endpoint: "loans", tone: "warning" },
  note: { label: "Nota", route: "/notas", endpoint: "notes", tone: "muted" },
  goal: { label: "Meta", route: "/metas", endpoint: "goals", tone: "default" },
};

export function GlobalEdit() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<SearchResult | null>(null);
  const query = q.trim();
  const { data: results = [] } = useApiQuery<SearchResult[]>(
    ["global-edit", query],
    query.length >= 2 ? `/search?q=${encodeURIComponent(query)}` : "/search?q=",
  );

  const grouped = useMemo(() => {
    const groups = new Map<SearchResult["type"], SearchResult[]>();
    for (const result of results) groups.set(result.type, [...(groups.get(result.type) ?? []), result]);
    return [...groups.entries()];
  }, [results]);

  const remove = useApiMutation(
    (item: SearchResult) => api.delete(`/${meta[item.type].endpoint}/${item.id}`),
    [["global-edit"], ...GLOBAL_KEYS],
    () => setDeleting(null),
  );

  return (
    <div>
      <PageHeader title="Editar todo" description="Busca cualquier registro y salta directo a editarlo o eliminarlo." />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Buscar gasto, ingreso, persona, nota, meta..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {query.length < 2 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Escribe al menos 2 letras para buscar.</p>
      ) : grouped.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No encontre resultados.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([type, items]) => (
            <section key={type}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta[type].label}</p>
              <div className="divide-y rounded-lg border bg-card">
                {items.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meta[type].tone}>{meta[type].label}</Badge>
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.subtitle || "Sin detalle"} {item.date ? `· ${shortDate(item.date)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.amount != null && <span className="hidden text-sm font-semibold tabular-nums sm:inline">{money(item.amount, cur)}</span>}
                      <Link
                        to={meta[type].route}
                        aria-label="Abrir modulo"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent"
                      >
                          <ExternalLink className="h-4 w-4" />
                      </Link>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setDeleting(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar registro"
        message={`Eliminar "${deleting?.title ?? ""}". Esta accion no se puede deshacer.`}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
