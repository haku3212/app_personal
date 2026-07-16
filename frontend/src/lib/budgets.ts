import { requireCurrentDataUserId } from "@/lib/auth";

const BUDGET_PREFIX = "personal-control-budgets-v1";

export type BudgetPeriod = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface Budget {
  id: string;
  categoryId: number;
  period: BudgetPeriod;
  limit: number;
  createdAt: string;
  updatedAt: string;
}

type StoredBudget = Budget | (Omit<Budget, "period" | "limit"> & { monthlyLimit: number; period?: BudgetPeriod });

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function key(): Promise<string> {
  return `${BUDGET_PREFIX}:${await requireCurrentDataUserId()}`;
}

export async function listBudgets(): Promise<Budget[]> {
  const storeKey = await key();
  const raw = localStorage.getItem(storeKey);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as StoredBudget[];
  const migrated = parsed.map((budget) => {
    const maybeOld = budget as StoredBudget & { monthlyLimit?: number };
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      period: budget.period ?? "MONTHLY",
      limit: "limit" in budget ? budget.limit : maybeOld.monthlyLimit ?? 0,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  });
  if (parsed.some((budget) => !("limit" in budget) || !budget.period)) {
    localStorage.setItem(storeKey, JSON.stringify(migrated));
  }
  return migrated;
}

async function saveBudgets(budgets: Budget[]): Promise<void> {
  localStorage.setItem(await key(), JSON.stringify(budgets));
}

export async function upsertBudget(input: {
  id?: string;
  categoryId: number;
  period: BudgetPeriod;
  limit: number;
}): Promise<Budget> {
  if (!input.categoryId) throw new Error("Selecciona una categoria");
  if (!input.limit || input.limit <= 0) throw new Error("El presupuesto debe ser mayor a 0");
  const now = new Date().toISOString();
  const budgets = await listBudgets();
  const existingIndex = budgets.findIndex(
    (budget) =>
      budget.id === input.id || (budget.categoryId === input.categoryId && budget.period === input.period),
  );
  const budget: Budget = {
    id: existingIndex >= 0 ? budgets[existingIndex]?.id ?? randomId() : randomId(),
    categoryId: input.categoryId,
    period: input.period,
    limit: input.limit,
    createdAt: existingIndex >= 0 ? budgets[existingIndex]?.createdAt ?? now : now,
    updatedAt: now,
  };
  if (existingIndex >= 0) budgets[existingIndex] = budget;
  else budgets.push(budget);
  await saveBudgets(budgets);
  return budget;
}

export async function deleteBudget(id: string): Promise<void> {
  await saveBudgets((await listBudgets()).filter((budget) => budget.id !== id));
}
