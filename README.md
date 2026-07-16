<div align="center">

# 💜 Personal Control

**Aplicación de escritorio 100 % offline para administrar tu vida financiera:**
ingresos, gastos, horas trabajadas, préstamos, metas de ahorro, calendario,
notas, reportes y estadísticas.

React · TypeScript · Vite · TailwindCSS · Express · Prisma · SQLite · Electron · Recharts

</div>

---

## ✨ Características

| Módulo | Qué hace |
|---|---|
| **Dashboard** | Dinero disponible, ingresos/gastos del mes, balance, horas, pago esperado, ahorro, préstamos + 4 gráficos |
| **Ingresos** | Registro con origen, categoría, método de pago, cuenta y observaciones |
| **Gastos** | Categorías editables + totales diario / semanal / mensual / anual |
| **Horas de trabajo** | Cálculo automático de horas reales, extras y pago esperado (por hora y/o fijo) |
| **Préstamos** | "Yo presté" / "Me prestaron", abonos parciales, estados automáticos y vencimientos |
| **Metas de ahorro** | Objetivos con aportes y barra de progreso |
| **Control de efectivo** | Saldo en tiempo real por cuenta (caja, banco, efectivo) |
| **Calendario** | Ingresos, gastos, horas y préstamos día por día |
| **Notas** | Notas rápidas, pendientes y checklists |
| **Estadísticas** | Promedios, mes más caro, mayores movimientos, pago promedio por hora |
| **Reportes** | Exportación **Excel** y **PDF** filtrable por fechas y categoría |
| **Respaldos** | Copias de la base SQLite con un botón, restauración e import/export |
| **Búsqueda global** | `Ctrl + K` encuentra cualquier movimiento en toda la app |
| **Notificaciones** | Préstamos por vencer, metas casi logradas, días sin registrar |

Tema claro/oscuro, animaciones suaves, interfaz estilo Notion/Linear, sin login
(es solo para ti) y sin necesidad de internet.

## 🚀 Inicio rápido

Requisitos: **Node.js 20+** y npm.

```bash
git clone https://github.com/haku3212/app_personal.git
cd app_personal
node scripts/setup.mjs      # instala dependencias y crea la base de datos
npm run dev                 # backend (4310) + frontend (5173) con hot-reload
```

Abre `http://localhost:5173`. Para probar la ventana de escritorio en desarrollo:

```bash
npm run dev:electron        # requiere `npm run dev` corriendo en otra terminal
```

## 📦 Compilar el instalador de Windows

```bash
npm run dist
```

Genera el instalador NSIS en `release/`. La app empaquetada:

- guarda la base de datos en `%APPDATA%/personal-control/`,
- aplica las migraciones automáticamente al arrancar (runner embebido),
- crea un respaldo automático al cerrar (conserva los últimos 10).

## 🧰 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Backend + frontend en modo desarrollo |
| `npm run dev:electron` | Ventana Electron apuntando al dev server |
| `npm run build` | Compila backend, frontend y electron |
| `npm run dist` | Build completo + instalador de Windows |
| `npm run typecheck` | TypeScript estricto en los 3 procesos |
| `npm run db:migrate` | Nueva migración de Prisma (desarrollo) |
| `npm run db:studio` | Prisma Studio para inspeccionar la base |

## 🏗️ Arquitectura

```
frontend/   React + Vite + Tailwind + Recharts (SPA)
backend/    Express + Prisma + Zod — un módulo por dominio en src/modules/
database/   schema.prisma + migraciones versionadas
electron/   Proceso principal + preload (la API viaja embebida en producción)
docs/       Arquitectura, plan de desarrollo y diccionario de datos
public/     Ícono de la app para el instalador
scripts/    Utilidades (setup inicial)
```

Detalles completos en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md),
[`docs/PLAN_DESARROLLO.md`](docs/PLAN_DESARROLLO.md) y
[`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md).

### Agregar un módulo futuro (vehículos, inventario, cripto…)

1. Modelos en `database/prisma/schema.prisma` + `npm run db:migrate`.
2. Carpeta nueva en `backend/src/modules/` + 1 línea en `routes.ts`.
3. Página nueva en `frontend/src/pages/` + 1 entrada en `lib/navigation.ts`.

La búsqueda, los respaldos y la estructura existente no se tocan.

## 📄 Licencia

[MIT](LICENSE) © haku3212
