import { NavLink } from "react-router-dom";
import { Home, MoreHorizontal, Plus, ReceiptText, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/gastos", label: "Gastos", icon: TrendingDown },
  { to: "/rapido", label: "Registrar", icon: Plus, primary: true },
  { to: "/presupuestos", label: "Control", icon: ReceiptText },
  { to: "/ajustes", label: "Mas", icon: MoreHorizontal },
];

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors",
                isActive && "bg-primary/10 text-primary",
                item.primary && "relative -mt-5 text-primary",
              )
            }
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md",
                item.primary && "h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30",
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

