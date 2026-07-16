import { NavLink } from "react-router-dom";
import { Wallet2 } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
}

/** Barra lateral de navegación (colapsable en pantallas pequeñas). */
export function Sidebar({ open, onNavigate }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r bg-card transition-transform duration-200 md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Wallet2 className="h-4.5 w-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">Personal Control</p>
          <p className="text-[10px] text-muted-foreground">Tu vida financiera</p>
        </div>
      </div>

      <nav className="h-[calc(100vh-3.5rem)] space-y-5 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
