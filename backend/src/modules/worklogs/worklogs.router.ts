/**
 * Módulo Horas de trabajo — jornadas con cálculo automático de
 * horas reales, horas extra y pago esperado.
 */
import { Router } from "express";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { asyncHandler, parseBody, parseId, round2 } from "../../lib/http";
import { ensureOwned, ownerData, ownerWhere } from "../../lib/owner";
import { lastMonths, monthRange, rangeFilter, weekRange } from "../../utils/dates";
import { computeWork } from "../../utils/worklog";

const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;

const workLogSchema = z.object({
  date: z.coerce.date(),
  startTime: z.string().regex(timeRegex, "Formato de hora HH:mm"),
  endTime: z.string().regex(timeRegex, "Formato de hora HH:mm"),
  breakMinutes: z.number().int().min(0).max(720).default(0),
  place: z.string().max(100).nullish(),
  company: z.string().max(100).nullish(),
  project: z.string().max(100).nullish(),
  description: z.string().max(300).nullish(),
  hourlyRate: z.number().min(0).nullish(),
  fixedPay: z.number().min(0).nullish(),
});

export const worklogsRouter = Router();

/** GET /api/worklogs?from&to&company&project&q */
worklogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to, company, project, q } = req.query as Record<string, string | undefined>;
    const logs = await prisma().workLog.findMany({
      where: {
        ...ownerWhere(req),
        date: rangeFilter(from, to),
        company: company ? { contains: company } : undefined,
        project: project ? { contains: project } : undefined,
        ...(q
          ? {
              OR: [
                { description: { contains: q } },
                { place: { contains: q } },
                { company: { contains: q } },
                { project: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { date: "desc" },
    });
    res.json({
      items: logs,
      totalHours: round2(logs.reduce((s, l) => s + l.hours, 0)),
      totalPay: round2(logs.reduce((s, l) => s + l.expectedPay, 0)),
    });
  }),
);

/** GET /api/worklogs/summary — promedios semanales/mensuales y serie por mes. */
worklogsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const week = weekRange();
    const month = monthRange();
    const owned = ownerWhere(req);
    const [weekLogs, monthLogs] = await Promise.all([
      prisma().workLog.findMany({ where: { ...owned, date: { gte: week.from, lte: week.to } } }),
      prisma().workLog.findMany({ where: { ...owned, date: { gte: month.from, lte: month.to } } }),
    ]);

    // Serie de los últimos 6 meses para el gráfico de horas.
    const months = lastMonths(6);
    const monthly = await Promise.all(
      months.map(async (m) => {
        const agg = await prisma().workLog.aggregate({
          where: { ...owned, date: { gte: m.range.from, lte: m.range.to } },
          _sum: { hours: true, expectedPay: true },
        });
        return {
          month: m.label,
          hours: round2(agg._sum.hours ?? 0),
          pay: round2(agg._sum.expectedPay ?? 0),
        };
      }),
    );

    const weekHours = round2(weekLogs.reduce((s, l) => s + l.hours, 0));
    const monthHours = round2(monthLogs.reduce((s, l) => s + l.hours, 0));
    const daysWorkedThisMonth = new Set(monthLogs.map((l) => dayjs(l.date).format("YYYY-MM-DD"))).size;

    res.json({
      weekHours,
      monthHours,
      monthPay: round2(monthLogs.reduce((s, l) => s + l.expectedPay, 0)),
      monthOvertime: round2(monthLogs.reduce((s, l) => s + l.overtime, 0)),
      avgHoursPerDay: daysWorkedThisMonth ? round2(monthHours / daysWorkedThisMonth) : 0,
      monthly,
    });
  }),
);

worklogsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseBody(workLogSchema, req.body);
    const computed = computeWork(data);
    const created = await prisma().workLog.create({ data: { ...data, ...ownerData(req), ...computed } });
    res.status(201).json(created);
  }),
);

worklogsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const patch = parseBody(workLogSchema.partial(), req.body);
    await ensureOwned(req, "workLog", id);
    // Para recalcular se combinan los datos existentes con el parche recibido.
    const current = await prisma().workLog.findUniqueOrThrow({ where: { id } });
    const merged = { ...current, ...patch };
    const computed = computeWork(merged);
    const updated = await prisma().workLog.update({
      where: { id },
      data: { ...patch, ...computed },
    });
    res.json(updated);
  }),
);

worklogsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await ensureOwned(req, "workLog", id);
    await prisma().workLog.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
