import {
  Award,
  BarChart3,
  CalendarRange,
  Clock,
  Coins,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { hours as fmtHours, money, shortDate } from "@/lib/format";
import type { StatsData } from "@/types";

/** Estadísticas históricas: promedios, récords y horas por mes. */
export function Stats() {
  const { data, isLoading } = useApiQuery<StatsData>(["stats"], "/stats");
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "Bs.";

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Estadísticas" description="Promedios, récords y tendencias de todo tu historial" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Gasto promedio por día" value={money(data.spendPerDay, cur)} icon={TrendingDown} tone="negative" hint="días con gastos" />
        <StatCard title="Gasto promedio mensual" value={money(data.spendPerMonth, cur)} icon={CalendarRange} tone="negative" />
        <StatCard title="Ingreso promedio mensual" value={money(data.incomePerMonth, cur)} icon={TrendingUp} tone="positive" />
        <StatCard title="Ahorro total" value={money(data.totalSaved, cur)} icon={PiggyBank} tone="positive" />
        <StatCard
          title="Mes más caro"
          value={data.mostExpensiveMonth ? money(data.mostExpensiveMonth.amount, cur) : "—"}
          hint={data.mostExpensiveMonth?.month}
          icon={BarChart3}
          tone="warning"
        />
        <StatCard
          title="Mes con más ingresos"
          value={data.bestIncomeMonth ? money(data.bestIncomeMonth.amount, cur) : "—"}
          hint={data.bestIncomeMonth?.month}
          icon={Award}
          tone="positive"
        />
        <StatCard
          title="Mayor gasto"
          value={data.biggestExpense ? money(data.biggestExpense.amount, cur) : "—"}
          hint={
            data.biggestExpense
              ? `${data.biggestExpense.description ?? ""} · ${shortDate(data.biggestExpense.date)}`
              : undefined
          }
          icon={TrendingDown}
          tone="negative"
        />
        <StatCard
          title="Mayor ingreso"
          value={data.biggestIncome ? money(data.biggestIncome.amount, cur) : "—"}
          hint={
            data.biggestIncome
              ? `${data.biggestIncome.source} · ${shortDate(data.biggestIncome.date)}`
              : undefined
          }
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard title="Horas trabajadas (total)" value={fmtHours(data.totalHours)} icon={Clock} />
        <StatCard title="Pago promedio por hora" value={money(data.avgHourlyPay, cur)} icon={Coins} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Horas trabajadas por mes (historial completo)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {data.hoursByMonth.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin jornadas registradas todavía
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hoursByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [fmtHours(v), "Horas"]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
