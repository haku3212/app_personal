/**
 * Módulo Notas — notas rápidas con checklist opcional.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId } from "../../lib/http";

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
  asyncHandler(async (_req, res) => {
    const notes = await prisma().note.findMany({
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
        items: { create: items.map((it, order) => ({ ...it, order })) },
      },
      include,
    });
    res.status(201).json(created);
  }),
);

notesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { items, ...data } = parseBody(noteSchema, req.body);
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
    res.json(updated);
  }),
);

/** PATCH /api/notes/items/:itemId/toggle — marcar/desmarcar un pendiente. */
notesRouter.patch(
  "/items/:itemId/toggle",
  asyncHandler(async (req, res) => {
    const itemId = parseId(req.params.itemId);
    const item = await prisma().noteItem.findUniqueOrThrow({ where: { id: itemId } });
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
    await prisma().note.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
