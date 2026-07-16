import { requireCurrentDataUserId } from "@/lib/auth";

const CASHBOX_PREFIX = "personal-control-cashbox-v1";

export interface CashBoxDay {
  date: string;
  openingCash: number;
  actualClosingCash: number | null;
  note: string;
  updatedAt: string;
}

async function key(): Promise<string> {
  return `${CASHBOX_PREFIX}:${await requireCurrentDataUserId()}`;
}

export async function listCashBoxes(): Promise<CashBoxDay[]> {
  const raw = localStorage.getItem(await key());
  if (!raw) return [];
  return JSON.parse(raw) as CashBoxDay[];
}

async function saveCashBoxes(items: CashBoxDay[]): Promise<void> {
  localStorage.setItem(await key(), JSON.stringify(items));
}

export async function getCashBox(date: string): Promise<CashBoxDay | null> {
  return (await listCashBoxes()).find((item) => item.date === date) ?? null;
}

export async function upsertCashBox(input: {
  date: string;
  openingCash: number;
  actualClosingCash: number | null;
  note: string;
}): Promise<CashBoxDay> {
  if (!input.date) throw new Error("La fecha es obligatoria");
  if (input.openingCash < 0) throw new Error("El saldo inicial no puede ser negativo");
  const items = await listCashBoxes();
  const index = items.findIndex((item) => item.date === input.date);
  const item: CashBoxDay = {
    date: input.date,
    openingCash: input.openingCash,
    actualClosingCash: input.actualClosingCash,
    note: input.note,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) items[index] = item;
  else items.push(item);
  await saveCashBoxes(items);
  return item;
}
