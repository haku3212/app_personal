# PERSONAL CONTROL — Arquitectura

## Visión general

```
┌───────────────────────────── Electron (escritorio) ─────────────────────────────┐
│                                                                                 │
│  ┌──────────────┐   HTTP local (127.0.0.1:4310)   ┌──────────────────────────┐  │
│  │   Frontend    │ ───────────────────────────────▶│        Backend           │  │
│  │ React + Vite  │ ◀─────────────────────────────── │  Express + Prisma        │  │
│  │ Tailwind/shadcn│                                 │  (embebido en el main)   │  │
│  └──────────────┘                                  └───────────┬──────────────┘  │
│                                                                │                 │
│                                                        ┌───────▼───────┐         │
│                                                        │    SQLite      │         │
│                                                        │ (userData dir) │         │
│                                                        └───────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **100% offline**: la API escucha solo en `127.0.0.1` y la base es un archivo SQLite local.
- **Un solo proceso** en producción: Electron `main` importa el servidor Express compilado
  y lo levanta en memoria (sin procesos node externos).
- En **desarrollo** los tres corren por separado con hot-reload (`npm run dev`).

## Carpetas

| Carpeta      | Contenido                                                                    |
|--------------|------------------------------------------------------------------------------|
| `frontend/`  | SPA React (Vite, Tailwind, componentes estilo shadcn/ui, Recharts).           |
| `backend/`   | API Express en TypeScript; un módulo por dominio en `src/modules/`.          |
| `database/`  | `schema.prisma`, migraciones y documentación del modelo de datos.             |
| `electron/`  | Proceso principal + preload (TypeScript compilado a `electron/dist`).         |
| `docs/`      | Este documento, el plan de desarrollo y el diccionario de datos.              |
| `public/`    | Recursos estáticos compartidos (íconos de la app para el instalador).         |
| `scripts/`   | Utilidades de desarrollo/CI.                                                  |

## Backend — módulos

Cada módulo vive en `backend/src/modules/<nombre>/` y expone un `Router` de Express:

```
modules/
├── accounts/        # Cuentas (caja, banco, efectivo) y saldos en tiempo real
├── categories/      # Categorías editables de ingresos y gastos
├── incomes/         # Ingresos
├── expenses/        # Gastos + totales diario/semanal/mensual/anual
├── worklogs/        # Jornadas: cálculo de horas reales, extras y pago esperado
├── loans/           # Préstamos (yo presté / me prestaron) + abonos parciales
├── goals/           # Metas de ahorro + aportes
├── notes/           # Notas rápidas + checklist
├── settings/        # Moneda, tema, color de acento, respaldo automático
├── dashboard/       # Agregados para las tarjetas y gráficos del inicio
├── stats/           # Estadísticas históricas y récords
├── calendar/        # Movimientos agrupados por día para el calendario
├── search/          # Búsqueda global en todos los movimientos
├── notifications/   # Avisos calculados (vencimientos, metas, días sin registro)
├── reports/         # Exportación Excel (exceljs) y PDF (pdfkit)
└── backups/         # Copias de la base SQLite, restauración, import/export
```

Convenciones por módulo:

- `<modulo>.router.ts` → esquemas **Zod** (fuente única de tipos de entrada),
  lógica de negocio con Prisma y binding HTTP, en secciones claras.
- Cálculos compartidos entre módulos viven en `utils/` (fechas, jornadas)
  y helpers HTTP en `lib/` — nunca duplicados dentro de un módulo.

## Base de datos

SQLite vía **Prisma**. El esquema completo está en `database/prisma/schema.prisma`
y documentado en `docs/BASE_DE_DATOS.md`. Decisiones clave:

- SQLite no soporta enums nativos ⇒ campos `String` restringidos por Zod
  (`LoanType`, `LoanStatus`, `CategoryKind`, `AccountType`).
- Montos en `Float` redondeados a 2 decimales en la capa de servicio.
- Los saldos **no se guardan**: se derivan de los movimientos (fuente de verdad única).
- Préstamos y metas usan tablas hijas (`LoanPayment`, `GoalContribution`) para
  mantener el historial normalizado.

## Frontend

- **Estado servidor**: TanStack Query (caché, invalidación por módulo).
- **Ruteo**: React Router (una ruta por módulo).
- **UI**: componentes propios estilo shadcn/ui en `components/ui/` (sin Bootstrap).
- **Tema**: claro/oscuro con variables CSS (`class="dark"`), persistido en el backend.
- **API client**: wrapper `lib/api.ts` tipado con los tipos compartidos de `types/`.

## Cómo agregar un módulo futuro (ej. "Vehículos")

1. Modelos en `schema.prisma` + `npx prisma migrate dev`.
2. Carpeta `backend/src/modules/vehicles/` (schemas + service + router) y montarla en `routes.ts`.
3. Página `frontend/src/pages/Vehicles.tsx` + entrada en `lib/navigation.ts`.
4. Listo: buscador, respaldos y reportes lo heredan sin cambios estructurales.
