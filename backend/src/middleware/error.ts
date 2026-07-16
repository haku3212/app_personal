/**
 * Middleware central de manejo de errores.
 * Toda excepción de la API termina aquí y se responde en un formato único.
 */
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/http";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[api] Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Recurso no encontrado" });
}
