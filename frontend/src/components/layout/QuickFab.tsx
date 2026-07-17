import { Link, useLocation } from "react-router-dom";
import { Plus } from "lucide-react";

export function QuickFab() {
  const location = useLocation();
  if (location.pathname === "/rapido") return null;

  return (
    <Link
      to="/rapido"
      className="fixed bottom-20 right-4 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:scale-105 md:flex"
      aria-label="Registrar rapido"
      title="Registrar rapido"
    >
      <Plus className="h-6 w-6" />
    </Link>
  );
}

