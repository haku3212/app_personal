import type { Request } from "express";
import { prisma } from "./prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "IMPORT" | "EXPORT";

export async function audit(
  req: Request,
  action: AuditAction,
  entity: string,
  entityId: string | number | null | undefined,
  description: string,
) {
  try {
    await prisma().auditLog.create({
      data: {
        actorId: req.user?.id,
        actorName: req.user?.displayName ?? req.user?.username ?? null,
        action,
        entity,
        entityId: entityId == null ? null : String(entityId),
        description,
      },
    });
  } catch (error) {
    console.warn("No se pudo guardar auditoria", error);
  }
}
