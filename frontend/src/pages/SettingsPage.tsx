import { useRef, useState } from "react";
import dayjs from "dayjs";
import { DatabaseBackup, Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import type { BackupFile, Category } from "@/types";

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Ajustes: moneda, tema, categorías editables, respaldos e import/export. */
export function SettingsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  // --- Categorías ---
  const { data: categories = [] } = useApiQuery<Category[]>(["categories", "all"], "/categories");
  const [catForm, setCatForm] = useState({ name: "", kind: "EXPENSE" as Category["kind"], color: "#8b5cf6" });
  const [catOpen, setCatOpen] = useState(false);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  const catInvalidate = [["categories"], ...GLOBAL_KEYS];
  const createCategory = useApiMutation(
    (payload: object) => api.post("/categories", payload),
    catInvalidate,
    () => setCatOpen(false),
  );
  const removeCategory = useApiMutation(
    (id: number) => api.delete(`/categories/${id}`),
    catInvalidate,
    () => setDeletingCat(null),
  );

  // --- Respaldos ---
  const { data: backups = [] } = useApiQuery<BackupFile[]>(["backups"], "/backups");
  const [restoring, setRestoring] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const allKeys = [["backups"], ["settings"], ["categories"], ["incomes"], ["expenses"], ["worklogs"], ["loans"], ["goals"], ["notes"], ...GLOBAL_KEYS];
  const createBackup = useApiMutation(
    () => api.post<{ name: string }>("/backups"),
    [["backups"]],
    () => setMessage("Respaldo creado correctamente ✔"),
  );
  const restoreBackup = useApiMutation(
    (name: string) => api.post(`/backups/${encodeURIComponent(name)}/restore`),
    allKeys,
    () => {
      setRestoring(null);
      setMessage("Respaldo restaurado ✔ Los datos fueron recargados.");
    },
  );
  const deleteBackup = useApiMutation((name: string) => api.delete(`/backups/${encodeURIComponent(name)}`), [
    ["backups"],
  ]);
  const importDb = useApiMutation(
    (file: File) => api.upload("/backups/import", file),
    allKeys,
    () => setMessage("Base de datos importada ✔"),
  );

  const expenseCats = categories.filter((c) => c.kind === "EXPENSE");
  const incomeCats = categories.filter((c) => c.kind === "INCOME");

  return (
    <div>
      <PageHeader title="Ajustes" description="Configuración general, categorías y respaldos" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Preferencias generales */}
        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
            <CardDescription>Moneda, tema y respaldos automáticos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Moneda</Label>
                <Input
                  value={settings?.currency ?? "Bs."}
                  onChange={(e) => updateSettings.mutate({ currency: e.target.value })}
                />
              </div>
              <div>
                <Label>Tema</Label>
                <Select
                  value={settings?.theme ?? "dark"}
                  onChange={(e) =>
                    updateSettings.mutate({ theme: e.target.value as "light" | "dark" | "system" })
                  }
                >
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="system">Según el sistema</option>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Respaldo automático</p>
                <p className="text-xs text-muted-foreground">Crear una copia al cerrar la aplicación</p>
              </div>
              <Switch
                checked={settings?.autoBackup ?? true}
                onCheckedChange={(v) => updateSettings.mutate({ autoBackup: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Categorías */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Categorías</CardTitle>
              <CardDescription>Edita las categorías de ingresos y gastos.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setCatOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nueva
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Gastos", list: expenseCats },
              { label: "Ingresos", list: incomeCats },
            ].map(({ label, list }) => (
              <div key={label}>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((c) => (
                    <Badge key={c.id} variant="muted" className="group gap-1.5 py-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                      <button
                        onClick={() => setDeletingCat(c)}
                        className="opacity-40 transition-opacity hover:text-red-500 group-hover:opacity-100"
                        aria-label={`Eliminar ${c.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Respaldos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Respaldos de la base de datos</CardTitle>
              <CardDescription>
                Crea copias con un botón, restáuralas o mueve tu base entre computadoras.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => createBackup.mutate({})} disabled={createBackup.isPending}>
                <DatabaseBackup className="h-3.5 w-3.5" /> Crear respaldo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => api.download("/backups/export", "personal-control.sqlite")}
              >
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Importar
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,.sqlite,.db"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importDb.mutate(file);
                  e.target.value = "";
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            {message && <p className="mb-3 text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
            {importDb.isError && (
              <p className="mb-3 text-xs text-red-500">{(importDb.error as Error).message}</p>
            )}
            {backups.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Todavía no hay respaldos. Crea el primero con el botón de arriba.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {backups.map((b) => (
                  <div key={b.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {dayjs(b.createdAt).format("DD/MM/YYYY HH:mm")} · {formatSize(b.size)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setRestoring(b)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => deleteBackup.mutate(b.name)}
                        aria-label="Eliminar respaldo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nueva categoría */}
      <Dialog open={catOpen} onClose={() => setCatOpen(false)} title="Nueva categoría" width="max-w-sm">
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select
              value={catForm.kind}
              onChange={(e) => setCatForm({ ...catForm, kind: e.target.value as Category["kind"] })}
            >
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <Input
              type="color"
              className="h-9 w-20 cursor-pointer p-1"
              value={catForm.color}
              onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
            />
          </div>
        </div>
        {createCategory.isError && (
          <p className="mt-3 text-xs text-red-500">{(createCategory.error as Error).message}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCatOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!catForm.name.trim() || createCategory.isPending}
            onClick={() => createCategory.mutate({ ...catForm, name: catForm.name.trim() })}
          >
            Crear categoría
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deletingCat !== null}
        title="Eliminar categoría"
        message={`¿Eliminar la categoría «${deletingCat?.name ?? ""}»? Los movimientos existentes quedarán sin categoría.`}
        onConfirm={() => deletingCat && removeCategory.mutate(deletingCat.id)}
        onCancel={() => setDeletingCat(null)}
      />

      <ConfirmDialog
        open={restoring !== null}
        title="Restaurar respaldo"
        message={`¿Restaurar «${restoring?.name ?? ""}»? Se creará un respaldo de seguridad de los datos actuales antes de sobrescribirlos.`}
        onConfirm={() => restoring && restoreBackup.mutate(restoring.name)}
        onCancel={() => setRestoring(null)}
      />
    </div>
  );
}
