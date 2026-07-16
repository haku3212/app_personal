# PERSONAL CONTROL — Diccionario de datos

Motor: **SQLite** (archivo local en el directorio de datos del usuario).
ORM: **Prisma** con migraciones versionadas en `database/prisma/migrations/`.

## Principios

1. **Normalización**: los históricos (abonos de préstamos, aportes a metas,
   ítems de checklist) viven en tablas hijas con FK y `onDelete` explícito.
2. **Saldos derivados**: ningún saldo se guarda; siempre se calcula de
   `Income`, `Expense`, `LoanPayment` y `GoalContribution`. Así nunca hay
   inconsistencias.
3. **Pseudo-enums**: SQLite no soporta enums; los valores válidos se
   restringen con Zod en el backend (única puerta de entrada de datos).

## Tablas

| Tabla              | Propósito                                             | Relaciones |
|--------------------|--------------------------------------------------------|------------|
| `Setting`          | Ajustes globales (moneda, tema, acento, auto-respaldo). Fila única `id=1`. | — |
| `Account`          | Cuentas de dinero (Caja, Banco, Efectivo…).            | 1→N Income, Expense |
| `Category`         | Categorías editables, con `kind` INCOME/EXPENSE.       | 1→N Income, Expense |
| `Income`           | Ingresos (fecha, monto, origen, método de pago…).      | N→1 Category, Account |
| `Expense`          | Gastos.                                                | N→1 Category, Account |
| `WorkLog`          | Jornadas: horario, descanso, horas y pago calculados.  | — |
| `Loan`             | Préstamos `LENT` (presté) / `BORROWED` (me prestaron). | 1→N LoanPayment |
| `LoanPayment`      | Abonos parciales de un préstamo.                       | N→1 Loan (cascade) |
| `SavingGoal`       | Metas de ahorro con objetivo y fecha.                  | 1→N GoalContribution |
| `GoalContribution` | Aportes a una meta (progreso = Σ aportes).             | N→1 SavingGoal (cascade) |
| `Note`             | Notas rápidas.                                         | 1→N NoteItem |
| `NoteItem`         | Ítems de checklist de una nota.                        | N→1 Note (cascade) |

## Reglas de negocio en datos

- `WorkLog.hours` = (fin − inicio − descanso) en horas, redondeado a 2 decimales.
- `WorkLog.overtime` = max(0, horas − 8).
- `WorkLog.expectedPay` = horas × pagoPorHora + pagoFijo.
- `Loan.status` se recalcula al registrar abonos: `PAID` si Σ abonos ≥ monto,
  `PARTIAL` si 0 < Σ < monto, `PENDING` si no hay abonos.
- Saldo de una cuenta = `initialBalance` + Σ ingresos − Σ gastos de esa cuenta.
- Dinero disponible global = Σ saldos de cuentas no archivadas.
