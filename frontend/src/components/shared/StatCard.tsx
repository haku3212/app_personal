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
    <Card className="p-3 transition-transform duration-150 hover:-translate-y-0.5 sm:p-4">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10", tones[tone])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-base font-semibold tabular-nums sm:text-lg">{value}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}
