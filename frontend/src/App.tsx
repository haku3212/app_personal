import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Incomes } from "@/pages/Incomes";
import { Expenses } from "@/pages/Expenses";
import { WorkLogs } from "@/pages/WorkLogs";
import { Loans } from "@/pages/Loans";
import { Goals } from "@/pages/Goals";
import { Cash } from "@/pages/Cash";
import { CalendarPage } from "@/pages/CalendarPage";
import { Notes } from "@/pages/Notes";
import { Stats } from "@/pages/Stats";
import { Reports } from "@/pages/Reports";
import { SettingsPage } from "@/pages/SettingsPage";

/** Rutas de la aplicación — una por módulo. */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ingresos" element={<Incomes />} />
        <Route path="/gastos" element={<Expenses />} />
        <Route path="/horas" element={<WorkLogs />} />
        <Route path="/prestamos" element={<Loans />} />
        <Route path="/metas" element={<Goals />} />
        <Route path="/efectivo" element={<Cash />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/notas" element={<Notes />} />
        <Route path="/estadisticas" element={<Stats />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/ajustes" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
