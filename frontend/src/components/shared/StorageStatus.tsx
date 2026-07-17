import { Cloud, HardDrive, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isRemoteSyncEnabled, REMOTE_API_URL } from "@/lib/runtime";
import { cn } from "@/lib/utils";

interface StorageStatusProps {
  compact?: boolean;
  className?: string;
}

export function StorageStatus({ compact = false, className }: StorageStatusProps) {
  const online = isRemoteSyncEnabled();
  const Icon = online ? Cloud : HardDrive;
  const label = online ? "Sincronizado" : "Este dispositivo";
  const detail = online
    ? `Datos guardados en backend: ${REMOTE_API_URL}`
    : "Netlify sin backend guarda datos en este navegador/dispositivo.";

  if (compact) {
    return (
      <Badge variant={online ? "success" : "warning"} className={cn("hidden sm:inline-flex", className)} title={detail}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        online
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/70">
        {online ? <Cloud className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{online ? "Guardado online activo" : "Guardado local del navegador"}</p>
        <p className="text-xs opacity-85">{detail}</p>
      </div>
    </div>
  );
}
