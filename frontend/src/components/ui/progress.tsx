import { cn } from "@/lib/utils";

interface ProgressProps {
  /** Porcentaje 0..100 */
  value: number;
  color?: string;
  className?: string;
}

/** Barra de progreso con animación suave. */
export function Progress({ value, color, className }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  );
}
