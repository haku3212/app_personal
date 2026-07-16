/**
 * Módulo Cuentas — caja, banco, efectivo… con saldo derivado en tiempo real.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { ensureOwned, ownerData, ownerWhere } from "../../lib/owner";

const accountSchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
  initialBalance: z.number().finite().default(0),
  icon: z.string().max(50).nullish(),
  archived: z.boolean().default(false),
});

export const accountsRouter = Router();

/** Saldo actual de una cuenta = saldo inicial + ingresos − gastos. */
export async function accountBalance(accountId: number): Promise<number> {
  const [account, incomes, expenses] = await Promise.all([
    prisma().account.findUniqueOrThrow({ where: { id: accountId } }),
    prisma().income.aggregate({ where: { accountId }, _sum: { amount: true } }),
    prisma().expense.aggregate({ where: { accountId }, _sum: { amount: true } }),
  ]);
  return round2(
    account.initialBalance + (incomes._sum.amount ?? 0) - (expenses._sum.amount ?? 0),
  );
}

/** Listado con saldo calculado por cuenta. */
accountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const accounts = await prisma().account.findMany({ where: ownerWhere(req), orderBy: { id: "asc" } });
    const withBalance = await Promise.all(
      accounts.map(async (a) => ({ ...a, balance: await accountBalance(a.id) })),
    );
    res.json(withBalance);
  }),
);

accountsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(accountSchema, req.body);
    const created = await prisma().account.create({ data: { ...data, ...ownerData(req) } });
    res.status(201).json({ ...created, balance: created.initialBalance });
  }),
);

accountsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(accountSchema.partial(), req.body);
    await ensureOwned(req, "account", id);
    const updated = await prisma().account.update({ where: { id }, data });
    res.json({ ...updated, balance: await accountBalance(id) });
  }),
);

accountsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "account", id);
    await prisma().account.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
