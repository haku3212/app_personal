/**
 * Semilla de datos por defecto.
 * Se ejecuta en cada arranque: solo inserta si las tablas están vacías,
 * así el primer uso de la app ya tiene categorías y cuentas listas.
 */
import { prisma } from "./lib/prisma";

export const EXPENSE_CATEGORIES: { name: string; color: string; icon: string }[] = [
  { name: "Comida", color: "#f97316", icon: "utensils" },
  { name: "Gasolina", color: "#ef4444", icon: "fuel" },
  { name: "Herramientas", color: "#8b5cf6", icon: "wrench" },
  { name: "Transporte", color: "#06b6d4", icon: "bus" },
  { name: "Universidad", color: "#3b82f6", icon: "graduation-cap" },
  { name: "Internet", color: "#22c55e", icon: "wifi" },
  { name: "Compras", color: "#eab308", icon: "shopping-bag" },
  { name: "Salud", color: "#ec4899", icon: "heart-pulse" },
  { name: "Diversión", color: "#a855f7", icon: "gamepad-2" },
  { name: "Ropa", color: "#14b8a6", icon: "shirt" },
  { name: "Otros", color: "#94a3b8", icon: "circle-ellipsis" },
];

export const INCOME_CATEGORIES: { name: string; color: string; icon: string }[] = [
  { name: "Trabajo", color: "#22c55e", icon: "briefcase" },
  { name: "Madre", color: "#ec4899", icon: "heart" },
  { name: "Venta", color: "#f97316", icon: "tag" },
  { name: "Freelance", color: "#3b82f6", icon: "laptop" },
  { name: "Otros", color: "#94a3b8", icon: "circle-ellipsis" },
];

export const DEFAULT_ACCOUNTS: { name: string; type: string; icon: string }[] = [
  { name: "Efectivo", type: "CASH", icon: "banknote" },
  { name: "Caja", type: "CASH", icon: "vault" },
  { name: "Banco", type: "BANK", icon: "landmark" },
];

/** Inserta datos por defecto si la base está recién creada. */
export async function seedDefaults(): Promise<void> {
  const db = prisma();

  if ((await db.category.count()) === 0) {
    await db.category.createMany({
      data: [
        ...EXPENSE_CATEGORIES.map((c) => ({ ...c, kind: "EXPENSE" })),
        ...INCOME_CATEGORIES.map((c) => ({ ...c, kind: "INCOME" })),
      ],
    });
  }

  if ((await db.account.count()) === 0) {
    await db.account.createMany({ data: DEFAULT_ACCOUNTS });
  }

  // Fila única de ajustes (moneda Bs. por defecto).
  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Inserta cuentas y categorias privadas para un usuario online recien creado. */
export async function seedUserDefaults(ownerId: number): Promise<void> {
  const db = prisma();
  const [categoryCount, accountCount] = await Promise.all([
    db.category.count({ where: { ownerId } }),
    db.account.count({ where: { ownerId } }),
  ]);

  if (categoryCount === 0) {
    await db.category.createMany({
      data: [
        ...EXPENSE_CATEGORIES.map((c) => ({ ...c, kind: "EXPENSE", ownerId })),
        ...INCOME_CATEGORIES.map((c) => ({ ...c, kind: "INCOME", ownerId })),
      ],
    });
  }

  if (accountCount === 0) {
    await db.account.createMany({
      data: DEFAULT_ACCOUNTS.map((account) => ({ ...account, ownerId })),
    });
  }
}
