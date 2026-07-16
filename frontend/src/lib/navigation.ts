/**
 * Navegación principal — agregar un módulo futuro = 1 entrada aquí.
 */
import {
  BarChart3,
  CalendarDays,
  Clock,
  FileText,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Settings,
  StickyNote,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "General",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/calendario", label: "Calendario", icon: CalendarDays },
      { to: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { to: "/ingresos", label: "Ingresos", icon: TrendingUp },
      { to: "/gastos", label: "Gastos", icon: TrendingDown },
      { to: "/efectivo", label: "Efectivo", icon: Wallet },
      { to: "/prestamos", label: "Préstamos", icon: HandCoins },
      { to: "/metas", label: "Metas de ahorro", icon: PiggyBank },
    ],
  },
  {
    title: "Trabajo",
    items: [{ to: "/horas", label: "Horas de trabajo", icon: Clock }],
  },
  {
    title: "Herramientas",
    items: [
      { to: "/notas", label: "Notas", icon: StickyNote },
      { to: "/reportes", label: "Reportes", icon: FileText },
      { to: "/ajustes", label: "Ajustes", icon: Settings },
    ],
  },
];
