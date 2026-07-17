/**
 * Módulo Reportes — exportación a Excel y PDF (pdfkit)
 * de ingresos, gastos y horas trabajadas, filtrable por fechas y categoría.
 */
import { Router } from "express";
import PDFDocument from "pdfkit";
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/node";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, round2 } from "../../lib/http";
import { ownerWhere } from "../../lib/owner";
import { rangeFilter } from "../../utils/dates";
import { getSettings } from "../settings/settings.router";

type ReportKind = "incomes" | "expenses" | "worklogs";

interface PeriodInsight {
  label: string;
  from: string;
  to: string;
  income: number;
  expense: number;
  profit: number;
}

interface ReportData {
  title: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, string | number>[];
  total: number;
}

/** Arma las filas del reporte según el tipo pedido y los filtros. */
async function buildReport(
  kind: ReportKind,
  owned: { ownerId?: number },
  from?: string,
  to?: string,
  categoryId?: string,
): Promise<ReportData> {
  const db = prisma();
  const date = rangeFilter(from, to);
  const fmt = (d: Date) => dayjs(d).format("DD/MM/YYYY");

  if (kind === "incomes") {
    const items = await db.income.findMany({
      where: { ...owned, date, categoryId: categoryId ? Number(categoryId) : undefined },
      include: { category: true, account: true },
      orderBy: { date: "asc" },
    });
    return {
      title: "Reporte de Ingresos",
      columns: [
        { header: "Fecha", key: "date", width: 12 },
        { header: "Origen", key: "source", width: 20 },
        { header: "Categoría", key: "category", width: 16 },
        { header: "Descripción", key: "description", width: 30 },
        { header: "Método", key: "method", width: 14 },
        { header: "Cuenta", key: "account", width: 14 },
        { header: "Monto", key: "amount", width: 12 },
      ],
      rows: items.map((i) => ({
        date: fmt(i.date),
        source: i.source,
        category: i.category?.name ?? "-",
        description: i.description ?? "",
        method: i.paymentMethod,
        account: i.account?.name ?? "-",
        amount: i.amount,
      })),
      total: round2(items.reduce((s, i) => s + i.amount, 0)),
    };
  }

  if (kind === "expenses") {
    const items = await db.expense.findMany({
      where: { ...owned, date, categoryId: categoryId ? Number(categoryId) : undefined },
      include: { category: true, account: true },
      orderBy: { date: "asc" },
    });
    return {
      title: "Reporte de Gastos",
      columns: [
        { header: "Fecha", key: "date", width: 12 },
        { header: "Categoría", key: "category", width: 16 },
        { header: "Descripción", key: "description", width: 34 },
        { header: "Método", key: "method", width: 14 },
        { header: "Cuenta", key: "account", width: 14 },
        { header: "Monto", key: "amount", width: 12 },
      ],
      rows: items.map((e) => ({
        date: fmt(e.date),
        category: e.category?.name ?? "-",
        description: e.description ?? "",
        method: e.paymentMethod,
        account: e.account?.name ?? "-",
        amount: e.amount,
      })),
      total: round2(items.reduce((s, e) => s + e.amount, 0)),
    };
  }

  const items = await db.workLog.findMany({ where: { ...owned, date }, orderBy: { date: "asc" } });
  return {
    title: "Reporte de Horas Trabajadas",
    columns: [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Inicio", key: "start", width: 9 },
      { header: "Fin", key: "end", width: 9 },
      { header: "Horas", key: "hours", width: 9 },
      { header: "Empresa", key: "company", width: 18 },
      { header: "Proyecto", key: "project", width: 18 },
      { header: "Pago", key: "pay", width: 12 },
    ],
    rows: items.map((w) => ({
      date: fmt(w.date),
      start: w.startTime,
      end: w.endTime,
      hours: w.hours,
      company: w.company ?? "-",
      project: w.project ?? "-",
      pay: w.expectedPay,
    })),
    total: round2(items.reduce((s, w) => s + w.expectedPay, 0)),
  };
}

function parseKind(raw: string | undefined): ReportKind {
  if (raw === "incomes" || raw === "expenses" || raw === "worklogs") return raw;
  throw new ApiError(400, "Tipo de reporte inválido (incomes | expenses | worklogs)");
}

export const reportsRouter = Router();

async function periodTotals(owned: { ownerId?: number }, label: string, from: dayjs.Dayjs, to: dayjs.Dayjs): Promise<PeriodInsight> {
  const date = { gte: from.startOf("day").toDate(), lte: to.endOf("day").toDate() };
  const [income, expense] = await Promise.all([
    prisma().income.aggregate({ where: { ...owned, date }, _sum: { amount: true } }),
    prisma().expense.aggregate({ where: { ...owned, date }, _sum: { amount: true } }),
  ]);
  const incomeTotal = round2(income._sum.amount ?? 0);
  const expenseTotal = round2(expense._sum.amount ?? 0);
  return {
    label,
    from: from.format("YYYY-MM-DD"),
    to: to.format("YYYY-MM-DD"),
    income: incomeTotal,
    expense: expenseTotal,
    profit: round2(incomeTotal - expenseTotal),
  };
}

reportsRouter.get(
  "/insights",
  asyncHandler(async (req, res) => {
    const owned = ownerWhere(req);
    const now = dayjs();
    const biweekStart = now.date() <= 15 ? now.startOf("month") : now.date(16).startOf("day");
    const biweekEnd = now.date() <= 15 ? now.date(15).endOf("day") : now.endOf("month");
    const monthStart = now.startOf("month");
    const monthEnd = now.endOf("month");

    const [week, biweek, month, expenses] = await Promise.all([
      periodTotals(owned, "Esta semana", now.startOf("week"), now.endOf("week")),
      periodTotals(owned, "Esta quincena", biweekStart, biweekEnd),
      periodTotals(owned, "Este mes", monthStart, monthEnd),
      prisma().expense.findMany({
        where: { ...owned, date: { gte: monthStart.toDate(), lte: monthEnd.toDate() } },
        include: { category: true },
      }),
    ]);

    const byCategory = new Map<string, { name: string; color: string; amount: number; count: number }>();
    for (const expense of expenses) {
      const name = expense.category?.name ?? "Sin categoria";
      const current = byCategory.get(name) ?? { name, color: expense.category?.color ?? "#64748b", amount: 0, count: 0 };
      current.amount = round2(current.amount + expense.amount);
      current.count += 1;
      byCategory.set(name, current);
    }

    const categories = [...byCategory.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        percent: month.expense > 0 ? round2((item.amount / month.expense) * 100) : 0,
      }));

    res.json({
      periods: [week, biweek, month],
      topCategories: categories,
      dangerCategory: categories[0] ?? null,
    });
  }),
);

function excelCell(value: string | number, bold = false): Cell {
  return {
    value,
    fontWeight: bold ? "bold" : undefined,
    backgroundColor: bold ? "#7C3AED" : undefined,
    textColor: bold ? "#FFFFFF" : undefined,
    align: typeof value === "number" ? "right" : "left",
    wrap: true,
  };
}

function buildExcelRows(data: ReportData, currency: string): SheetData {
  const rows: SheetData = [
    data.columns.map((column) => excelCell(column.header, true)),
    ...data.rows.map((row) => data.columns.map((column) => excelCell(row[column.key] ?? ""))),
  ];
  const totalRow = Array.from({ length: data.columns.length }, () => null) as Cell[];

  if (totalRow.length >= 2) {
    totalRow[totalRow.length - 2] = {
      value: "TOTAL",
      fontWeight: "bold",
      align: "right",
    };
    totalRow[totalRow.length - 1] = {
      value: `${currency} ${data.total.toFixed(2)}`,
      fontWeight: "bold",
      align: "right",
    };
  }

  rows.push(totalRow);
  return rows;
}

/** GET /api/reports/excel?kind&from&to&categoryId — descarga .xlsx */
reportsRouter.get(
  "/excel",
  asyncHandler(async (req, res) => {
    const { kind, from, to, categoryId } = req.query as Record<string, string | undefined>;
    const data = await buildReport(parseKind(kind), ownerWhere(req), from, to, categoryId);
    const settings = await getSettings();

    const file = await writeXlsxFile(buildExcelRows(data, settings.currency), {
      sheet: data.title.slice(0, 31),
      columns: data.columns.map((column) => ({ width: column.width })),
      stickyRowsCount: 1,
    }).toBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.title.replaceAll(" ", "_")}.xlsx"`,
    );
    res.send(file);
  }),
);

/** GET /api/reports/pdf?kind&from&to&categoryId — descarga .pdf */
reportsRouter.get(
  "/pdf",
  asyncHandler(async (req, res) => {
    const { kind, from, to, categoryId } = req.query as Record<string, string | undefined>;
    const data = await buildReport(parseKind(kind), ownerWhere(req), from, to, categoryId);
    const settings = await getSettings();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.title.replaceAll(" ", "_")}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // Título y rango de fechas.
    doc.fontSize(18).fillColor("#7c3aed").text("Personal Control", { align: "left" });
    doc.fontSize(14).fillColor("#111").text(data.title);
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(
        `Generado: ${dayjs().format("DD/MM/YYYY HH:mm")}` +
          (from || to ? `   ·   Rango: ${from ?? "inicio"} → ${to ?? "hoy"}` : ""),
      );
    doc.moveDown(1);

    // Tabla simple: encabezado + filas con zebra striping.
    const startX = doc.page.margins.left;
    const usable = doc.page.width - startX - doc.page.margins.right;
    const totalWidthUnits = data.columns.reduce((s, c) => s + c.width, 0);
    const colWidths = data.columns.map((c) => (c.width / totalWidthUnits) * usable);
    const rowHeight = 18;

    const drawRow = (
      values: (string | number)[],
      opts: { bold?: boolean; zebra?: boolean } = {},
    ) => {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      if (opts.zebra) {
        doc.rect(startX, y - 2, usable, rowHeight).fillColor("#f4f4f5").fill();
      }
      doc.fillColor(opts.bold ? "#111" : "#333").font(opts.bold ? "Helvetica-Bold" : "Helvetica");
      let x = startX;
      values.forEach((v, idx) => {
        const w = colWidths[idx] ?? 60;
        doc.fontSize(8).text(String(v), x + 2, y, { width: w - 4, height: rowHeight, ellipsis: true });
        x += w;
      });
      doc.y = y + rowHeight;
    };

    drawRow(data.columns.map((c) => c.header), { bold: true });
    data.rows.forEach((row, i) => {
      drawRow(data.columns.map((c) => row[c.key] ?? ""), { zebra: i % 2 === 0 });
    });

    doc.moveDown(0.5);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111")
      .text(`TOTAL: ${settings.currency} ${data.total.toFixed(2)}`, startX, doc.y, {
        width: usable,
        align: "right",
      });

    doc.end();
  }),
);
