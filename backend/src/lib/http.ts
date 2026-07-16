/**
 * Utilidades HTTP compartidas por todos los módulos.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";

/** Error de negocio con código HTTP explícito. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Envuelve un handler async para propagar errores al middleware central. */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/** Valida `req.body` contra un esquema Zod y devuelve datos tipados (salida). */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join(" | ");
    throw new ApiError(400, `Datos inválidos → ${detail}`);
  }
  return result.data;
}

/** Convierte `req.params.id` en entero positivo o lanza 400. */
export function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Identificador inválido");
  }
  return id;
}

/** Redondea montos de dinero a 2 decimales. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
