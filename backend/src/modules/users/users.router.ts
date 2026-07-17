import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, parseBody, parseId } from "../../lib/http";
import { audit } from "../../lib/audit";
import { requireAdmin, requireUser } from "../auth/auth.middleware";
import { hashPassword } from "../auth/auth.service";
import { seedUserDefaults } from "../../seed";

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(4).max(200),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

const patchUserSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(4).max(200).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  locked: z.boolean().optional(),
});

interface PublicUserInput {
  id: number;
  username: string;
  displayName: string;
  role: string;
  lockedAt: Date | null;
  createdAt: Date;
  summary?: {
    incomes: number;
    expenses: number;
    worklogs: number;
    loans: number;
    goals: number;
    notes: number;
  };
}

function publicUser(user: PublicUserInput) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    lockedAt: user.lockedAt,
    createdAt: user.createdAt,
    summary: user.summary,
  };
}

async function userSummary(ownerId: number): Promise<NonNullable<PublicUserInput["summary"]>> {
  const db = prisma();
  const [incomes, expenses, worklogs, loans, goals, notes] = await Promise.all([
    db.income.count({ where: { ownerId } }),
    db.expense.count({ where: { ownerId } }),
    db.workLog.count({ where: { ownerId } }),
    db.loan.count({ where: { ownerId } }),
    db.savingGoal.count({ where: { ownerId } }),
    db.note.count({ where: { ownerId } }),
  ]);
  return { incomes, expenses, worklogs, loans, goals, notes };
}

export const usersRouter = Router();

usersRouter.use(requireUser);

usersRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma().user.findMany({ orderBy: { createdAt: "asc" } });
    const enriched = await Promise.all(
      users.map(async (user) => publicUser({ ...user, summary: await userSummary(user.id) })),
    );
    res.json(enriched);
  }),
);

usersRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = parseBody(createUserSchema, req.body);
    if (data.role === "ADMIN") throw new ApiError(400, "Solo el usuario principal puede ser admin");
    const existing = await prisma().user.findUnique({ where: { username: data.username.toLowerCase() } });
    if (existing) throw new ApiError(409, "Ese usuario ya existe");
    const user = await prisma().user.create({
      data: {
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        passwordHash: hashPassword(data.password),
        role: "USER",
      },
    });
    await seedUserDefaults(user.id);
    await audit(req, "CREATE", "user", user.id, `Usuario creado: ${user.displayName}`);
    res.status(201).json(publicUser(user));
  }),
);

usersRouter.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(patchUserSchema, req.body);
    const users = await prisma().user.findMany();
    const current = users.find((user) => user.id === id);
    if (!current) throw new ApiError(404, "Usuario no encontrado");
    if (data.role === "ADMIN" && current.role !== "ADMIN") {
      throw new ApiError(400, "Solo el usuario principal puede ser admin");
    }
    if (current.role === "ADMIN" && data.role === "USER" && users.filter((user) => user.role === "ADMIN").length <= 1) {
      throw new ApiError(400, "Debe quedar al menos un admin");
    }
    const user = await prisma().user.update({
      where: { id },
      data: {
        displayName: data.displayName,
        passwordHash: data.password ? hashPassword(data.password) : undefined,
        role: data.role,
        lockedAt: data.locked == null ? undefined : data.locked ? new Date() : null,
      },
    });
    await audit(req, "UPDATE", "user", user.id, `Usuario editado: ${user.displayName}`);
    res.json(publicUser(user));
  }),
);
