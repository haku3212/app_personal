import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { getUserFromToken, type AuthUser } from "./auth.service";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function bearer(req: Request): string | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    req.user = (await getUserFromToken(bearer(req))) ?? undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, "Sesion requerida"));
  return next();
}

export async function requireUserOrLegacy(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.user) return next();
    const users = await prisma().user.count();
    if (users === 0) return next();
    return next(new ApiError(401, "Sesion requerida"));
  } catch (err) {
    return next(err);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, "Sesion requerida"));
  if (req.user.role !== "ADMIN") return next(new ApiError(403, "Solo admin"));
  return next();
}

export function bearerToken(req: Request): string | undefined {
  return bearer(req);
}
