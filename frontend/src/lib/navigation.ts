import {
  BarChart3,
  CalendarDays,
  CalendarClock,
  Clock,
  FileText,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Shield,
  StickyNote,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "General",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/rapido", label: "Rapido", icon: Zap },
      { to: "/calendario", label: "Calendario", icon: CalendarDays },
      { to: "/estadisticas", label: "Estadisticas", icon: BarChart3 },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { to: "/ingresos", label: "Ingresos", icon: TrendingUp },
      { to: "/gastos", label: "Gastos", icon: TrendingDown },
      { to: "/efectivo", label: "Efectivo", icon: Wallet },
      { to: "/caja", label: "Caja diaria", icon: Wallet },
      { to: "/presupuestos", label: "Presupuestos", icon: WalletCards },
      { to: "/recurrentes", label: "Recurrentes", icon: CalendarClock },
      { to: "/prestamos", label: "Prestamos", icon: HandCoins },
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
      { to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
      { to: "/ajustes", label: "Ajustes", icon: Settings },
    ],
  },
];
