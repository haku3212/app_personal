import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acciones a la derecha (botones, filtros…). */
  actions?: ReactNode;
}

/** Encabezado consistente para todas las páginas. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
