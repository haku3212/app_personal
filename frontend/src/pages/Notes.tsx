import { useState } from "react";
import { Pin, Plus, StickyNote, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GLOBAL_KEYS, useApiMutation, useApiQuery } from "@/hooks/useCrud";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

interface FormItem {
  text: string;
  done: boolean;
}

interface FormState {
  title: string;
  content: string;
  pinned: boolean;
  items: FormItem[];
}

const emptyForm = (): FormState => ({ title: "", content: "", pinned: false, items: [] });

/** Notas rápidas con checklist de pendientes. */
export function Notes() {
  const { data: notes = [] } = useApiQuery<Note[]>(["notes"], "/notes");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [newItem, setNewItem] = useState("");
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [error, setError] = useState("");

  const invalidate = [["notes"], ...GLOBAL_KEYS];
  const save = useApiMutation(
    (payload: object) => (editing ? api.put(`/notes/${editing.id}`, payload) : api.post("/notes", payload)),
    invalidate,
    () => setFormOpen(false),
  );
  const remove = useApiMutation(
    (id: number) => api.delete(`/notes/${id}`),
    invalidate,
    () => setDeleting(null),
  );
  const toggleItem = useApiMutation(
    (itemId: number) => api.patch(`/notes/items/${itemId}/toggle`),
    [["notes"]],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setNewItem("");
    setError("");
    setFormOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditing(note);
    setForm({
      title: note.title,
      content: note.content,
      pinned: note.pinned,
      items: note.items.map((i) => ({ text: i.text, done: i.done })),
    });
    setNewItem("");
    setError("");
    setFormOpen(true);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setForm({ ...form, items: [...form.items, { text: newItem.trim(), done: false }] });
    setNewItem("");
  };

  const submit = () => {
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    save.mutate(
      { ...form, title: form.title.trim() },
      { onError: (e) => setError(e.message) },
    );
  };

  return (
    <div>
      <PageHeader
        title="Notas"
        description="Notas rápidas, pendientes y checklists"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva nota
          </Button>
        }
      />

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="Sin notas" description="Crea tu primera nota o checklist." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className={cn(note.pinned && "border-primary/50")}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <CardTitle className="flex items-center gap-1.5">
                  {note.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                  {note.title}
                </CardTitle>
                <span className="text-[10px] text-muted-foreground">{shortDate(note.updatedAt)}</span>
              </CardHeader>
              <CardContent>
                {note.content && (
                  <p className="mb-2 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
                )}
                {note.items.length > 0 && (
                  <div className="space-y-1">
                    {note.items.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleItem.mutate(item.id)}
                          className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                        />
                        <span className={cn(item.done && "text-muted-foreground line-through")}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(note)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleting(note)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Editar nota" : "Nueva nota"}>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Contenido</Label>
            <Textarea
              rows={4}
              placeholder="Escribe tu nota…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            />
            Fijar arriba
          </label>

          {/* Checklist */}
          <div>
            <Label>Checklist</Label>
            <div className="space-y-1.5">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setForm({
                        ...form,
                        items: form.items.map((it, j) => (j === i ? { ...it, done: !it.done } : it)),
                      })
                    }
                    className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                  />
                  <span className="flex-1 text-sm">{item.text}</span>
                  <button
                    onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                    className="text-muted-foreground hover:text-red-500"
                    aria-label="Quitar ítem"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Nuevo pendiente…"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                />
                <Button variant="outline" onClick={addItem}>
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Guardar
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar nota"
        message={`¿Eliminar la nota «${deleting?.title ?? ""}»?`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
