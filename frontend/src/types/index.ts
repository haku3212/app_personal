/**
 * Tipos compartidos de la API — espejo de las respuestas del backend.
 */

export interface Setting {
  id: number;
  currency: string;
  theme: "light" | "dark" | "system";
  accentColor: string;
  autoBackup: boolean;
}

export interface Account {
  id: number;
  name: string;
  type: "CASH" | "BANK" | "OTHER";
  initialBalance: number;
  icon: string | null;
  archived: boolean;
  balance: number;
}

export interface Category {
  id: number;
  name: string;
  kind: "INCOME" | "EXPENSE";
  color: string;
  icon: string | null;
}

export interface Income {
  id: number;
  date: string;
  amount: number;
  source: string;
  description: string | null;
  paymentMethod: string;
  notes: string | null;
  categoryId: number | null;
  category: Category | null;
  accountId: number | null;
  account: Account | null;
}

export interface Expense {
  id: number;
  date: string;
  amount: number;
  description: string | null;
  paymentMethod: string;
  notes: string | null;
  categoryId: number | null;
  category: Category | null;
  accountId: number | null;
  account: Account | null;
}

export interface WorkLog {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  overtime: number;
  place: string | null;
  company: string | null;
  project: string | null;
  description: string | null;
  hourlyRate: number | null;
  fixedPay: number | null;
  expectedPay: number;
}

export interface LoanPayment {
  id: number;
  loanId: number;
  date: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  note: string | null;
}

export interface Loan {
  id: number;
  type: "LENT" | "BORROWED";
  person: string;
  amount: number;
  interestRate: number;
  date: string;
  dueDate: string | null;
  status: "PENDING" | "PARTIAL" | "PAID";
  notes: string | null;
  payments: LoanPayment[];
  paid: number;
  principalPaid: number;
  interestPaid: number;
  interestExpected: number;
  remaining: number;
  interestRemaining: number;
  totalRemaining: number;
}

export interface GoalContribution {
  id: number;
  goalId: number;
  date: string;
  amount: number;
  note: string | null;
}

export interface SavingGoal {
  id: number;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  color: string;
  icon: string | null;
  achieved: boolean;
  contributions: GoalContribution[];
  currentAmount: number;
  progress: number;
}

export interface NoteItem {
  id: number;
  noteId: number;
  text: string;
  done: boolean;
  order: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  updatedAt: string;
  items: NoteItem[];
}

export interface DashboardData {
  cards: {
    available: number;
    incomeMonth: number;
    expenseMonth: number;
    balanceMonth: number;
    hoursMonth: number;
    expectedPayMonth: number;
    totalSavings: number;
    owedToMe: number;
    iOwe: number;
    totalLoans: number;
  };
  series: {
    month: string;
    income: number;
    expense: number;
    balance: number;
    hours: number;
    savings: number;
  }[];
  expensesByCategory: { name: string; color: string; value: number }[];
}

export interface StatsData {
  spendPerDay: number;
  spendPerMonth: number;
  incomePerMonth: number;
  totalSaved: number;
  mostExpensiveMonth: { month: string; amount: number } | null;
  bestIncomeMonth: { month: string; amount: number } | null;
  biggestExpense: { date: string; amount: number; description: string | null } | null;
  biggestIncome: { date: string; amount: number; source: string } | null;
  totalHours: number;
  avgHourlyPay: number;
  hoursByMonth: { month: string; hours: number }[];
}

export interface CalendarDay {
  date: string;
  income: number;
  expense: number;
  hours: number;
  loans: { person: string; type: string; amount: number }[];
}

export interface SearchResult {
  type: "income" | "expense" | "worklog" | "loan" | "note" | "goal";
  id: number;
  title: string;
  subtitle: string;
  amount: number | null;
  date: string | null;
}

export interface AppNotification {
  id: string;
  level: "info" | "warning" | "danger";
  title: string;
  detail: string;
}

export interface ReportInsights {
  periods: {
    label: string;
    from: string;
    to: string;
    income: number;
    expense: number;
    profit: number;
  }[];
  topCategories: {
    name: string;
    color: string;
    amount: number;
    count: number;
    percent: number;
  }[];
  dangerCategory: ReportInsights["topCategories"][number] | null;
}

export interface AuditLog {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "IMPORT" | "EXPORT";
  entity: string;
  entityId: string | null;
  description: string;
  createdAt: string;
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export interface WorkSummary {
  weekHours: number;
  monthHours: number;
  monthPay: number;
  monthOvertime: number;
  avgHoursPerDay: number;
  monthly: { month: string; hours: number; pay: number }[];
}

export interface LoanSummary {
  owedToMe: number;
  iOwe: number;
  totalLoans: number;
  activeLoans: number;
  lentTotal: number;
}

export interface ExpenseSummary {
  today: number;
  week: number;
  month: number;
  year: number;
}
