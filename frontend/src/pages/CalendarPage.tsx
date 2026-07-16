import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { hours as fmtHours, money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Calendario mensual con ingresos, gastos, horas y préstamos por día. */
export function CalendarPage() {
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";
  const [month, setMonth] = useState(dayjs());
  const [selected, setSelected] = useState<string | null>(null);

  const key = month.format("YYYY-MM");
  const { data } = useApiQuery<{ month: string; days: CalendarDay[] }>(
    ["calendar", key],
    `/calendar?month=${key}`,
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of data?.days ?? []) map.set(d.date, d);
    return map;
  }, [data]);

  // Celdas del mes: relleno inicial según el día de semana (lunes = 0).
  const cells = useMemo(() => {
    const start = month.startOf("month");
    const padding = (start.day() + 6) % 7;
    const total = month.daysInMonth();
    const out: (string | null)[] = Array.from({ length: padding }, () => null);
    for (let d = 1; d <= total; d++) out.push(start.date(d).format("YYYY-MM-DD"));
    return out;
  }, [month]);

  const selectedDay = selected ? dayMap.get(selected) : undefined;

  return (
    <div>
      <PageHeader
        title="Calendario"
        description="Movimientos, horas y préstamos día por día"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonth(month.subtract(1, "month"))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium capitalize">
              {month.format("MMMM YYYY")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMonth(month.add(1, "month"))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) =>
            date === null ? (
              <div key={`pad-${i}`} />
            ) : (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={cn(
                  "flex min-h-[72px] flex-col rounded-lg border p-1.5 text-left transition-colors hover:bg-accent",
                  selected === date && "ring-2 ring-ring",
                  dayjs(date).isSame(dayjs(), "day") && "border-primary/60 bg-primary/5",
                )}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {dayjs(date).date()}
                </span>
                {dayMap.has(date) && (
                  <div className="mt-auto space-y-0.5 text-[10px] leading-tight">
                    {dayMap.get(date)!.income > 0 && (
                      <p className="truncate text-emerald-600 dark:text-emerald-400">
                        +{money(dayMap.get(date)!.income, cur)}
                      </p>
                    )}
                    {dayMap.get(date)!.expense > 0 && (
                      <p className="truncate text-red-600 dark:text-red-400">
                        −{money(dayMap.get(date)!.expense, cur)}
                      </p>
                    )}
                    {dayMap.get(date)!.hours > 0 && (
                      <p className="truncate text-violet-600 dark:text-violet-400">
                        {fmtHours(dayMap.get(date)!.hours)}
                      </p>
                    )}
                    {dayMap.get(date)!.loans.length > 0 && (
                      <p className="truncate text-amber-600 dark:text-amber-400">
                        {dayMap.get(date)!.loans.length} préstamo(s)
                      </p>
                    )}
                  </div>
                )}
              </button>
            ),
          )}
        </div>
      </Card>

      {/* Detalle del día seleccionado */}
      {selectedDay && (
        <Card className="mt-4 p-4">
          <p className="mb-2 text-sm font-semibold">{shortDate(selectedDay.date)}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p>
              Ingresos:{" "}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {money(selectedDay.income, cur)}
              </span>
            </p>
            <p>
              Gastos:{" "}
              <span className="font-medium text-red-600 dark:text-red-400">
                {money(selectedDay.expense, cur)}
              </span>
            </p>
            <p>
              Horas: <span className="font-medium">{fmtHours(selectedDay.hours)}</span>
            </p>
            <p>
              Balance:{" "}
              <span className="font-medium">{money(selectedDay.income - selectedDay.expense, cur)}</span>
            </p>
          </div>
          {selectedDay.loans.length > 0 && (
            <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              {selectedDay.loans.map((l, i) => (
                <p key={i}>
                  {l.type === "LENT" ? "Prestaste a" : "Te prestó"} {l.person}: {money(l.amount, cur)}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
