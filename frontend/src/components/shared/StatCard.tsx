import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  /** Tono del ícono: neutral, positivo, negativo o advertencia. */
  tone?: "default" | "positive" | "negative" | "warning";
}

const tones: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-500",
  negative: "bg-red-500/10 text-red-500",
  warning: "bg-amber-500/10 text-amber-500",
};

/** Tarjeta de indicador para el dashboard y las páginas de resumen. */
export function StatCard({ title, value, icon: Icon, hint, tone = "default" }: StatCardProps) {
  return (
    <Card className="p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}
