/**
 * Helpers de fechas compartidos (rangos día/semana/mes/año).
 * Todas las funciones trabajan en hora local del usuario.
 */
import dayjs from "dayjs";
import "dayjs/locale/es";

// Etiquetas de meses en español en toda la API (gráficos, reportes).
dayjs.locale("es");

export interface DateRange {
  from: Date;
  to: Date;
}

export function dayRange(date: Date = new Date()): DateRange {
  const d = dayjs(date);
  return { from: d.startOf("day").toDate(), to: d.endOf("day").toDate() };
}

export function weekRange(date: Date = new Date()): DateRange {
  const d = dayjs(date);
  return { from: d.startOf("week").toDate(), to: d.endOf("week").toDate() };
}

export function monthRange(date: Date = new Date()): DateRange {
  const d = dayjs(date);
  return { from: d.startOf("month").toDate(), to: d.endOf("month").toDate() };
}

export function yearRange(date: Date = new Date()): DateRange {
  const d = dayjs(date);
  return { from: d.startOf("year").toDate(), to: d.endOf("year").toDate() };
}

/** Últimos `n` meses como pares { key: "2026-07", label: "jul 2026", range }. */
export function lastMonths(n: number): { key: string; label: string; range: DateRange }[] {
  const out: { key: string; label: string; range: DateRange }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = dayjs().subtract(i, "month");
    out.push({
      key: d.format("YYYY-MM"),
      label: d.format("MMM YYYY"),
      range: monthRange(d.toDate()),
    });
  }
  return out;
}

/** Filtro Prisma `{ gte, lte }` a partir de query params opcionales. */
export function rangeFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const gte = from ? dayjs(from).startOf("day").toDate() : undefined;
  const lte = to ? dayjs(to).endOf("day").toDate() : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}
