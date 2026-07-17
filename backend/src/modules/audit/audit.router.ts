import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
import { requireAdmin } from "../auth/auth.middleware";

export const auditRouter = Router();

auditRouter.use(requireAdmin);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { entity, action, q } = req.query as Record<string, string | undefined>;
    const logs = await prisma().auditLog.findMany({
      where: {
        entity: entity || undefined,
        action: action || undefined,
        ...(q
          ? {
              OR: [
                { actorName: { contains: q } },
                { description: { contains: q } },
                { entity: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(logs);
  }),
);
