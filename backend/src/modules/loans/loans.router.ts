/**
 * Módulo Préstamos — dinero prestado (LENT) y recibido (BORROWED),
 * con abonos parciales y recálculo automático del estado.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { audit } from "../../lib/audit";
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

async function updateLoanStatus(id: number) {
  const loan = await prisma().loan.findUniqueOrThrow({
    where: { id },
    include: { payments: true },
  });
  const principalPaid = round2(loan.payments.reduce((s, p) => s + (p.principalAmount || p.amount), 0));
  const interestPaid = round2(loan.payments.reduce((s, p) => s + (p.interestAmount ?? 0), 0));
  const interestExpected = round2(loan.amount * ((loan.interestRate ?? 0) / 100));
  return prisma().loan.update({
    where: { id },
    data: { status: statusFor(loan.amount, principalPaid, interestExpected, interestPaid) },
    include: { payments: { orderBy: { date: "asc" } } },
  });
}

async function validatePaymentTotals(
  loan: { amount: number; interestRate: number | null; payments: { id: number; amount: number; principalAmount: number | null; interestAmount: number | null }[] },
  principalAmount: number,
  interestAmount: number,
  ignorePaymentId?: number,
) {
  const otherPayments = loan.payments.filter((payment) => payment.id !== ignorePaymentId);
  const paidSoFar = otherPayments.reduce((s, p) => s + (p.principalAmount || p.amount), 0);
  const interestPaidSoFar = otherPayments.reduce((s, p) => s + (p.interestAmount ?? 0), 0);
  const interestExpected = round2(loan.amount * ((loan.interestRate ?? 0) / 100));
  if (paidSoFar + principalAmount > loan.amount + 0.009) {
    throw new ApiError(400, "El pago a capital supera lo pendiente del prestamo");
  }
  if (interestPaidSoFar + interestAmount > interestExpected + 0.009) {
    throw new ApiError(400, "El pago de interes supera el interes esperado");
  }
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
    await audit(req, "CREATE", "loan", created.id, `Prestamo creado: ${created.person} (${created.amount})`);
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
    await audit(req, "UPDATE", "loan", updated.id, `Prestamo editado: ${updated.person} (${updated.amount})`);
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
    await validatePaymentTotals(loan, principalAmount, interestAmount);
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
    await audit(req, "CREATE", "loanPayment", id, `Pago de prestamo registrado para ${loan.person}`);
    const updated = await updateLoanStatus(id);
    res.status(201).json(withTotals(updated));
  }),
);

loansRouter.put(
  "/:id/payments/:paymentId",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const paymentId = parseId(req.params.paymentId);
    const data = parseBody(paymentSchema, req.body);
    await ensureOwned(req, "loan", id);
    const loan = await prisma().loan.findUniqueOrThrow({
      where: { id },
      include: { payments: true },
    });
    const payment = loan.payments.find((item) => item.id === paymentId);
    if (!payment) throw new ApiError(404, "Pago no encontrado");
    const principalAmount = round2(data.amount != null ? data.amount : data.principalAmount);
    const interestAmount = round2(data.interestAmount);
    await validatePaymentTotals(loan, principalAmount, interestAmount, paymentId);
    await prisma().loanPayment.update({
      where: { id: paymentId },
      data: {
        date: data.date,
        note: data.note,
        amount: round2(principalAmount + interestAmount),
        principalAmount,
        interestAmount,
      },
    });
    await audit(req, "UPDATE", "loanPayment", paymentId, `Pago de prestamo editado para ${loan.person}`);
    const updated = await updateLoanStatus(id);
    res.json(withTotals(updated));
  }),
);

loansRouter.delete(
  "/:id/payments/:paymentId",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const paymentId = parseId(req.params.paymentId);
    await ensureOwned(req, "loan", id);
    const payment = await prisma().loanPayment.findFirst({ where: { id: paymentId, loanId: id } });
    if (!payment) throw new ApiError(404, "Pago no encontrado");
    await prisma().loanPayment.delete({ where: { id: paymentId } });
    await audit(req, "DELETE", "loanPayment", paymentId, `Pago de prestamo eliminado`);
    const updated = await updateLoanStatus(id);
    res.json(withTotals(updated));
  }),
);

loansRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "loan", id);
    const current = await prisma().loan.findUnique({ where: { id } });
    await prisma().loan.delete({ where: { id } });
    await audit(req, "DELETE", "loan", id, `Prestamo eliminado: ${current?.person ?? id}`);
    res.json({ ok: true });
  }),
);
