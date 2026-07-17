import { useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useCrud";
import { shortDate } from "@/lib/format";
import type { AuditLog } from "@/types";

const actionLabel: Record<AuditLog["action"], string> = {
  CREATE: "Creo",
  UPDATE: "Edito",
  DELETE: "Borro",
  RESTORE: "Restauro",
  IMPORT: "Importo",
  EXPORT: "Exporto",
};

const actionVariant: Record<AuditLog["action"], "default" | "warning" | "danger" | "muted"> = {
  CREATE: "default",
  UPDATE: "warning",
  DELETE: "danger",
  RESTORE: "warning",
  IMPORT: "warning",
  EXPORT: "muted",
};

export function AuditPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (action) params.set("action", action);
  if (entity) params.set("entity", entity);
  const { data: logs = [] } = useApiQuery<AuditLog[]>(["audit", params.toString()], `/audit?${params.toString()}`);

  const entities = useMemo(() => [...new Set(logs.map((log) => log.entity))].sort(), [logs]);

  return (
    <div>
      <PageHeader title="Auditoria" description="Historial admin de acciones importantes por usuario." />

      <Card className="mb-4">
        <CardContent className="grid gap-2 p-3 sm:grid-cols-[1fr_160px_160px]">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Buscar usuario, modulo o descripcion"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <Select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">Todas las acciones</option>
            <option value="CREATE">Creo</option>
            <option value="UPDATE">Edito</option>
            <option value="DELETE">Borro</option>
            <option value="RESTORE">Restauro</option>
            <option value="IMPORT">Importo</option>
            <option value="EXPORT">Exporto</option>
          </Select>
          <Select value={entity} onChange={(event) => setEntity(event.target.value)}>
            <option value="">Todos los modulos</option>
            {entities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Todavia no hay eventos registrados.</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant[log.action]}>{actionLabel[log.action]}</Badge>
                  <span className="text-sm font-semibold">{log.entity}</span>
                  {log.entityId && <span className="text-xs text-muted-foreground">#{log.entityId}</span>}
                </div>
                <p className="mt-1 text-sm">{log.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.actorName ?? "Sistema"} · {shortDate(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
