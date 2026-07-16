import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  HandCoins,
  PiggyBank,
  Search,
  StickyNote,
  Clock,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { useSettings } from "@/hooks/useSettings";
import type { SearchResult } from "@/types";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Ícono y ruta destino por tipo de resultado. */
const typeMeta: Record<SearchResult["type"], { icon: LucideIcon; route: string; label: string }> = {
  income: { icon: TrendingUp, route: "/ingresos", label: "Ingreso" },
  expense: { icon: TrendingDown, route: "/gastos", label: "Gasto" },
  worklog: { icon: Clock, route: "/horas", label: "Jornada" },
  loan: { icon: HandCoins, route: "/prestamos", label: "Préstamo" },
  note: { icon: StickyNote, route: "/notas", label: "Nota" },
  goal: { icon: PiggyBank, route: "/metas", label: "Meta" },
};

/** Buscador global estilo Raycast (Ctrl+K). */
export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { data: settings } = useSettings();

  // Pequeño debounce para no consultar en cada tecla.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.get<SearchResult[]>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.trim().length >= 2,
  });

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<SearchResult["type"], SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return [...map.entries()];
  }, [results]);

  return (
    <Dialog open={open} onClose={onClose} title="Búsqueda global" width="max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por texto, persona, empresa o monto…"
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
        {debounced.length >= 2 && results.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados</p>
        )}
        {grouped.map(([type, items]) => {
          const meta = typeMeta[type];
          return (
            <div key={type}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {meta.label}s
              </p>
              {items.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => {
                    navigate(meta.route);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                >
                  <meta.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                  </div>
                  <div className="text-right">
                    {r.amount != null && (
                      <p className="text-sm font-medium tabular-nums">
                        {money(r.amount, settings?.currency)}
                      </p>
                    )}
                    {r.date && <p className="text-[10px] text-muted-foreground">{shortDate(r.date)}</p>}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
