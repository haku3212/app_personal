import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useCrud";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import type { AppNotification } from "@/types";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
}

const levelDot: Record<AppNotification["level"], string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/** Barra superior: menú, búsqueda global, notificaciones y tema. */
export function Topbar({ onToggleSidebar, onOpenSearch }: TopbarProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: notifications = [] } = useApiQuery<AppNotification[]>(
    ["notifications"],
    "/notifications",
  );
  const [showNotifications, setShowNotifications] = useState(false);

  const isDark = document.documentElement.classList.contains("dark");
  const toggleTheme = () => updateSettings.mutate({ theme: isDark ? "light" : "dark" });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Buscador global (abre el diálogo Ctrl+K) */}
      <button
        onClick={onOpenSearch}
        className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar movimientos…</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {/* Notificaciones */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications((v) => !v)}
            aria-label="Notificaciones"
          >
            <Bell className="h-4.5 w-4.5" />
            {notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </Button>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border bg-popover p-2 shadow-xl animate-scale-in">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Notificaciones
                </p>
                {notifications.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Todo en orden ✨
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="flex gap-2 rounded-lg px-2 py-2 hover:bg-accent">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", levelDot[n.level])} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground">{n.detail}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Cambio de tema */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
          {settings?.theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>
      </div>
    </header>
  );
}
