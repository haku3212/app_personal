/**
 * Módulo Préstamos — dinero prestado (LENT) y recibido (BORROWED),
 * con abonos parciales y recálculo automático del estado.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { ensureOwned, ownerData, ownerWhere } from "../../lib/owner";
import { rangeFilter } from "../../utils/dates";

const loanSchema = z.object({
  type: z.enum(["LENT", "BORROWED"]),
  person: z.string().trim().min(1, "La persona es obligatoria").max(80),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  interestRate: z.number().min(0).max(1000).default(0),
  date: z.coerce.date(),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().max(500).nullish(),
});

const paymentSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive("El abono debe ser mayor a 0").optional(),
  principalAmount: z.number().min(0).default(0),
  interestAmount: z.number().min(0).default(0),
  note: z.string().max(300).nullish(),
}).refine((data) => (data.amount ?? data.principalAmount + data.interestAmount) > 0, {
  message: "El pago debe ser mayor a 0",
});

/** Estado derivado de los abonos: PAID / PARTIAL / PENDING. */
function statusFor(amount: number, principalPaid: number, interestExpected = 0, interestPaid = 0): string {
  if (principalPaid >= amount && interestPaid >= interestExpected) return "PAID";
  if (principalPaid > 0 || interestPaid > 0) return "PARTIAL";
  return "PENDING";
}

/** Adjunta a cada préstamo el total abonado y lo pendiente. */
function withTotals<T extends { amount: number; interestRate: number | null; payments: { amount: number; principalAmount: number | null; interestAmount: number | null }[] }>(loan: T) {
  const interestRate = loan.interestRate ?? 0;
  const principalPaid = round2(loan.payments.reduce((s, p) => s + (p.principalAmount || p.amount), 0));
  const interestPaid = round2(loan.payments.reduce((s, p) => s + (p.interestAmount ?? 0), 0));
  const paid = round2(principalPaid + interestPaid);
  const interestExpected = round2(loan.amount * (interestRate / 100));
  const remaining = round2(Math.max(0, loan.amount - principalPaid));
  const interestRemaining = round2(Math.max(0, interestExpected - interestPaid));
  return {
    ...loan,
    interestRate,
    paid,
    principalPaid,
    interestPaid,
    interestExpected,
    remaining,
    interestRemaining,
    totalRemaining: round2(remaining + interestRemaining),
  };
}

export const loansRouter = Router();

/** GET /api/loans?type&status&from&to&q */
loansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, status, from, to, q } = req.query as Record<string, string | undefined>;
    const loans = await prisma().loan.findMany({
      where: {
        ...ownerWhere(req),
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
  asyncHandler(async (req, res) => {
    const loans = await prisma().loan.findMany({ where: ownerWhere(req), include: { payments: true } });
    const active = loans.filter((l) => l.status !== "PAID").map(withTotals);
    const owedToMe = round2(
      active.filter((l) => l.type === "LENT").reduce((s, l) => s + l.totalRemaining, 0),
    );
    const iOwe = round2(
      active.filter((l) => l.type === "BORROWED").reduce((s, l) => s + l.totalRemaining, 0),
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
      data: { ...data, ...ownerData(req), amount: round2(data.amount), interestRate: round2(data.interestRate) },
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
    await ensureOwned(req, "loan", id);
    const current = await prisma().loan.findUniqueOrThrow({
      where: { id },
      include: { payments: true },
    });
    const principalPaid = current.payments.reduce((s, p) => s + (p.principalAmount || p.amount), 0);
    const interestPaid = current.payments.reduce((s, p) => s + (p.interestAmount ?? 0), 0);
    const amount = patch.amount != null ? round2(patch.amount) : current.amount;
    const interestRate = patch.interestRate != null ? round2(patch.interestRate) : (current.interestRate ?? 0);
    const interestExpected = round2(amount * (interestRate / 100));
    const updated = await prisma().loan.update({
      where: { id },
      data: { ...patch, amount, interestRate, status: statusFor(amount, principalPaid, interestExpected, interestPaid) },
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
    await ensureOwned(req, "loan", id);
    const loan = await prisma().loan.findUniqueOrThrow({
      where: { id },
      include: { payments: true },
    });
    const principalAmount = round2(data.amount != null ? data.amount : data.principalAmount);
    const interestAmount = round2(data.interestAmount);
    const paidSoFar = loan.payments.reduce((s, p) => s + (p.principalAmount || p.amount), 0);
    const interestPaidSoFar = loan.payments.reduce((s, p) => s + (p.interestAmount ?? 0), 0);
    const interestExpected = round2(loan.amount * ((loan.interestRate ?? 0) / 100));
    if (paidSoFar + principalAmount > loan.amount + 0.009) {
      throw new ApiError(400, "El pago a capital supera lo pendiente del prestamo");
    }
    if (interestPaidSoFar + interestAmount > interestExpected + 0.009) {
      throw new ApiError(400, "El pago de interes supera el interes esperado");
    }
    await prisma().loanPayment.create({
      data: {
        date: data.date,
        note: data.note,
        amount: round2(principalAmount + interestAmount),
        principalAmount,
        interestAmount,
        loanId: id,
      },
    });
    const updated = await prisma().loan.update({
      where: { id },
      data: {
        status: statusFor(
          loan.amount,
          round2(paidSoFar + principalAmount),
          interestExpected,
          round2(interestPaidSoFar + interestAmount),
        ),
      },
      include: { payments: { orderBy: { date: "asc" } } },
    });
    res.status(201).json(withTotals(updated));
  }),
);

loansRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "loan", id);
    await prisma().loan.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
