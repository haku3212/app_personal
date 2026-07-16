import type { Request } from "express";
import { ApiError } from "./http";
import { prisma } from "./prisma";

export function selectedOwnerId(req: Request): number | undefined {
  if (!req.user) return undefined;
  const raw = req.header("x-owner-user-id");
  if (req.user.role === "ADMIN" && raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Usuario seleccionado invalido");
    return id;
  }
  return req.user.id;
}

export function ownerWhere(req: Request): { ownerId?: number } {
  const ownerId = selectedOwnerId(req);
  return ownerId ? { ownerId } : {};
}

export function ownerData(req: Request): { ownerId?: number } {
  return ownerWhere(req);
}

export async function ensureOwned(
  req: Request,
  model:
    | "account"
    | "category"
    | "income"
    | "expense"
    | "workLog"
    | "loan"
    | "savingGoal"
    | "note",
  id: number,
): Promise<void> {
  const ownerId = selectedOwnerId(req);
  if (!ownerId) return;
  const found = await (prisma()[model] as any).findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!found) throw new ApiError(404, "Registro no encontrado para este usuario");
}
