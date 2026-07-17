import { NavLink } from "react-router-dom";
import { Edit3, Home, Plus, ReceiptText, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/gastos", label: "Gastos", icon: TrendingDown },
  { to: "/rapido", label: "Registrar", icon: Plus, primary: true },
  { to: "/reportes", label: "Reportes", icon: ReceiptText },
  { to: "/editar-todo", label: "Editar", icon: Edit3 },
];

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-2xl shadow-black/15 backdrop-blur">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition-all",
                isActive && !item.primary && "bg-primary/10 text-primary",
                item.primary && "relative -mt-6 text-primary",
              )
            }
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                item.primary && "h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/35",
              )}
            >
              <item.icon className={cn(item.primary ? "h-5 w-5" : "h-4 w-4")} />
            </span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
