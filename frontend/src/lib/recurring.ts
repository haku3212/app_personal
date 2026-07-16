import { requireCurrentDataUserId } from "@/lib/auth";

const RECURRING_PREFIX = "personal-control-recurring-v1";

export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  day: number;
  categoryId: number | null;
  accountId: number | null;
  paymentMethod: string;
  active: boolean;
  lastGeneratedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function key(): Promise<string> {
  return `${RECURRING_PREFIX}:${await requireCurrentDataUserId()}`;
}

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  const raw = localStorage.getItem(await key());
  if (!raw) return [];
  return JSON.parse(raw) as RecurringExpense[];
}

async function saveRecurringExpenses(items: RecurringExpense[]): Promise<void> {
  localStorage.setItem(await key(), JSON.stringify(items));
}

export async function upsertRecurringExpense(input: {
  id?: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  day: number;
  categoryId: number | null;
  accountId: number | null;
  paymentMethod: string;
  active: boolean;
}): Promise<RecurringExpense> {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  if (!input.amount || input.amount <= 0) throw new Error("El monto debe ser mayor a 0");
  if (!input.day || input.day < 1 || input.day > 31) throw new Error("El dia debe estar entre 1 y 31");
  const now = new Date().toISOString();
  const items = await listRecurringExpenses();
  const index = items.findIndex((item) => item.id === input.id);
  const item: RecurringExpense = {
    id: index >= 0 ? items[index]?.id ?? randomId() : randomId(),
    name: input.name.trim(),
    amount: input.amount,
    frequency: input.frequency,
    day: input.day,
    categoryId: input.categoryId,
    accountId: input.accountId,
    paymentMethod: input.paymentMethod,
    active: input.active,
    lastGeneratedAt: index >= 0 ? items[index]?.lastGeneratedAt ?? null : null,
    createdAt: index >= 0 ? items[index]?.createdAt ?? now : now,
    updatedAt: now,
  };
  if (index >= 0) items[index] = item;
  else items.push(item);
  await saveRecurringExpenses(items);
  return item;
}

export async function markRecurringGenerated(id: string, date: string): Promise<void> {
  await saveRecurringExpenses(
    (await listRecurringExpenses()).map((item) =>
      item.id === id ? { ...item, lastGeneratedAt: date, updatedAt: new Date().toISOString() } : item,
    ),
  );
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  await saveRecurringExpenses((await listRecurringExpenses()).filter((item) => item.id !== id));
}
