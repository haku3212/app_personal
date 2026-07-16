/**
 * Módulo Reportes — exportación a Excel (exceljs) y PDF (pdfkit)
 * de ingresos, gastos y horas trabajadas, filtrable por fechas y categoría.
 */
import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler, round2 } from "../../lib/http";
import { rangeFilter } from "../../utils/dates";
import { getSettings } from "../settings/settings.router";

type ReportKind = "incomes" | "expenses" | "worklogs";

interface ReportData {
  title: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, string | number>[];
  total: number;
}

/** Arma las filas del reporte según el tipo pedido y los filtros. */
async function buildReport(
  kind: ReportKind,
  from?: string,
  to?: string,
  categoryId?: string,
): Promise<ReportData> {
  const db = prisma();
  const date = rangeFilter(from, to);
  const fmt = (d: Date) => dayjs(d).format("DD/MM/YYYY");

  if (kind === "incomes") {
    const items = await db.income.findMany({
      where: { date, categoryId: categoryId ? Number(categoryId) : undefined },
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
      where: { date, categoryId: categoryId ? Number(categoryId) : undefined },
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

  const items = await db.workLog.findMany({ where: { date }, orderBy: { date: "asc" } });
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

/** GET /api/reports/excel?kind&from&to&categoryId — descarga .xlsx */
reportsRouter.get(
  "/excel",
  asyncHandler(async (req, res) => {
    const { kind, from, to, categoryId } = req.query as Record<string, string | undefined>;
    const data = await buildReport(parseKind(kind), from, to, categoryId);
    const settings = await getSettings();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Personal Control";
    const sheet = workbook.addWorksheet(data.title);
    sheet.columns = data.columns;

    // Encabezado con estilo.
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };

    for (const row of data.rows) sheet.addRow(row);

    // Fila de total al final.
    const totalRow = sheet.addRow({});
    const lastCol = data.columns[data.columns.length - 1];
    if (lastCol) {
      totalRow.getCell(data.columns.length - 1).value = "TOTAL";
      totalRow.getCell(data.columns.length).value = `${settings.currency} ${data.total}`;
      totalRow.font = { bold: true };
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.title.replaceAll(" ", "_")}.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }),
);

/** GET /api/reports/pdf?kind&from&to&categoryId — descarga .pdf */
reportsRouter.get(
  "/pdf",
  asyncHandler(async (req, res) => {
    const { kind, from, to, categoryId } = req.query as Record<string, string | undefined>;
    const data = await buildReport(parseKind(kind), from, to, categoryId);
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
