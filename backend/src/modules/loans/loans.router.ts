/**
 * Módulo Préstamos — dinero prestado (LENT) y recibido (BORROWED),
 * con abonos parciales y recálculo automático del estado.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { rangeFilter } from "../../utils/dates";

const loanSchema = z.object({
  type: z.enum(["LENT", "BORROWED"]),
  person: z.string().trim().min(1, "La persona es obligatoria").max(80),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  date: z.coerce.date(),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().max(500).nullish(),
});

const paymentSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive("El abono debe ser mayor a 0"),
  note: z.string().max(300).nullish(),
});

/** Estado derivado de los abonos: PAID / PARTIAL / PENDING. */
function statusFor(amount: number, paid: number): string {
  if (paid >= amount) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "PENDING";
}

/** Adjunta a cada préstamo el total abonado y lo pendiente. */
function withTotals<T extends { amount: number; payments: { amount: number }[] }>(loan: T) {
  const paid = round2(loan.payments.reduce((s, p) => s + p.amount, 0));
  return { ...loan, paid, remaining: round2(Math.max(0, loan.amount - paid)) };
}

export const loansRouter = Router();

/** GET /api/loans?type&status&from&to&q */
loansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, status, from, to, q } = req.query as Record<string, string | undefined>;
    const loans = await prisma().loan.findMany({
      where: {
        type: type || undefined,
        status: status || undefined,
        date: rangeFilter(from, to),
        ...(q ? { OR: [{ person: { contains: q } }, { notes: { contains: q } }] } : {}),
      },
      include: { payments: { orderBy: { date: "asc" } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    res.json(loans.map(withTotals));
  }),
);

/** GET /api/loans/summary — cuánto me deben, cuánto debo, préstamos activos. */
loansRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const loans = await prisma().loan.findMany({ include: { payments: true } });
    const active = loans.filter((l) => l.status !== "PAID").map(withTotals);
    const owedToMe = round2(
      active.filter((l) => l.type === "LENT").reduce((s, l) => s + l.remaining, 0),
    );
    const iOwe = round2(
      active.filter((l) => l.type === "BORROWED").reduce((s, l) => s + l.remaining, 0),
    );
    res.json({
      owedToMe,
      iOwe,
      totalLoans: loans.length,
      activeLoans: active.length,
      lentTotal: round2(loans.filter((l) => l.type === "LENT").reduce((s, l) => s + l.amount, 0)),
    });
  }),
);

loansRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(loanSchema, req.body);
    const created = await prisma().loan.create({
      data: { ...data, amount: round2(data.amount) },
      include: { payments: true },
    });
    res.status(201).json(withTotals(created));
  }),
);

loansRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const patch = parseBody(loanSchema.partial(), req.body);
    const current = await prisma().loan.findUniqueOrThrow({
      where: { id },
      include: { payments: true },
    });
    const paid = current.payments.reduce((s, p) => s + p.amount, 0);
    const amount = patch.amount != null ? round2(patch.amount) : current.amount;
    const updated = await prisma().loan.update({
      where: { id },
      data: { ...patch, amount, status: statusFor(amount, paid) },
      include: { payments: { orderBy: { date: "asc" } } },
    });
    res.json(withTotals(updated));
  }),
);

/** POST /api/loans/:id/payments — registrar un abono y recalcular estado. */
loansRouter.post(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = parseBody(paymentSchema, req.body);
    const loan = await prisma().loan.findUniqueOrThrow({
      where: { id },
      include: { payments: true },
    });
    const paidSoFar = loan.payments.reduce((s, p) => s + p.amount, 0);
    if (paidSoFar + data.amount > loan.amount + 0.009) {
      throw new ApiError(400, "El abono supera lo pendiente del préstamo");
    }
    await prisma().loanPayment.create({
      data: { ...data, amount: round2(data.amount), loanId: id },
    });
    const updated = await prisma().loan.update({
      where: { id },
      data: { status: statusFor(loan.amount, round2(paidSoFar + data.amount)) },
      include: { payments: { orderBy: { date: "asc" } } },
    });
    res.status(201).json(withTotals(updated));
  }),
);

loansRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await prisma().loan.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
