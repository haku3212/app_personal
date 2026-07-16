import {
  Banknote,
  Clock,
  HandCoins,
  PiggyBank,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings } from "@/hooks/useSettings";
import { hours, money } from "@/lib/format";
import type { DashboardData } from "@/types";

/** Panel principal: tarjetas de resumen + gráficos de los últimos 6 meses. */
export function Dashboard() {
  const { data, isLoading } = useApiQuery<DashboardData>(["dashboard"], "/dashboard");
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

  const { cards, series, expensesByCategory } = data;

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen de tu vida financiera" />

      {/* Tarjetas principales */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Dinero disponible" value={money(cards.available, cur)} icon={Wallet} />
        <StatCard
          title="Ingresos del mes"
          value={money(cards.incomeMonth, cur)}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          title="Gastos del mes"
          value={money(cards.expenseMonth, cur)}
          icon={TrendingDown}
          tone="negative"
        />
        <StatCard
          title="Balance del mes"
          value={money(cards.balanceMonth, cur)}
          icon={Scale}
          tone={cards.balanceMonth >= 0 ? "positive" : "negative"}
        />
        <StatCard title="Horas trabajadas" value={hours(cards.hoursMonth)} icon={Clock} hint="este mes" />
        <StatCard
          title="Pago esperado"
          value={money(cards.expectedPayMonth, cur)}
          icon={Banknote}
          hint="este mes"
        />
        <StatCard title="Ahorro acumulado" value={money(cards.totalSavings, cur)} icon={PiggyBank} tone="positive" />
        <StatCard title="Me deben" value={money(cards.owedToMe, cur)} icon={Users} tone="warning" />
        <StatCard title="Debo" value={money(cards.iOwe, cur)} icon={HandCoins} tone="negative" />
        <StatCard title="Préstamos realizados" value={String(cards.totalLoans)} icon={Receipt} />
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos vs Gastos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={50} />
                <Tooltip
                  formatter={(v: number, name) => [
                    money(v, cur),
                    name === "income" ? "Ingresos" : "Gastos",
                  ]}
                  contentStyle={{ borderRadius: 10, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#inc)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#exp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría (mes actual)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {expensesByCategory.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sin gastos este mes
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {expensesByCategory.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v, cur)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas trabajadas por mes</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [hours(v), "Horas"]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance mensual y ahorro</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={50} />
                <Tooltip
                  formatter={(v: number, name) => [money(v, cur), name === "balance" ? "Balance" : "Ahorro"]}
                  contentStyle={{ borderRadius: 10, fontSize: 12 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="balance" name="Balance" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="savings" name="Ahorro" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
