import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/LoginPage";

const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const QuickAdd = lazy(() => import("@/pages/QuickAdd").then((m) => ({ default: m.QuickAdd })));
const Incomes = lazy(() => import("@/pages/Incomes").then((m) => ({ default: m.Incomes })));
const Expenses = lazy(() => import("@/pages/Expenses").then((m) => ({ default: m.Expenses })));
const Budgets = lazy(() => import("@/pages/Budgets").then((m) => ({ default: m.Budgets })));
const DailyCashBox = lazy(() => import("@/pages/DailyCashBox").then((m) => ({ default: m.DailyCashBox })));
const RecurringExpenses = lazy(() =>
  import("@/pages/RecurringExpenses").then((m) => ({ default: m.RecurringExpenses })),
);
const WorkLogs = lazy(() => import("@/pages/WorkLogs").then((m) => ({ default: m.WorkLogs })));
const Loans = lazy(() => import("@/pages/Loans").then((m) => ({ default: m.Loans })));
const Goals = lazy(() => import("@/pages/Goals").then((m) => ({ default: m.Goals })));
const Cash = lazy(() => import("@/pages/Cash").then((m) => ({ default: m.Cash })));
const CalendarPage = lazy(() =>
  import("@/pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const Notes = lazy(() => import("@/pages/Notes").then((m) => ({ default: m.Notes })));
const Stats = lazy(() => import("@/pages/Stats").then((m) => ({ default: m.Stats })));
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.Reports })));
const GlobalEdit = lazy(() => import("@/pages/GlobalEdit").then((m) => ({ default: m.GlobalEdit })));
const AuditPage = lazy(() => import("@/pages/AuditPage").then((m) => ({ default: m.AuditPage })));
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const AdminUsers = lazy(() => import("@/pages/AdminUsers").then((m) => ({ default: m.AdminUsers })));

function RouteFallback() {
  return (
    <div className="grid min-h-[240px] place-items-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function App() {
  const { ready, session } = useAuth();

  if (!ready) return <RouteFallback />;
  if (!session) return <LoginPage />;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rapido" element={<QuickAdd />} />
          <Route path="/ingresos" element={<Incomes />} />
          <Route path="/gastos" element={<Expenses />} />
          <Route path="/caja" element={<DailyCashBox />} />
          <Route path="/presupuestos" element={<Budgets />} />
          <Route path="/recurrentes" element={<RecurringExpenses />} />
          <Route path="/horas" element={<WorkLogs />} />
          <Route path="/prestamos" element={<Loans />} />
          <Route path="/metas" element={<Goals />} />
          <Route path="/efectivo" element={<Cash />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/notas" element={<Notes />} />
          <Route path="/estadisticas" element={<Stats />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/editar-todo" element={<GlobalEdit />} />
          <Route path="/auditoria" element={<AuditPage />} />
          <Route path="/admin" element={<AdminUsers />} />
          <Route path="/ajustes" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
