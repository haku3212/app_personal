import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface BankMovement {
  id: string;
  date: string;
  time: string;
  channel: string;
  transactionId: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  kind: "income" | "expense";
  amount: number;
  suggestedCategory: string | null;
  confidence: "high" | "medium" | "low";
  selected: boolean;
  categoryId: string;
  accountId: string;
}

function normalizeAmount(value: string): number {
  const clean = value.replace(/[,+]/g, "").trim();
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function dateIso(value: string): string {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classify(description: string, kind: BankMovement["kind"]): Pick<BankMovement, "suggestedCategory" | "confidence"> {
  const text = normalizeText(description);
  if (kind === "income") {
    if (text.includes("transferencia") || text.includes("transf")) return { suggestedCategory: "Ventas", confidence: "medium" };
    if (text.includes("salario") || text.includes("sueldo")) return { suggestedCategory: "Salario", confidence: "high" };
    return { suggestedCategory: "Otros", confidence: "low" };
  }
  if (text.includes("delivery") || text.includes("restaurant") || text.includes("comida") || text.includes("tati") || text.includes("vecommuters")) {
    return { suggestedCategory: "Comida", confidence: "medium" };
  }
  if (text.includes("ypfb") || text.includes("taxi") || text.includes("transporte") || text.includes("uber")) {
    return { suggestedCategory: "Transporte", confidence: "high" };
  }
  if (text.includes("netflix") || text.includes("spotify") || text.includes("internet") || text.includes("tigo")) {
    return { suggestedCategory: "Servicios", confidence: "high" };
  }
  if (text.includes("comision") || text.includes("mantenimiento") || text.includes("banco")) {
    return { suggestedCategory: "Otros", confidence: "low" };
  }
  return { suggestedCategory: "Otros", confidence: "low" };
}

function parseLines(lines: string[]): BankMovement[] {
  const movements: BankMovement[] = [];
  let current: (Omit<BankMovement, "id" | "description" | "kind" | "amount" | "suggestedCategory" | "confidence" | "selected" | "categoryId" | "accountId"> & { descriptionParts: string[] }) | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const description = current.descriptionParts.join(" · ").replace(/\s+/g, " ").trim();
    const kind: BankMovement["kind"] = current.credit > 0 ? "income" : "expense";
    const amount = kind === "income" ? current.credit : current.debit;
    const classification = classify(description, kind);
    movements.push({
      id: `${current.date}-${current.time}-${current.transactionId}-${amount}`,
      date: current.date,
      time: current.time,
      channel: current.channel,
      transactionId: current.transactionId,
      description,
      debit: current.debit,
      credit: current.credit,
      balance: current.balance,
      kind,
      amount,
      ...classification,
      selected: true,
      categoryId: "",
      accountId: "",
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || line.startsWith("FECHA HORA") || line.startsWith("SALDO ACTUAL") || line.startsWith("CANTIDAD ") || line.startsWith("Pagina ") || line.startsWith("Página ")) continue;
    const match = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\d+)\s+(.+?)\s+([+-]?\d+(?:[.,]\d{2})?)\s+([+-]?\d+(?:[.,]\d{2})?)\s+([+-]?\d+(?:[.,]\d{2})?)$/.exec(line);
    if (match) {
      const [, rawDate, time, channel, transactionId, firstDescription, rawDebit, rawCredit, rawBalance] = match as RegExpExecArray & [string, string, string, string, string, string, string, string, string];
      pushCurrent();
      current = {
        date: dateIso(rawDate),
        time,
        channel,
        transactionId,
        descriptionParts: [firstDescription],
        debit: normalizeAmount(rawDebit),
        credit: normalizeAmount(rawCredit),
        balance: normalizeAmount(rawBalance),
      };
    } else if (current && !line.startsWith("EXTRACTO ") && !line.startsWith("NRO. ") && !line.startsWith("CLIENTE ") && !line.startsWith("Fecha y Hora") && !line.startsWith("DEL ") && !line.startsWith("SALDO ANTERIOR")) {
      current.descriptionParts.push(line);
    }
  }
  pushCurrent();
  return movements;
}

export async function parseBankPdf(file: File): Promise<BankMovement[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: { y: number; x: number; text: string }[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      lines.push({ y: Math.round(item.transform[5]), x: item.transform[4], text: item.str.trim() });
    }
  }

  const grouped = new Map<number, { x: number; text: string }[]>();
  for (const item of lines) {
    grouped.set(item.y, [...(grouped.get(item.y) ?? []), { x: item.x, text: item.text }]);
  }

  const textLines = [...grouped.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "));

  return parseLines(textLines);
}
