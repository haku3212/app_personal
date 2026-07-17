import dayjs from "dayjs";
import "dayjs/locale/es";
import type {
  Account,
  AppNotification,
  BackupFile,
  CalendarDay,
  Category,
  DashboardData,
  Expense,
  ExpenseSummary,
  GoalContribution,
  Income,
  Loan,
  LoanPayment,
  LoanSummary,
  Note,
  NoteItem,
  SavingGoal,
  SearchResult,
  Setting,
  StatsData,
  WorkLog,
  WorkSummary,
} from "@/types";
import { ApiClientError } from "@/lib/apiError";
import { requireCurrentDataUserId } from "@/lib/auth";

dayjs.locale("es");

const STORE_PREFIX = "personal-control-mobile-db-v1";
const BACKUP_PREFIX = "personal-control-mobile-backup-";

type EntityName =
  | "accounts"
  | "categories"
  | "incomes"
  | "expenses"
  | "worklogs"
  | "loans"
  | "loanPayments"
  | "goals"
  | "goalContributions"
  | "notes"
  | "noteItems";

interface MobileDb {
  settings: Setting;
  nextIds: Record<EntityName, number>;
  accounts: Omit<Account, "balance">[];
  categories: Category[];
  incomes: Omit<Income, "category" | "account">[];
  expenses: Omit<Expense, "category" | "account">[];
  worklogs: WorkLog[];
  loans: Omit<
    Loan,
    | "payments"
    | "paid"
    | "principalPaid"
    | "interestPaid"
    | "interestExpected"
    | "remaining"
    | "interestRemaining"
    | "totalRemaining"
    | "status"
  >[];
  loanPayments: LoanPayment[];
  goals: Omit<SavingGoal, "contributions" | "currentAmount" | "progress" | "achieved">[];
  goalContributions: GoalContribution[];
  notes: Omit<Note, "items">[];
  noteItems: NoteItem[];
}

interface BackupEntry {
  name: string;
  createdAt: string;
  db: MobileDb;
}

const DEFAULT_SETTINGS: Setting = {
  id: 1,
  currency: "Bs.",
  theme: "dark",
  accentColor: "#7c3aed",
  autoBackup: true,
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: "Salario", kind: "INCOME", color: "#10b981", icon: null },
  { id: 2, name: "Ventas", kind: "INCOME", color: "#22c55e", icon: null },
  { id: 3, name: "Comida", kind: "EXPENSE", color: "#f97316", icon: null },
  { id: 4, name: "Transporte", kind: "EXPENSE", color: "#06b6d4", icon: null },
  { id: 5, name: "Servicios", kind: "EXPENSE", color: "#8b5cf6", icon: null },
  { id: 6, name: "Otros", kind: "EXPENSE", color: "#64748b", icon: null },
];

const DEFAULT_ACCOUNTS: Omit<Account, "balance">[] = [
  { id: 1, name: "Efectivo", type: "CASH", initialBalance: 0, icon: null, archived: false },
  { id: 2, name: "Banco", type: "BANK", initialBalance: 0, icon: null, archived: false },
];

function createDb(): MobileDb {
  return {
    settings: DEFAULT_SETTINGS,
    nextIds: {
      accounts: 3,
      categories: 7,
      incomes: 1,
      expenses: 1,
      worklogs: 1,
      loans: 1,
      loanPayments: 1,
      goals: 1,
      goalContributions: 1,
      notes: 1,
      noteItems: 1,
    },
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    incomes: [],
    expenses: [],
    worklogs: [],
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
    notes: [],
    noteItems: [],
  };
}

export function isMobileApiEnabled(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || import.meta.env.VITE_FORCE_MOBILE_API === "true";
}

async function loadDb(): Promise<MobileDb> {
  const userId = await requireCurrentDataUserId();
  const value = localStorage.getItem(`${STORE_PREFIX}:${userId}`);
  if (!value) return createDb();
  return JSON.parse(value) as MobileDb;
}

async function saveDb(db: MobileDb): Promise<void> {
  const userId = await requireCurrentDataUserId();
  localStorage.setItem(`${STORE_PREFIX}:${userId}`, JSON.stringify(db));
}

async function withDb<T>(fn: (db: MobileDb) => T | Promise<T>, write = false): Promise<T> {
  const db = await loadDb();
  const result = await fn(db);
  if (write) await saveDb(db);
  return result;
}

function nextId(db: MobileDb, entity: EntityName): number {
  const id = db.nextIds[entity] ?? 1;
  db.nextIds[entity] = id + 1;
  return id;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function todayInput(): string {
  return dayjs().format("YYYY-MM-DD");
}

function inRange(date: string, from?: string | null, to?: string | null): boolean {
  const d = dayjs(date);
  return (!from || !d.isBefore(dayjs(from), "day")) && (!to || !d.isAfter(dayjs(to), "day"));
}

function currentMonth(date: string): boolean {
  return dayjs(date).isSame(dayjs(), "month");
}

function currentYear(date: string): boolean {
  return dayjs(date).isSame(dayjs(), "year");
}

function currentWeek(date: string): boolean {
  return dayjs(date).isSame(dayjs(), "week");
}

function parseUrl(path: string): { route: string; query: URLSearchParams } {
  const url = new URL(path, "mobile://local");
  return { route: url.pathname, query: url.searchParams };
}

function parseId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiClientError(400, "ID invalido");
  return id;
}

function getAccountBalance(db: MobileDb, accountId: number): number {
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  const income = db.incomes
    .filter((item) => item.accountId === accountId)
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = db.expenses
    .filter((item) => item.accountId === accountId)
    .reduce((sum, item) => sum + item.amount, 0);
  return round2(account.initialBalance + income - expense);
}

function enrichAccount(db: MobileDb, account: Omit<Account, "balance">): Account {
  return { ...account, balance: getAccountBalance(db, account.id) };
}

function enrichIncome(db: MobileDb, income: Omit<Income, "category" | "account">): Income {
  const category = db.categories.find((c) => c.id === income.categoryId) ?? null;
  const account = db.accounts.find((a) => a.id === income.accountId);
  return { ...income, category, account: account ? enrichAccount(db, account) : null };
}

function enrichExpense(db: MobileDb, expense: Omit<Expense, "category" | "account">): Expense {
  const category = db.categories.find((c) => c.id === expense.categoryId) ?? null;
  const account = db.accounts.find((a) => a.id === expense.accountId);
  return { ...expense, category, account: account ? enrichAccount(db, account) : null };
}

function enrichLoan(db: MobileDb, loan: MobileDb["loans"][number]): Loan {
  const payments = db.loanPayments
    .filter((p) => p.loanId === loan.id)
    .map((payment) => ({
      ...payment,
      principalAmount: payment.principalAmount || payment.amount,
      interestAmount: payment.interestAmount || 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const interestRate = loan.interestRate || 0;
  const principalPaid = round2(payments.reduce((sum, payment) => sum + payment.principalAmount, 0));
  const interestPaid = round2(payments.reduce((sum, payment) => sum + payment.interestAmount, 0));
  const paid = round2(principalPaid + interestPaid);
  const interestExpected = round2(loan.amount * (interestRate / 100));
  const remaining = round2(Math.max(0, loan.amount - principalPaid));
  const interestRemaining = round2(Math.max(0, interestExpected - interestPaid));
  const totalRemaining = round2(remaining + interestRemaining);
  const status: Loan["status"] = totalRemaining <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
  return { ...loan, interestRate, payments, paid, principalPaid, interestPaid, interestExpected, remaining, interestRemaining, totalRemaining, status };
}

function enrichGoal(db: MobileDb, goal: MobileDb["goals"][number]): SavingGoal {
  const contributions = db.goalContributions
    .filter((c) => c.goalId === goal.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentAmount = round2(contributions.reduce((sum, c) => sum + c.amount, 0));
  const progress = goal.targetAmount > 0 ? round2(Math.min(100, (currentAmount / goal.targetAmount) * 100)) : 0;
  return { ...goal, contributions, currentAmount, progress, achieved: currentAmount >= goal.targetAmount };
}

function enrichNote(db: MobileDb, note: MobileDb["notes"][number]): Note {
  const items = db.noteItems.filter((item) => item.noteId === note.id).sort((a, b) => a.order - b.order);
  return { ...note, items };
}

function computeWork(input: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyRate?: number | null;
  fixedPay?: number | null;
}) {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
      throw new ApiClientError(400, `Hora invalida: ${time}`);
    }
    return h * 60 + m;
  };
  const start = toMinutes(input.startTime);
  let end = toMinutes(input.endTime);
  if (end <= start) end += 24 * 60;
  const worked = end - start - input.breakMinutes;
  if (worked <= 0) throw new ApiClientError(400, "La jornada resulta en 0 horas o menos");
  const hours = round2(worked / 60);
  return {
    hours,
    overtime: round2(Math.max(0, hours - 8)),
    expectedPay: round2(hours * (input.hourlyRate ?? 0) + (input.fixedPay ?? 0)),
  };
}

function listIncomes(db: MobileDb, query: URLSearchParams) {
  const from = query.get("from");
  const to = query.get("to");
  const categoryId = query.get("categoryId");
  const items = db.incomes
    .filter((item) => inRange(item.date, from, to))
    .filter((item) => !categoryId || item.categoryId === Number(categoryId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((item) => enrichIncome(db, item));
  return { items, total: round2(items.reduce((sum, item) => sum + item.amount, 0)) };
}

function listExpenses(db: MobileDb, query: URLSearchParams) {
  const from = query.get("from");
  const to = query.get("to");
  const categoryId = query.get("categoryId");
  const accountId = query.get("accountId");
  const paymentMethod = query.get("paymentMethod");
  const min = query.get("min");
  const max = query.get("max");
  const items = db.expenses
    .filter((item) => inRange(item.date, from, to))
    .filter((item) => !categoryId || item.categoryId === Number(categoryId))
    .filter((item) => !accountId || item.accountId === Number(accountId))
    .filter((item) => !paymentMethod || item.paymentMethod === paymentMethod)
    .filter((item) => !min || item.amount >= Number(min))
    .filter((item) => !max || item.amount <= Number(max))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((item) => enrichExpense(db, item));
  return { items, total: round2(items.reduce((sum, item) => sum + item.amount, 0)) };
}

function listWorklogs(db: MobileDb, query: URLSearchParams) {
  const from = query.get("from");
  const to = query.get("to");
  const items = db.worklogs
    .filter((item) => inRange(item.date, from, to))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    items,
    totalHours: round2(items.reduce((sum, item) => sum + item.hours, 0)),
    totalPay: round2(items.reduce((sum, item) => sum + item.expectedPay, 0)),
  };
}

function expenseSummary(db: MobileDb): ExpenseSummary {
  return {
    today: round2(db.expenses.filter((e) => dayjs(e.date).isSame(dayjs(), "day")).reduce((sum, e) => sum + e.amount, 0)),
    week: round2(db.expenses.filter((e) => currentWeek(e.date)).reduce((sum, e) => sum + e.amount, 0)),
    month: round2(db.expenses.filter((e) => currentMonth(e.date)).reduce((sum, e) => sum + e.amount, 0)),
    year: round2(db.expenses.filter((e) => currentYear(e.date)).reduce((sum, e) => sum + e.amount, 0)),
  };
}

function workSummary(db: MobileDb): WorkSummary {
  const monthLogs = db.worklogs.filter((w) => currentMonth(w.date));
  const byMonth = new Map<string, { month: string; hours: number; pay: number }>();
  for (const w of db.worklogs) {
    const key = dayjs(w.date).format("YYYY-MM");
    const entry = byMonth.get(key) ?? { month: dayjs(w.date).format("MMM YYYY"), hours: 0, pay: 0 };
    entry.hours = round2(entry.hours + w.hours);
    entry.pay = round2(entry.pay + w.expectedPay);
    byMonth.set(key, entry);
  }
  const workedDays = new Set(monthLogs.map((w) => w.date)).size || 1;
  return {
    weekHours: round2(db.worklogs.filter((w) => currentWeek(w.date)).reduce((sum, w) => sum + w.hours, 0)),
    monthHours: round2(monthLogs.reduce((sum, w) => sum + w.hours, 0)),
    monthPay: round2(monthLogs.reduce((sum, w) => sum + w.expectedPay, 0)),
    monthOvertime: round2(monthLogs.reduce((sum, w) => sum + w.overtime, 0)),
    avgHoursPerDay: round2(monthLogs.reduce((sum, w) => sum + w.hours, 0) / workedDays),
    monthly: Array.from(byMonth.values()).slice(-12),
  };
}

function loanSummary(db: MobileDb): LoanSummary {
  const loans = db.loans.map((loan) => enrichLoan(db, loan));
  const active = loans.filter((loan) => loan.status !== "PAID");
  return {
    owedToMe: round2(active.filter((loan) => loan.type === "LENT").reduce((sum, loan) => sum + loan.totalRemaining, 0)),
    iOwe: round2(active.filter((loan) => loan.type === "BORROWED").reduce((sum, loan) => sum + loan.totalRemaining, 0)),
    totalLoans: loans.length,
    activeLoans: active.length,
    lentTotal: round2(loans.filter((loan) => loan.type === "LENT").reduce((sum, loan) => sum + loan.amount, 0)),
  };
}

function dashboard(db: MobileDb): DashboardData {
  const incomeMonth = round2(db.incomes.filter((i) => currentMonth(i.date)).reduce((sum, i) => sum + i.amount, 0));
  const expenseMonth = round2(db.expenses.filter((e) => currentMonth(e.date)).reduce((sum, e) => sum + e.amount, 0));
  const work = workSummary(db);
  const loans = loanSummary(db);
  const goals = db.goals.map((goal) => enrichGoal(db, goal));
  const series = Array.from({ length: 6 }, (_, idx) => {
    const date = dayjs().subtract(5 - idx, "month");
    const key = date.format("YYYY-MM");
    const income = round2(db.incomes.filter((i) => dayjs(i.date).format("YYYY-MM") === key).reduce((sum, i) => sum + i.amount, 0));
    const expense = round2(db.expenses.filter((e) => dayjs(e.date).format("YYYY-MM") === key).reduce((sum, e) => sum + e.amount, 0));
    const hours = round2(db.worklogs.filter((w) => dayjs(w.date).format("YYYY-MM") === key).reduce((sum, w) => sum + w.hours, 0));
    return {
      month: date.format("MMM YYYY"),
      income,
      expense,
      balance: round2(income - expense),
      hours,
      savings: round2(goals.reduce((sum, goal) => sum + goal.currentAmount, 0)),
    };
  });
  const expensesByCategory = db.categories
    .filter((category) => category.kind === "EXPENSE")
    .map((category) => ({
      name: category.name,
      color: category.color,
      value: round2(db.expenses.filter((e) => e.categoryId === category.id && currentMonth(e.date)).reduce((sum, e) => sum + e.amount, 0)),
    }))
    .filter((item) => item.value > 0);
  return {
    cards: {
      available: round2(db.accounts.reduce((sum, account) => sum + getAccountBalance(db, account.id), 0)),
      incomeMonth,
      expenseMonth,
      balanceMonth: round2(incomeMonth - expenseMonth),
      hoursMonth: work.monthHours,
      expectedPayMonth: work.monthPay,
      totalSavings: round2(goals.reduce((sum, goal) => sum + goal.currentAmount, 0)),
      owedToMe: loans.owedToMe,
      iOwe: loans.iOwe,
      totalLoans: loans.totalLoans,
    },
    series,
    expensesByCategory,
  };
}

function stats(db: MobileDb): StatsData {
  const expenses = db.expenses.map((expense) => enrichExpense(db, expense));
  const incomes = db.incomes.map((income) => enrichIncome(db, income));
  const byMonth = new Map<string, number>();
  const incomeByMonth = new Map<string, number>();
  for (const e of expenses) byMonth.set(dayjs(e.date).format("YYYY-MM"), round2((byMonth.get(dayjs(e.date).format("YYYY-MM")) ?? 0) + e.amount));
  for (const i of incomes) incomeByMonth.set(dayjs(i.date).format("YYYY-MM"), round2((incomeByMonth.get(dayjs(i.date).format("YYYY-MM")) ?? 0) + i.amount));
  const biggestExpense = expenses.sort((a, b) => b.amount - a.amount)[0] ?? null;
  const biggestIncome = incomes.sort((a, b) => b.amount - a.amount)[0] ?? null;
  const hoursByMonth = workSummary(db).monthly.map(({ month, hours }) => ({ month, hours }));
  const totalHours = round2(db.worklogs.reduce((sum, w) => sum + w.hours, 0));
  const totalPay = round2(db.worklogs.reduce((sum, w) => sum + w.expectedPay, 0));
  return {
    spendPerDay: round2(expenseSummary(db).month / Math.max(1, dayjs().date())),
    spendPerMonth: round2(Array.from(byMonth.values()).reduce((sum, v) => sum + v, 0) / Math.max(1, byMonth.size)),
    incomePerMonth: round2(Array.from(incomeByMonth.values()).reduce((sum, v) => sum + v, 0) / Math.max(1, incomeByMonth.size)),
    totalSaved: dashboard(db).cards.totalSavings,
    mostExpensiveMonth: Array.from(byMonth.entries()).sort((a, b) => b[1] - a[1]).map(([month, amount]) => ({ month, amount }))[0] ?? null,
    bestIncomeMonth: Array.from(incomeByMonth.entries()).sort((a, b) => b[1] - a[1]).map(([month, amount]) => ({ month, amount }))[0] ?? null,
    biggestExpense: biggestExpense ? { date: biggestExpense.date, amount: biggestExpense.amount, description: biggestExpense.description } : null,
    biggestIncome: biggestIncome ? { date: biggestIncome.date, amount: biggestIncome.amount, source: biggestIncome.source } : null,
    totalHours,
    avgHourlyPay: totalHours > 0 ? round2(totalPay / totalHours) : 0,
    hoursByMonth,
  };
}

function calendar(db: MobileDb, month: string): { month: string; days: CalendarDay[] } {
  const start = dayjs(month || todayInput()).startOf("month");
  const days = new Map<string, CalendarDay>();
  for (let i = 0; i < start.daysInMonth(); i += 1) {
    const date = start.add(i, "day").format("YYYY-MM-DD");
    days.set(date, { date, income: 0, expense: 0, hours: 0, loans: [] });
  }
  for (const income of db.incomes) {
    const day = days.get(income.date);
    if (day) day.income = round2(day.income + income.amount);
  }
  for (const expense of db.expenses) {
    const day = days.get(expense.date);
    if (day) day.expense = round2(day.expense + expense.amount);
  }
  for (const worklog of db.worklogs) {
    const day = days.get(worklog.date);
    if (day) day.hours = round2(day.hours + worklog.hours);
  }
  for (const loan of db.loans) {
    const day = days.get(loan.dueDate ?? loan.date);
    if (day) day.loans.push({ person: loan.person, type: loan.type, amount: loan.amount });
  }
  return { month: start.format("YYYY-MM"), days: Array.from(days.values()) };
}

function notifications(db: MobileDb): AppNotification[] {
  const notes: AppNotification[] = [];
  for (const loan of db.loans.map((item) => enrichLoan(db, item))) {
    if (loan.status !== "PAID" && loan.dueDate && dayjs(loan.dueDate).diff(dayjs(), "day") <= 3) {
      notes.push({
        id: `loan-${loan.id}`,
        level: dayjs(loan.dueDate).isBefore(dayjs(), "day") ? "danger" : "warning",
        title: "Prestamo por vencer",
        detail: `${loan.person}: ${loan.remaining}`,
      });
    }
  }
  for (const goal of db.goals.map((item) => enrichGoal(db, item))) {
    if (!goal.achieved && goal.progress >= 80) {
      notes.push({ id: `goal-${goal.id}`, level: "info", title: "Meta casi lograda", detail: goal.name });
    }
  }
  return notes;
}

function search(db: MobileDb, q: string): SearchResult[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const has = (...values: Array<string | null | undefined>) => values.some((value) => value?.toLowerCase().includes(term));
  return [
    ...db.incomes.filter((i) => has(i.source, i.description, i.notes)).map((i) => ({ type: "income" as const, id: i.id, title: i.source, subtitle: i.description ?? "", amount: i.amount, date: i.date })),
    ...db.expenses.filter((e) => has(e.description, e.notes)).map((e) => ({ type: "expense" as const, id: e.id, title: e.description ?? "Gasto", subtitle: e.paymentMethod, amount: e.amount, date: e.date })),
    ...db.worklogs.filter((w) => has(w.company, w.project, w.description)).map((w) => ({ type: "worklog" as const, id: w.id, title: w.company ?? "Horas", subtitle: w.project ?? "", amount: w.expectedPay, date: w.date })),
    ...db.loans.filter((l) => has(l.person, l.notes)).map((l) => ({ type: "loan" as const, id: l.id, title: l.person, subtitle: l.type, amount: l.amount, date: l.date })),
    ...db.notes.filter((n) => has(n.title, n.content)).map((n) => ({ type: "note" as const, id: n.id, title: n.title, subtitle: n.content, amount: null, date: n.updatedAt })),
    ...db.goals.filter((g) => has(g.name)).map((g) => ({ type: "goal" as const, id: g.id, title: g.name, subtitle: "Meta de ahorro", amount: g.targetAmount, date: g.targetDate })),
  ].slice(0, 25);
}

async function listBackups(): Promise<BackupFile[]> {
  const userId = await requireCurrentDataUserId();
  const prefix = `${BACKUP_PREFIX}${userId}:`;
  const backups = Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => {
      const value = localStorage.getItem(key);
      const entry = JSON.parse(value ?? "{}") as BackupEntry;
      return {
        name: entry.name,
        createdAt: entry.createdAt,
        size: value?.length ?? 0,
      };
    });
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function makeBackupName(): string {
  return `mobile-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
}

async function handleGet<T>(path: string): Promise<T> {
  const { route, query } = parseUrl(path);
  if (route === "/backups") return (await listBackups()) as T;
  return withDb((db) => {
    if (route === "/settings") return db.settings;
    if (route === "/categories") {
      const kind = query.get("kind");
      return db.categories.filter((category) => !kind || category.kind === kind);
    }
    if (route === "/accounts") return db.accounts.map((account) => enrichAccount(db, account));
    if (route === "/incomes") return listIncomes(db, query);
    if (route === "/expenses") return listExpenses(db, query);
    if (route === "/expenses/summary") return expenseSummary(db);
    if (route === "/worklogs") return listWorklogs(db, query);
    if (route === "/worklogs/summary") return workSummary(db);
    if (route === "/loans") return db.loans.map((loan) => enrichLoan(db, loan)).filter((loan) => !query.get("status") || loan.status === query.get("status"));
    if (route === "/loans/summary") return loanSummary(db);
    if (route === "/goals") return db.goals.map((goal) => enrichGoal(db, goal));
    if (route === "/notes") return db.notes.map((note) => enrichNote(db, note)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    if (route === "/dashboard") return dashboard(db);
    if (route === "/stats") return stats(db);
    if (route === "/calendar") return calendar(db, query.get("month") ?? todayInput());
    if (route === "/notifications") return notifications(db);
    if (route === "/search") return search(db, query.get("q") ?? "");
    throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
  }) as Promise<T>;
}

async function handlePost<T>(path: string, body?: unknown): Promise<T> {
  const { route } = parseUrl(path);
  if (route === "/backups") {
    const userId = await requireCurrentDataUserId();
    const db = await loadDb();
    const entry: BackupEntry = { name: makeBackupName(), createdAt: new Date().toISOString(), db };
    localStorage.setItem(`${BACKUP_PREFIX}${userId}:${entry.name}`, JSON.stringify(entry));
    return { name: entry.name } as T;
  }
  const restoreMatch = /^\/backups\/(.+)\/restore$/.exec(route);
  if (restoreMatch?.[1]) {
    const userId = await requireCurrentDataUserId();
    const name = decodeURIComponent(restoreMatch[1]);
    const value = localStorage.getItem(`${BACKUP_PREFIX}${userId}:${name}`);
    if (!value) throw new ApiClientError(404, "Respaldo no encontrado");
    const entry = JSON.parse(value) as BackupEntry;
    await saveDb(entry.db);
    return { ok: true } as T;
  }
  return withDb((db) => {
    const payload = (body ?? {}) as Record<string, unknown>;
    if (route === "/categories") {
      const item: Category = { id: nextId(db, "categories"), name: String(payload.name ?? ""), kind: payload.kind as Category["kind"], color: String(payload.color ?? "#8b5cf6"), icon: (payload.icon as string | null) ?? null };
      db.categories.push(item);
      return item;
    }
    if (route === "/accounts") {
      const item: Omit<Account, "balance"> = { id: nextId(db, "accounts"), name: String(payload.name ?? ""), type: payload.type as Account["type"], initialBalance: Number(payload.initialBalance ?? 0), icon: (payload.icon as string | null) ?? null, archived: false };
      db.accounts.push(item);
      return enrichAccount(db, item);
    }
    if (route === "/incomes") {
      const item: Omit<Income, "category" | "account"> = { id: nextId(db, "incomes"), date: String(payload.date ?? todayInput()), amount: Number(payload.amount ?? 0), source: String(payload.source ?? ""), description: (payload.description as string | null) ?? null, paymentMethod: String(payload.paymentMethod ?? "Efectivo"), notes: (payload.notes as string | null) ?? null, categoryId: payload.categoryId ? Number(payload.categoryId) : null, accountId: payload.accountId ? Number(payload.accountId) : null };
      db.incomes.push(item);
      return enrichIncome(db, item);
    }
    if (route === "/expenses") {
      const item: Omit<Expense, "category" | "account"> = { id: nextId(db, "expenses"), date: String(payload.date ?? todayInput()), amount: Number(payload.amount ?? 0), description: (payload.description as string | null) ?? null, paymentMethod: String(payload.paymentMethod ?? "Efectivo"), notes: (payload.notes as string | null) ?? null, categoryId: payload.categoryId ? Number(payload.categoryId) : null, accountId: payload.accountId ? Number(payload.accountId) : null };
      db.expenses.push(item);
      return enrichExpense(db, item);
    }
    if (route === "/worklogs") {
      const computed = computeWork({ startTime: String(payload.startTime), endTime: String(payload.endTime), breakMinutes: Number(payload.breakMinutes ?? 0), hourlyRate: payload.hourlyRate == null ? null : Number(payload.hourlyRate), fixedPay: payload.fixedPay == null ? null : Number(payload.fixedPay) });
      const item: WorkLog = { id: nextId(db, "worklogs"), date: String(payload.date ?? todayInput()), startTime: String(payload.startTime), endTime: String(payload.endTime), breakMinutes: Number(payload.breakMinutes ?? 0), place: (payload.place as string | null) ?? null, company: (payload.company as string | null) ?? null, project: (payload.project as string | null) ?? null, description: (payload.description as string | null) ?? null, hourlyRate: payload.hourlyRate == null ? null : Number(payload.hourlyRate), fixedPay: payload.fixedPay == null ? null : Number(payload.fixedPay), ...computed };
      db.worklogs.push(item);
      return item;
    }
    if (route === "/loans") {
      const item: MobileDb["loans"][number] = { id: nextId(db, "loans"), type: payload.type as Loan["type"], person: String(payload.person ?? ""), amount: Number(payload.amount ?? 0), interestRate: Number(payload.interestRate ?? 0), date: String(payload.date ?? todayInput()), dueDate: (payload.dueDate as string | null) ?? null, notes: (payload.notes as string | null) ?? null };
      db.loans.push(item);
      return enrichLoan(db, item);
    }
    const loanPaymentMatch = /^\/loans\/(\d+)\/payments$/.exec(route);
    if (loanPaymentMatch?.[1]) {
      const loanId = parseId(loanPaymentMatch[1]);
      const principalAmount = Number(payload.amount ?? payload.principalAmount ?? 0);
      const interestAmount = Number(payload.interestAmount ?? 0);
      const item: LoanPayment = { id: nextId(db, "loanPayments"), loanId, date: String(payload.date ?? todayInput()), amount: round2(principalAmount + interestAmount), principalAmount, interestAmount, note: (payload.note as string | null) ?? null };
      db.loanPayments.push(item);
      return enrichLoan(db, db.loans.find((loan) => loan.id === loanId) as MobileDb["loans"][number]);
    }
    if (route === "/goals") {
      const item: MobileDb["goals"][number] = { id: nextId(db, "goals"), name: String(payload.name ?? ""), targetAmount: Number(payload.targetAmount ?? 0), targetDate: (payload.targetDate as string | null) ?? null, color: String(payload.color ?? "#8b5cf6"), icon: (payload.icon as string | null) ?? null };
      db.goals.push(item);
      return enrichGoal(db, item);
    }
    const goalContributionMatch = /^\/goals\/(\d+)\/contributions$/.exec(route);
    if (goalContributionMatch?.[1]) {
      const goalId = parseId(goalContributionMatch[1]);
      const item: GoalContribution = { id: nextId(db, "goalContributions"), goalId, date: String(payload.date ?? todayInput()), amount: Number(payload.amount ?? 0), note: (payload.note as string | null) ?? null };
      db.goalContributions.push(item);
      return enrichGoal(db, db.goals.find((goal) => goal.id === goalId) as MobileDb["goals"][number]);
    }
    if (route === "/notes") {
      const now = new Date().toISOString();
      const note: Omit<Note, "items"> = { id: nextId(db, "notes"), title: String(payload.title ?? ""), content: String(payload.content ?? ""), pinned: Boolean(payload.pinned ?? false), updatedAt: now };
      db.notes.push(note);
      const items = Array.isArray(payload.items) ? (payload.items as string[]) : [];
      items.filter(Boolean).forEach((text, order) => db.noteItems.push({ id: nextId(db, "noteItems"), noteId: note.id, text, done: false, order }));
      return enrichNote(db, note);
    }
    throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
  }, true) as Promise<T>;
}

async function handlePut<T>(path: string, body: unknown): Promise<T> {
  const { route } = parseUrl(path);
  return withDb((db) => {
    const payload = (body ?? {}) as Record<string, unknown>;
    if (route === "/settings") {
      db.settings = { ...db.settings, ...payload };
      return db.settings;
    }
    const match = /^\/([^/]+)\/(\d+)$/.exec(route);
    if (!match?.[1] || !match[2]) throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
    const [, entity, rawId] = match;
    const id = parseId(rawId);
    if (entity === "categories") {
      const item = db.categories.find((c) => c.id === id);
      if (!item) throw new ApiClientError(404, "Categoria no encontrada");
      Object.assign(item, payload);
      return item;
    }
    if (entity === "accounts") {
      const item = db.accounts.find((a) => a.id === id);
      if (!item) throw new ApiClientError(404, "Cuenta no encontrada");
      Object.assign(item, payload);
      return enrichAccount(db, item);
    }
    if (entity === "incomes") {
      const item = db.incomes.find((i) => i.id === id);
      if (!item) throw new ApiClientError(404, "Ingreso no encontrado");
      Object.assign(item, payload);
      return enrichIncome(db, item);
    }
    if (entity === "expenses") {
      const item = db.expenses.find((e) => e.id === id);
      if (!item) throw new ApiClientError(404, "Gasto no encontrado");
      Object.assign(item, payload);
      return enrichExpense(db, item);
    }
    if (entity === "worklogs") {
      const item = db.worklogs.find((w) => w.id === id);
      if (!item) throw new ApiClientError(404, "Jornada no encontrada");
      Object.assign(item, payload, computeWork({ startTime: String(payload.startTime ?? item.startTime), endTime: String(payload.endTime ?? item.endTime), breakMinutes: Number(payload.breakMinutes ?? item.breakMinutes), hourlyRate: payload.hourlyRate == null ? item.hourlyRate : Number(payload.hourlyRate), fixedPay: payload.fixedPay == null ? item.fixedPay : Number(payload.fixedPay) }));
      return item;
    }
    if (entity === "loans") {
      const item = db.loans.find((l) => l.id === id);
      if (!item) throw new ApiClientError(404, "Prestamo no encontrado");
      Object.assign(item, payload);
      return enrichLoan(db, item);
    }
    if (entity === "goals") {
      const item = db.goals.find((g) => g.id === id);
      if (!item) throw new ApiClientError(404, "Meta no encontrada");
      Object.assign(item, payload);
      return enrichGoal(db, item);
    }
    if (entity === "notes") {
      const item = db.notes.find((n) => n.id === id);
      if (!item) throw new ApiClientError(404, "Nota no encontrada");
      Object.assign(item, payload, { updatedAt: new Date().toISOString() });
      db.noteItems = db.noteItems.filter((noteItem) => noteItem.noteId !== id);
      const items = Array.isArray(payload.items) ? (payload.items as string[]) : [];
      items.filter(Boolean).forEach((text, order) => db.noteItems.push({ id: nextId(db, "noteItems"), noteId: id, text, done: false, order }));
      return enrichNote(db, item);
    }
    throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
  }, true) as Promise<T>;
}

async function handlePatch<T>(path: string, _body?: unknown): Promise<T> {
  const { route } = parseUrl(path);
  return withDb((db) => {
    const match = /^\/notes\/items\/(\d+)\/toggle$/.exec(route);
    if (match?.[1]) {
      const id = parseId(match[1]);
      const item = db.noteItems.find((noteItem) => noteItem.id === id);
      if (!item) throw new ApiClientError(404, "Pendiente no encontrado");
      item.done = !item.done;
      const note = db.notes.find((n) => n.id === item.noteId);
      if (note) note.updatedAt = new Date().toISOString();
      return note ? enrichNote(db, note) : item;
    }
    throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
  }, true) as Promise<T>;
}

async function handleDelete<T>(path: string): Promise<T> {
  const { route } = parseUrl(path);
  const backupMatch = /^\/backups\/(.+)$/.exec(route);
  if (backupMatch?.[1]) {
    const userId = await requireCurrentDataUserId();
    localStorage.removeItem(`${BACKUP_PREFIX}${userId}:${decodeURIComponent(backupMatch[1])}`);
    return { ok: true } as T;
  }
  return withDb((db) => {
    const match = /^\/([^/]+)\/(\d+)$/.exec(route);
    if (!match?.[1] || !match[2]) throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
    const [, entity, rawId] = match;
    const id = parseId(rawId);
    if (entity === "categories") db.categories = db.categories.filter((item) => item.id !== id);
    else if (entity === "accounts") db.accounts = db.accounts.filter((item) => item.id !== id);
    else if (entity === "incomes") db.incomes = db.incomes.filter((item) => item.id !== id);
    else if (entity === "expenses") db.expenses = db.expenses.filter((item) => item.id !== id);
    else if (entity === "worklogs") db.worklogs = db.worklogs.filter((item) => item.id !== id);
    else if (entity === "loans") {
      db.loans = db.loans.filter((item) => item.id !== id);
      db.loanPayments = db.loanPayments.filter((item) => item.loanId !== id);
    } else if (entity === "goals") {
      db.goals = db.goals.filter((item) => item.id !== id);
      db.goalContributions = db.goalContributions.filter((item) => item.goalId !== id);
    } else if (entity === "notes") {
      db.notes = db.notes.filter((item) => item.id !== id);
      db.noteItems = db.noteItems.filter((item) => item.noteId !== id);
    } else {
      throw new ApiClientError(404, `Ruta movil no soportada: ${route}`);
    }
    return { ok: true };
  }, true) as Promise<T>;
}

export const mobileApi = {
  get: handleGet,
  post: handlePost,
  put: handlePut,
  patch: handlePatch,
  delete: handleDelete,
  async download(path: string, fallbackName: string): Promise<void> {
    const db = await loadDb();
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), path, db }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName.replace(/\.(sqlite|db|xlsx|pdf)$/i, ".json");
    a.click();
    URL.revokeObjectURL(url);
  },
  async upload<T>(_path: string, file: File): Promise<T> {
    const text = await file.text();
    const parsed = JSON.parse(text) as { db?: MobileDb };
    if (!parsed.db) throw new ApiClientError(400, "Archivo movil invalido");
    await saveDb(parsed.db);
    return { ok: true } as T;
  },
};
