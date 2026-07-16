import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  /** Renderiza la celda de una fila. */
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: number }> {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

/** Tabla genérica con acciones de editar/eliminar — usada por todos los módulos. */
export function DataTable<T extends { id: number }>({
  columns,
  rows,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            {columns.map((c) => (
              <th key={c.header} className={cn("px-4 py-2.5 font-medium", c.className)}>
                {c.header}
              </th>
            ))}
            {(onEdit || onDelete) && <th className="w-20 px-2 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 transition-colors hover:bg-accent/40">
              {columns.map((c) => (
                <td key={c.header} className={cn("px-4 py-2.5", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-2 py-1.5">
                  <div className="flex justify-end gap-1">
                    {onEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row)} aria-label="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={() => onDelete(row)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
