/**
 * Módulo Notas — notas rápidas con checklist opcional.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId } from "../../lib/http";
import { audit } from "../../lib/audit";
import { ensureOwned, ownerData, ownerWhere } from "../../lib/owner";

const noteSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(120),
  content: z.string().max(10_000).default(""),
  pinned: z.boolean().default(false),
  /** Checklist completo; se reemplaza en cada guardado para simplicidad. */
  items: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(300),
        done: z.boolean().default(false),
      }),
    )
    .default([]),
});

const include = { items: { orderBy: { order: "asc" as const } } };

export const notesRouter = Router();

notesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notes = await prisma().note.findMany({
      where: ownerWhere(req),
      include,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });
    res.json(notes);
  }),
);

notesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { items, ...data } = parseBody(noteSchema, req.body);
    const created = await prisma().note.create({
      data: {
        ...data,
        ...ownerData(req),
        items: { create: items.map((it, order) => ({ ...it, order })) },
      },
      include,
    });
    await audit(req, "CREATE", "note", created.id, `Nota creada: ${created.title}`);
    res.status(201).json(created);
  }),
);

notesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { items, ...data } = parseBody(noteSchema, req.body);
    await ensureOwned(req, "note", id);
    // El checklist se reemplaza completo: borrar y recrear en una transacción.
    const [, updated] = await prisma().$transaction([
      prisma().noteItem.deleteMany({ where: { noteId: id } }),
      prisma().note.update({
        where: { id },
        data: {
          ...data,
          items: { create: items.map((it, order) => ({ ...it, order })) },
        },
        include,
      }),
    ]);
    await audit(req, "UPDATE", "note", updated.id, `Nota editada: ${updated.title}`);
    res.json(updated);
  }),
);

/** PATCH /api/notes/items/:itemId/toggle — marcar/desmarcar un pendiente. */
notesRouter.patch(
  "/items/:itemId/toggle",
  asyncHandler(async (req, res) => {
    const itemId = parseId(req.params.itemId);
    const item = await prisma().noteItem.findUniqueOrThrow({ where: { id: itemId }, include: { note: true } });
    await ensureOwned(req, "note", item.noteId);
    const updated = await prisma().noteItem.update({
      where: { id: itemId },
      data: { done: !item.done },
    });
    res.json(updated);
  }),
);

notesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "note", id);
    const current = await prisma().note.findUnique({ where: { id } });
    await prisma().note.delete({ where: { id } });
    await audit(req, "DELETE", "note", id, `Nota eliminada: ${current?.title ?? id}`);
    res.json({ ok: true });
  }),
);
